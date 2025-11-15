import React from 'react';
import SimulatorCore from '../components/SimulatorCore';
import { THREEBIT_COUNTER } from '../circuits/presets';
import { MinivacSimulator } from '../simulator/minivac-simulator';

export default function LandingPage() {
  const [simulator, setSimulator] = React.useState<MinivacSimulator | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isInView, setIsInView] = React.useState(true);
  const autoPlayTimeoutRef = React.useRef<number | null>(null);
  const minivacContainerRef = React.useRef<HTMLDivElement>(null);

  // Intersection Observer to detect when minivac is in view
  React.useEffect(() => {
    if (!minivacContainerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 } // Trigger when at least 10% is visible
    );

    observer.observe(minivacContainerRef.current);

    return () => observer.disconnect();
  }, []);

  // Auto-play logic - runs at the page level, calls simulator methods
  // Animation starts immediately when simulator is ready for visual intrigue
  // Pauses when out of view to save resources
  React.useEffect(() => {
    if (!simulator || !isPlaying || !isInView) {
      // Clear any pending timeouts
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
        autoPlayTimeoutRef.current = null;
      }
      return;
    }

    const pressAndReleaseButton = () => {
      // Press button 6
      simulator.pressButton(6);

      // Release after 200ms (button held down longer)
      const releaseTimeout = setTimeout(() => {
        simulator.releaseButton(6);

        // Wait 500ms, then repeat
        const nextTimeout = setTimeout(() => {
          if (isPlaying) {
            pressAndReleaseButton();
          }
        }, 500);

        autoPlayTimeoutRef.current = nextTimeout as unknown as number;
      }, 200);

      autoPlayTimeoutRef.current = releaseTimeout as unknown as number;
    };

    pressAndReleaseButton();

    return () => {
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
      }
    };
  }, [simulator, isPlaying, isInView]);

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <a href="/" style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'white', textDecoration: 'none' }}>
          Minivac 601 Simulator
        </a>
        <nav>
          <a href="/simulator" style={{ color: 'white', textDecoration: 'none', marginLeft: '2rem' }}>
            Open Simulator
          </a>
          <a href="/about" style={{ color: 'white', textDecoration: 'none', marginLeft: '2rem' }}>
            About
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
        color: 'white',
        padding: '3rem 2rem 1rem',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 300 }}>
          A Relay Computer from 1961
        </h2>
        <p style={{ fontSize: '1.2rem', maxWidth: '800px', margin: '0 auto 2rem', opacity: 0.9 }}>
          Before microchips, before transistors, computers were built with mechanical relays.
          This is a working simulation of the Minivac 601 - watch it count in binary, the same way
          your phone does, just slow enough to see.
        </p>

        {/* Audio control link */}
        <div style={{ textAlign: 'center', margin: '1rem 0' }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsMuted(!isMuted);
            }}
            style={{
              color: '#88c0d0',
              textDecoration: 'underline',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
          >
            {isMuted ? 'Click to hear the relays' : 'Mute the relays'}
          </a>
        </div>

        {/* Embedded Simulator - 3-bit counter auto-playing */}
        <div
          ref={minivacContainerRef}
          style={{
            background: '#2a2a2a',
            border: '3px solid #444',
            borderRadius: '8px',
            margin: '2rem auto',
            width: '1051px',
            height: '735px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <SimulatorCore
            initialCircuit={THREEBIT_COUNTER}
            onSimulatorReady={(sim) => setSimulator(sim)}
            enableAudio={true}
            muted={isMuted}
            scale={1000 / 1400}
            cableOffsetX={2}
            cableOffsetY={2}
          />
        </div>

        {/* Pause/Resume automation control */}
        <div style={{
          textAlign: 'center',
          padding: '1.5rem',
          marginTop: '2rem'
        }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsPlaying(!isPlaying);
            }}
            style={{
              color: '#88c0d0',
              textDecoration: 'underline',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            {isPlaying ? 'Pause automation' : 'Resume automation'}
          </a>
          {!isPlaying && (
            <>
              <br /><br />
              <span style={{ color: 'white', fontSize: '0.9rem' }}>
                You can also manually push and release the 6th button from the left!
              </span>
            </>
          )}
        </div>
      </div>

      {/* Explanation Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem',
        background: 'white',
        marginTop: '8rem'
      }}>
        <h3 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 400 }}>
          Each relay click is a logic operation
        </h3>
        <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: '#555' }}>
          The same operations happening billions of times per second in your phone, computer, or smartwatch.
          Here they're slowed down enough that you can see, hear, and understand exactly how digital logic works.
        </p>
        <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: '#555' }}>
          The three lights above are counting in binary: 000, 001, 010, 011, 100, 101, 110, 111 -
          that's 0 through 7. Every computer in the world counts this way.
        </p>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a
            href="/simulator"
            style={{
              display: 'inline-block',
              background: '#007bff',
              color: 'white',
              padding: '1rem 2rem',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '1.1rem',
              margin: '1rem 0.5rem'
            }}
          >
            Open the Full Simulator
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '3rem 2rem',
        marginTop: '4rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '0.95rem', opacity: 0.8 }}>
          <p style={{ marginBottom: '0.5rem' }}>
            The Minivac 601 was created in 1961 by Claude Shannon and others as an educational computer kit.
            This simulator recreates the original hardware using accurate electrical simulation.{' '}
            <a href="/about" style={{ color: '#88c0d0', textDecoration: 'none' }}>Read more...</a>
          </p>
          <p style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.6 }}>
            A project by <a href="https://greg.technology" style={{ color: '#888', textDecoration: 'none' }}>Greg Technology</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
