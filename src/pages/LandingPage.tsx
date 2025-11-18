import React from 'react';
import SimulatorCore from '../components/SimulatorCore';
import MobileHint from '../components/MobileHint';
import { THREEBIT_COUNTER } from '../circuits/presets';
import { MinivacSimulator } from '../simulator/minivac-simulator';
import { SpeakerWaveIcon, SpeakerXMarkIcon, PauseCircleIcon, PlayCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';

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
      <MobileHint />
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
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          <a href="/simulator" style={{ color: 'white', textDecoration: 'none', marginLeft: '2rem' }}>
            Open the Minivac 601 Simulator
          </a>
          <a href="https://github.com/gregsadetsky/minivac" target="_blank" style={{ marginLeft: '2rem', display: 'flex', alignItems: 'center' }}>
            <img src="/github-icon/github-mark-white.svg" alt="GitHub" style={{ width: '24px', height: '24px' }} />
          </a>
        </nav>
      </header>

      {/* Hero Section - Part 1 */}
      <div className="text-center pt-16 px-8 pb-16" style={{
        background: 'linear-gradient(135deg, #202020 0%, #1a1a1a 100%)',
        color: 'white',
      }}>
        <h2 className="text-[3rem] mb-6 font-light">
          A 1961 Relay Computer Running in Your Browser
        </h2>

        <p className="text-[1.3rem] max-w-[900px] mx-auto opacity-95 leading-[1.7]">
          Before microchips existed, computers were built with mechanical relays.<br/>
          This is a working simulation of the Minivac 601, an educational computer designed by Claude&nbsp;Shannon.
          You can watch it think slowly enough to see every step.
        </p>
      </div>

      {/* Hero Section - Part 2 */}
      <div className="pt-12 px-8 pb-4" style={{
        background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
        color: 'white',
      }}>
        <h3 className="text-center text-[1.8rem] mb-4 font-normal text-[#f0e68c]">
          This circuit is a simple 3-bit binary counter
        </h3>

        <p className="text-center text-[1.1rem] max-w-[800px] mx-auto mb-16 opacity-90">
          Lights 4, 5, and 6 are counting from zero to seven in binary.
        </p>

        {/* Audio and automation controls */}
        <div className="max-w-[800px] mx-auto mb-8 mt-4">
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsMuted(!isMuted);
              }}
              style={{
                background: '#88c0d0',
                color: '#1a1a1a',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500
              }}
            >
              {isMuted ? (
                <>
                  <SpeakerWaveIcon style={{ width: '16px', height: '16px' }} />
                  Hear the relays
                </>
              ) : (
                <>
                  <SpeakerXMarkIcon style={{ width: '16px', height: '16px' }} />
                  Mute the relays
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsPlaying(!isPlaying);
              }}
              style={{
                background: '#88c0d0',
                color: '#1a1a1a',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500
              }}
            >
              {isPlaying ? (
                <>
                  <PauseCircleIcon style={{ width: '16px', height: '16px' }} />
                  Pause automation
                </>
              ) : (
                <>
                  <PlayCircleIcon style={{ width: '16px', height: '16px' }} />
                  Resume automation
                </>
              )}
            </button>
            <div className="flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5" />
              <span>Try pausing and clicking the #6 button.</span>
            </div>
          </div>
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

        <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
          <a
            href={`/simulator${import.meta.env.DEV ? '' : '/'}#wires=${encodeURIComponent(THREEBIT_COUNTER.join(' '))}`}
            style={{
              color: '#88c0d0',
              textDecoration: 'none',
              fontSize: '0.95rem'
            }}
          >
            See in Simulator →
          </a>
        </div>
      </div>

      {/* Explanation Section */}
      <section style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '2rem 2rem',
        background: 'white',
        marginTop: '4rem'
      }}>
        <h3 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 400 }}>
          Build Your Own Circuits!
        </h3>
        <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: '#555' }}>
          This site is a work in progress. For now, peruse the original Minivac manuals (don't forget to check the Erratas) and play around with the Simulator. Drag wires, connect components, make a short circuit! (it's safe)<br/><br/>
          Questions / comments? Reach out! <a href="mailto:hi@greg.technology" style={{textDecoration: "underline"}}>hi@greg.technology</a>
        </p>

        {/* Manual Links */}
        <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
          <h4 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontWeight: 500, color: '#333' }}>
            Follow the Original Manuals
          </h4>
          <ul style={{ fontSize: '1rem', lineHeight: '2', color: '#555', listStyle: 'none', padding: 0 }}>
            <li>
              - <a href="/manuals/1961-minivac601-book1.pdf" target="_blank" style={{ color: '#007bff', textDecoration: 'underline' }}>
                Book 1
              </a>
            </li>
            <li>
              - <a href="/manuals/1961-minivac601-book2-3-4.pdf" target="_blank" style={{ color: '#007bff', textDecoration: 'underline' }}>
                Books 2, 3 & 4
              </a>
            </li>
            <li>
              - <a href="/manuals/1961-minivac601-book5-6.pdf" target="_blank" style={{ color: '#007bff', textDecoration: 'underline' }}>
                Books 5 & 6
              </a>
            </li>
            <li>
              - <a href="/manuals/1961-minivac601-erratas.pdf" target="_blank" style={{ color: '#007bff', textDecoration: 'underline' }}>
                Erratas
              </a>
            </li>
          </ul>
        </div>

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
            Open the Minivac 601 Simulator
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
          <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
            A project by <a href="https://greg.technology" style={{ color: '#888', textDecoration: 'none' }}>Greg Technology</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
