import React from 'react';
import SimulatorCore from '../components/SimulatorCore';
import Sidebar from '../components/Sidebar';
import LoadCircuitDialog from '../components/dialogs/LoadCircuitDialog';
import { updateUrlWithCircuit, getCircuitFromUrl } from '../utils/circuit-url';

/**
 * SimulatorPage - Full-featured simulator with URL sync and UI controls
 *
 * This is the wrapper component for /simulator that adds:
 * - URL hash sync (read circuit from URL on load, write circuit to URL on change)
 * - Sidebar with sample circuits
 * - Load circuit dialog
 *
 * The core simulation logic is in SimulatorCore (which can be embedded elsewhere)
 */
export default function SimulatorPage() {
  // Circuit state - driven by URL
  const [circuit, setCircuit] = React.useState<string[]>([]);

  // Load circuit dialog state
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);

  // Track if we're currently loading from URL to prevent update loops
  const isLoadingFromUrl = React.useRef(false);
  const hasLoadedInitialUrl = React.useRef(false);

  // Load circuit from URL on mount
  React.useEffect(() => {
    console.log('[SimulatorPage] Loading circuit from URL...');
    const connections = getCircuitFromUrl();

    if (connections.length > 0) {
      console.log('[SimulatorPage] Found', connections.length, 'connections in URL');
      isLoadingFromUrl.current = true;
      setCircuit(connections);
      setTimeout(() => {
        isLoadingFromUrl.current = false;
        hasLoadedInitialUrl.current = true;
      }, 0);
    } else {
      console.log('[SimulatorPage] No connections in URL');
      hasLoadedInitialUrl.current = true;
    }
  }, []);

  // Listen for hash changes (when user manually changes URL)
  React.useEffect(() => {
    const handleHashChange = () => {
      console.log('[SimulatorPage] Hash changed, reloading circuit');
      const connections = getCircuitFromUrl();

      if (connections.length > 0) {
        isLoadingFromUrl.current = true;
        setCircuit(connections);
        setTimeout(() => {
          isLoadingFromUrl.current = false;
        }, 0);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL when circuit changes (from SimulatorCore)
  const handleCircuitChange = (newCircuit: string[]) => {
    // Skip if we're loading from URL (prevents infinite loop)
    if (isLoadingFromUrl.current) {
      console.log('[SimulatorPage] Skipping URL update - loading from URL');
      return;
    }

    // Skip if we haven't loaded initial URL yet (prevents clearing hash before load)
    if (!hasLoadedInitialUrl.current) {
      console.log('[SimulatorPage] Skipping URL update - haven\'t loaded initial URL yet');
      return;
    }

    console.log('[SimulatorPage] Updating URL with', newCircuit.length, 'connections');

    // Convert circuit notation to cables format for URL update
    const cables = newCircuit.map(conn => ({
      holeIds: conn.split('/')
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateUrlWithCircuit(cables as any);
  };

  // Handle loading sample circuits from sidebar
  const handleLoadCircuit = (sampleCircuit?: string[]) => {
    if (sampleCircuit) {
      // Load sample circuit directly
      console.log('[SimulatorPage] Loading sample circuit:', sampleCircuit.length, 'connections');
      setCircuit(sampleCircuit);
    } else {
      // Show manual load dialog
      setShowLoadDialog(true);
    }
  };

  // Handle loading circuit from dialog
  const handleLoadFromDialog = (notation: string[]) => {
    console.log('[SimulatorPage] Loading circuit from dialog:', notation.length, 'connections');
    setCircuit(notation);
    setShowLoadDialog(false);
  };

  return (
    <>
      <Sidebar onLoadCircuit={handleLoadCircuit} />

      <LoadCircuitDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadCircuit={handleLoadFromDialog}
      />

      <SimulatorCore
        initialCircuit={circuit}
        onCircuitChange={handleCircuitChange}
        enableAudio={true}
        scale={1}
      />
    </>
  );
}
