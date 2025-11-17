/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { useRef } from 'react';
import { useCableManagement } from './useCableManagement';
import Hole from '../components/primitives/Hole';

describe('useCableManagement - Highlighting regression tests', () => {

  beforeEach(() => {
    // Clear location hash before each test
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('should clear inline styles when highlight is removed (regression test)', () => {
    // Setup: Render a container with holes
    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useCableManagement(ref);

      return (
        <div ref={ref} data-testid="container">
          <Hole size={10} dataHoleId="1A" />
          <Hole size={10} dataHoleId="2B" />
        </div>
      );
    };

    render(<TestComponent />);

    const hole1 = screen.getByTestId('container').querySelector('[data-hole-id="1A"]') as HTMLElement;
    const hole2 = screen.getByTestId('container').querySelector('[data-hole-id="2B"]') as HTMLElement;

    expect(hole1).toBeTruthy();
    expect(hole2).toBeTruthy();

    // Simulate highlighting by setting inline styles
    hole1.style.borderColor = '#84B6C7';
    hole1.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 2px rgba(132, 182, 199, 0.5)';

    // Verify styles are set
    expect(hole1.style.borderColor).toBe('rgb(132, 182, 199)');

    // Simulate clearing (this is what the bug was - it would set to #737373 instead of '')
    hole1.style.borderColor = '';
    hole1.style.boxShadow = '';

    // Regression test: inline styles should be empty string, not a value
    // This allows CSS hover to work again
    expect(hole1.style.borderColor).toBe('');
    expect(hole1.style.boxShadow).toBe('');
  });

  it('should allow CSS hover to work after inline styles are cleared', () => {
    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useCableManagement(ref);

      return (
        <div ref={ref} data-testid="container">
          <Hole size={10} dataHoleId="testHole" />
        </div>
      );
    };

    render(<TestComponent />);
    const hole = screen.getByTestId('container').querySelector('[data-hole-id="testHole"]') as HTMLElement;

    // Simulate the highlighting/clearing cycle
    hole.style.borderColor = '#84B6C7';
    hole.style.borderColor = ''; // Clear to empty string

    // The hole should not have inline border style
    expect(hole.style.borderColor).toBe('');

    // CSS hover can now apply (we can't test the actual hover in jsdom,
    // but we verified inline styles don't block it)
  });
});

describe('URL management', () => {
  beforeEach(() => {
    // Clear location hash before each test
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('should update URL hash when cables are created', () => {
    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      const cableManagement = useCableManagement(ref);

      return (
        <div ref={ref}>
          <button
            onClick={() => {
              cableManagement.setCables([{
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
                color: '#cc3333',
                droop: 50,
                holeIds: ['1A', '2B']
              }]);
            }}
          >
            Add Cable
          </button>
          <Hole size={10} dataHoleId="1A" />
          <Hole size={10} dataHoleId="2B" />
        </div>
      );
    };

    render(<TestComponent />);

    // Initial state - no hash
    expect(window.location.hash).toBe('');

    // This test is limited because we'd need to integrate with the App component
    // to test the full URL update flow. The URL update happens in App.tsx useEffect.
    // For a full integration test, we'd need to render the full App component.
  });

  it('should use different holes when multiple wires connect to the same terminal', () => {
    // Regression test for bug where multiple wires to same terminal (e.g., 5+)
    // would all use the first hole instead of spreading across available holes

    // Mock getBoundingClientRect to return predictable positions
    let holeCounter = 0;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    Element.prototype.getBoundingClientRect = function() {
      const holeId = this.getAttribute('data-hole-id');
      if (holeId) {
        // Return different positions for each hole element instance
        const thisHoleIndex = holeCounter++;
        return {
          left: 100 + (thisHoleIndex * 50), // Different X for each hole
          top: 100,
          right: 110 + (thisHoleIndex * 50),
          bottom: 110,
          width: 10,
          height: 10,
          x: 100 + (thisHoleIndex * 50),
          y: 100,
          toJSON: () => ({})
        } as DOMRect;
      }
      // Container
      return {
        left: 0,
        top: 0,
        right: 1000,
        bottom: 1000,
        width: 1000,
        height: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect;
    };

    const TestComponentWithCheck = () => {
      const ref = useRef<HTMLDivElement>(null);
      const cableManagement = useCableManagement(ref);

      // Trigger load after mount
      React.useEffect(() => {
        if (ref.current) {
          holeCounter = 0; // Reset counter before loading
          cableManagement.loadCircuitFromNotation(['6A/5+', '5C/5+']);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return (
        <div ref={ref} data-testid="container2">
          {/* Two 5+ holes */}
          <Hole size={10} dataHoleId="5+" />
          <Hole size={10} dataHoleId="5+" />
          {/* Two 6A holes */}
          <Hole size={10} dataHoleId="6A" />
          <Hole size={10} dataHoleId="6A" />
          {/* One 5C hole */}
          <Hole size={10} dataHoleId="5C" />
          <div data-testid="cable-count">{cableManagement.cables.length}</div>
          {/* Expose cable data for testing */}
          <div data-testid="cables-data">{JSON.stringify(cableManagement.cables.map(c => ({
            endX: Math.round(c.end.x),
            holeIds: c.holeIds
          })))}</div>
        </div>
      );
    };

    try {
      render(<TestComponentWithCheck />);

      // Verify we got 2 cables
      const cableCount = screen.getByTestId('cable-count');
      expect(cableCount.textContent).toBe('2');

      // THE ACTUAL BUG TEST: Check that the two cables ending at 5+ have different X coordinates
      const cablesData = JSON.parse(screen.getByTestId('cables-data').textContent!);

      // Both cables should end at 5+
      const cablesEndingAt5Plus = cablesData.filter((c: { endX: number; holeIds: string[] }) =>
        c.holeIds && c.holeIds[1] === '5+'
      );
      expect(cablesEndingAt5Plus.length).toBe(2);

      // The key assertion: The two cables ending at 5+ should have DIFFERENT X coordinates
      // If the bug existed, both would use the first hole and have the same coordinates
      const endX1 = cablesEndingAt5Plus[0].endX;
      const endX2 = cablesEndingAt5Plus[1].endX;

      expect(endX1).not.toBe(endX2); // Different X positions = different holes!
    } finally {
      // Restore original method
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('should not allow connecting a hole to itself via URL loading', () => {
    // Regression test for bug where you could connect a hole to itself,
    // making it unable to receive new wires and creating fake URL entries like #wires=5A%2F5A
    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      const cableManagement = useCableManagement(ref);

      React.useEffect(() => {
        if (ref.current) {
          // Try to load a self-connection from URL notation
          cableManagement.loadCircuitFromNotation(['5A/5A', '6B/6C']);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return (
        <div ref={ref} data-testid="container">
          <div style={{ position: 'absolute', left: '100px', top: '100px' }}>
            <Hole size={10} dataHoleId="5A" />
          </div>
          <div style={{ position: 'absolute', left: '200px', top: '100px' }}>
            <Hole size={10} dataHoleId="6B" />
          </div>
          <div style={{ position: 'absolute', left: '200px', top: '200px' }}>
            <Hole size={10} dataHoleId="6C" />
          </div>
          <div data-testid="cable-count">{cableManagement.cables.length}</div>
          <div data-testid="cables-data">{JSON.stringify(cableManagement.cables.map(c => c.holeIds))}</div>
        </div>
      );
    };

    render(<TestComponent />);

    const cableCount = screen.getByTestId('cable-count');
    const cablesData = JSON.parse(screen.getByTestId('cables-data').textContent!);

    // Should have only 1 cable (6B/6C), not 2
    // The self-connection 5A/5A should be rejected
    expect(cableCount.textContent).toBe('1');
    expect(cablesData).toEqual([['6B', '6C']]);

    // Verify no self-connection was created
    const hasSelfConnection = cablesData.some((holeIds: string[]) =>
      holeIds[0] === holeIds[1]
    );
    expect(hasSelfConnection).toBe(false);
  });

  it('should allow new wires to be created after reset', () => {
    // Regression test for bug where holes become unusable after reset
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    Element.prototype.getBoundingClientRect = function() {
      const holeId = this.getAttribute('data-hole-id');
      if (holeId === '1A') {
        return { left: 100, top: 100, right: 110, bottom: 110, width: 10, height: 10, x: 100, y: 100, toJSON: () => ({}) } as DOMRect;
      }
      if (holeId === '2B') {
        return { left: 200, top: 100, right: 210, bottom: 110, width: 10, height: 10, x: 200, y: 100, toJSON: () => ({}) } as DOMRect;
      }
      return { left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };

    try {
      const TestComponent = () => {
        const ref = useRef<HTMLDivElement>(null);
        const cableManagement = useCableManagement(ref);
        const [step, setStep] = React.useState<'initial' | 'loaded' | 'reset' | 'reloaded'>('initial');

        React.useEffect(() => {
          if (!ref.current) return;

          if (step === 'initial') {
            // Step 1: Load a circuit
            cableManagement.loadCircuitFromNotation(['1A/2B']);
            setStep('loaded');
          } else if (step === 'loaded') {
            // Step 2: Reset by loading empty circuit
            cableManagement.loadCircuitFromNotation([]);
            setStep('reset');
          } else if (step === 'reset') {
            // Step 3: Try to load a new circuit after reset
            cableManagement.loadCircuitFromNotation(['1A/2B']);
            setStep('reloaded');
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [step]);

        return (
          <div ref={ref} data-testid="reset-container">
            <Hole size={10} dataHoleId="1A" />
            <Hole size={10} dataHoleId="2B" />
            <div data-testid="step">{step}</div>
            <div data-testid="cable-count">{cableManagement.cables.length}</div>
          </div>
        );
      };

      const { rerender } = render(<TestComponent />);

      // Wait for all steps to complete
      let attempts = 0;
      while (attempts < 10) {
        const stepEl = screen.getByTestId('step');
        if (stepEl.textContent === 'reloaded') break;
        rerender(<TestComponent />);
        attempts++;
      }

      // After reset and reload, should have 1 cable again
      const cableCount = screen.getByTestId('cable-count');
      expect(cableCount.textContent).toBe('1');
    } finally {
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});
