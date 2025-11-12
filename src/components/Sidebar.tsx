import React from 'react';
import { SAMPLE_CIRCUITS } from '../circuits';

interface SidebarProps {
  onLoadCircuit: (circuit?: string[]) => void;
}

export default function Sidebar({ onLoadCircuit }: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSampleClick = (circuit: string[]) => {
    onLoadCircuit(circuit);
    setIsOpen(false);
  };

  return (
    <>
      {/* Burger menu button - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 w-10 h-10 flex flex-col justify-center items-center bg-neutral-900 border-2 border-[#84B6C7] rounded hover:bg-neutral-800 transition-colors cursor-pointer"
        aria-label="Menu"
      >
        <div className={`w-6 h-0.5 bg-[#84B6C7] transition-all ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
        <div className={`w-6 h-0.5 bg-[#84B6C7] my-1 transition-all ${isOpen ? 'opacity-0' : ''}`} />
        <div className={`w-6 h-0.5 bg-[#84B6C7] transition-all ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-neutral-900 border-r-2 border-[#84B6C7] shadow-xl z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="pt-20 px-4 overflow-y-auto h-full pb-8">
          <button
            onClick={() => {
              onLoadCircuit();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 bg-[#84B6C7] text-white font-sans font-bold rounded hover:bg-[#6a9ab0] transition-colors cursor-pointer mb-6"
          >
            Load Circuit
          </button>

          <h3 className="text-white font-sans text-sm font-bold mb-3 uppercase tracking-wider">Samples</h3>

          <div className="space-y-2">
            {Object.values(SAMPLE_CIRCUITS).map((sample) => (
              <button
                key={sample.name}
                onClick={() => handleSampleClick(sample.circuit)}
                className="w-full px-3 py-2 bg-neutral-800 text-neutral-200 font-sans text-sm text-left rounded hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer border border-neutral-700 hover:border-[#84B6C7]"
              >
                {sample.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay - click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
