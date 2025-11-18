import React from 'react';
import SimulatorCore from '../components/SimulatorCore';
import MobileHint from '../components/MobileHint';
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
    const connections = getCircuitFromUrl();

    if (connections.length > 0) {
      isLoadingFromUrl.current = true;
      setCircuit(connections);
      setTimeout(() => {
        isLoadingFromUrl.current = false;
        hasLoadedInitialUrl.current = true;
      }, 0);
    } else {
      hasLoadedInitialUrl.current = true;
    }
  }, []);

  // Listen for hash changes (when user manually changes URL)
  React.useEffect(() => {
    const handleHashChange = () => {
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
      return;
    }

    // Skip if we haven't loaded initial URL yet (prevents clearing hash before load)
    if (!hasLoadedInitialUrl.current) {
      return;
    }

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
      setCircuit(sampleCircuit);
    } else {
      // Show manual load dialog
      setShowLoadDialog(true);
    }
  };

  // Handle loading circuit from dialog
  const handleLoadFromDialog = (notation: string[]) => {
    setCircuit(notation);
    setShowLoadDialog(false);
  };

  // Handle resetting the circuit
  const handleResetCircuit = () => {
    setCircuit([]);
  };

  return (
    <>
      <MobileHint />
      <Sidebar
        onLoadCircuit={handleLoadCircuit}
        onResetCircuit={handleResetCircuit}
      />

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
