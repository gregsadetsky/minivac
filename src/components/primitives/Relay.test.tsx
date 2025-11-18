/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Relay from './Relay';

describe('Relay', () => {
  describe('pointer events (mouse, touch, pen)', () => {
    it('should call onPointerDown and onPointerUp handlers', () => {
      const onPointerDown = vi.fn();
      const onPointerUp = vi.fn();

      const { container } = render(
        <Relay
          isEnergized={false}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      );

      const relay = container.firstChild as HTMLElement;

      fireEvent.pointerDown(relay);
      expect(onPointerDown).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(relay);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('should call onPointerUp when pointer leaves while pressed', () => {
      const onPointerDown = vi.fn();
      const onPointerUp = vi.fn();

      const { container } = render(
        <Relay
          isEnergized={false}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      );

      const relay = container.firstChild as HTMLElement;

      fireEvent.pointerDown(relay);
      expect(onPointerDown).toHaveBeenCalledTimes(1);
      expect(onPointerUp).toHaveBeenCalledTimes(0);

      fireEvent.pointerLeave(relay);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('should call onPointerUp when pointer is cancelled', () => {
      const onPointerDown = vi.fn();
      const onPointerUp = vi.fn();

      const { container } = render(
        <Relay
          isEnergized={false}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      );

      const relay = container.firstChild as HTMLElement;

      fireEvent.pointerDown(relay);
      expect(onPointerDown).toHaveBeenCalledTimes(1);

      fireEvent.pointerCancel(relay);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('should work with touch events through pointer API', () => {
      // This test verifies that touch events work through the pointer event API
      // Modern browsers map touch events to pointer events automatically
      const onPointerDown = vi.fn();
      const onPointerUp = vi.fn();

      const { container } = render(
        <Relay
          isEnergized={false}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      );

      const relay = container.firstChild as HTMLElement;

      // Simulate touch by using pointerDown with pointerType: 'touch'
      fireEvent.pointerDown(relay, { pointerType: 'touch' });
      expect(onPointerDown).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(relay, { pointerType: 'touch' });
      expect(onPointerUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('visual state', () => {
    it('should render when not energized', () => {
      const { container } = render(<Relay isEnergized={false} />);
      expect(container.firstChild).toBeTruthy();
    });

    it('should render when energized', () => {
      const { container } = render(<Relay isEnergized={true} />);
      expect(container.firstChild).toBeTruthy();
    });
  });
});
