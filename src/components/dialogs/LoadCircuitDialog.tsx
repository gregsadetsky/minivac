import React from 'react';

interface LoadCircuitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCircuit: (notation: string[]) => void;
}

export default function LoadCircuitDialog({ isOpen, onClose, onLoadCircuit }: LoadCircuitDialogProps) {
  const [loadCircuitText, setLoadCircuitText] = React.useState('');

  const handleLoadCircuit = () => {
    if (!loadCircuitText.trim()) return;

    // Normalize all dash characters (en dash, em dash, minus, etc.) to hyphen
    const normalizedText = loadCircuitText
      .replace(/[–—−‐‑‒–—―]/g, '-'); // Convert various dashes to hyphen

    // Parse circuit notation (space-separated or line-separated)
    const lines = normalizedText
      .split(/[\s\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    onLoadCircuit(lines);
    onClose();
    setLoadCircuitText('');
  };

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        setLoadCircuitText('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-neutral-900 border-2 border-[#84B6C7] p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <h3 className="text-white text-lg font-sans font-bold mb-4">Load Circuit</h3>
        <p className="text-neutral-300 text-sm mb-4">
          Enter circuit connections in Minivac notation (space-separated or one per line):
        </p>
        <textarea
          value={loadCircuitText}
          onChange={(e) => setLoadCircuitText(e.target.value)}
          placeholder="Example: 1A/2B 3C/4D M+/1+"
          className="w-full h-48 bg-neutral-800 text-white font-mono text-sm p-3 rounded border border-neutral-600 focus:border-[#84B6C7] focus:outline-none"
          autoFocus
        />
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={() => {
              onClose();
              setLoadCircuitText('');
            }}
            className="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLoadCircuit}
            className="px-4 py-2 bg-[#84B6C7] text-white rounded hover:bg-[#6a9ab0] transition-colors"
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
