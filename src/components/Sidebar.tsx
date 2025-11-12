import React from 'react';

interface SidebarProps {
  onLoadCircuit: (circuit?: string[]) => void;
}

// Sample circuits from test files
const SAMPLE_CIRCUITS = {
  'Three-Floor Elevator': [
    '1A/1E', '2B/2-', '3F/3G', '5F/6C', '1B/1-', '2C/3C', '3G/3X', '5G/5N',
    '1C/2C', '2E/D7', '3J/4E', '5J/5K', '1E/D1', '2F/2G', '3Y/4J', '5J/D17',
    '1F/1G', '2G/2X', '4C/5F', '5L/5-', '1G/1X', '2J/3H', '4F/4+', '5N/D18',
    '1H/1+', '2X/6H', '4G/5H', '6C/6-', '1H/1L', '2Y/3Y', '4H/4+', '6F/D12',
    '1J/2H', '3A/3E', '4L/D19', 'D0/D1', '1K/5E', '3B/3-', '4N/D18', 'D6/D7',
    '1Y/2Y', '3C/4C', '5C/5G', 'D12/D13', '2A/2E', '3E/D13', '5E/6G', 'D16/M+',
  ],
  'Morse Code Transmitter': [
    '3C/4C', '4F/5N', '5L/D0', '6H/6+', '3F/4G', '4H/5H', '5X/6E', '6H/6Y',
    '3G/3K', '4K/5F', '5Y/6Y', '6com/D2', '3G/5com', '4L/D15', '5com/D11', 'D3/D4',
    '3H/D12', '4N/5E', '6A/6com', 'D4/D5', '3J/6com', '5A/5com', '6B/6-', 'D5/D12',
    '3L/D13', '5B/6B', '6C/6-', 'D16/D17', '4C/5C', '5C/6C', '6F/6G', 'D18/M-',
    '4E/5K', '5F/5G', '6F/6X', '4F/4G', '5H/5+', '6G/D17',
  ],
  'Motor & Lights': [
    '6+/D16', 'D2/6A', '6-/6B', 'D1/5A', '5B/6B', '6+/5Y',
    '5X/D17', '5-/D18', '6-/6Y', '6X/D19',
  ],
  'OCR Digit Recognition': [
    '1C/2C', '3C/4C', '4H/5J', '6H/6-', '1F/M9t', '3F/M6t', '4L/5K', '6X/M10',
    '1G/6com', '3G/D6', '5C/6C', '6X/D17', '1H/4K', '3H/4N', '5F/M4t', '6Y/6+',
    '1J/D0', '3J/D9', '5G/D5', '6com/D4', '2C/3C', '3K/D8', '5H/6G', 'M10/M11',
    '2F/M5t', '3L/4J', '5L/6J', 'D16/D19', '2G/D2', '3N/D7', '5N/D1', 'D18/M-',
    '2H/4G', '4C/5C', '6C/6-', '2J/D3', '4F/M8t', '6F/M7t',
  ],
  '3-Bit Binary Counter': [
    '1A/2E', '2C/2-', '3H/5A', '5F/6F', '1B/1C', '2E/2J', '3J/4H', '5F/5H',
    '1B/2B', '2G/2N', '3N/4N', '5G/5+', '1C/2C', '2H/3L', '4B/5B', '5H/6A',
    '1E/2G', '2L/2-', '4C/4-', '5J/6H', '1F/2F', '3A/6E', '4E/4J', '5N/6N',
    '1F/1H', '3B/4B', '4G/4N', '6C/6-', '1G/1+', '3C/4C', '4H/5L', '6E/6J',
    '1H/4A', '3E/4G', '4L/4-', '6G/6N', '1J/2H', '3F/3H', '5B/6B', '6H/6X',
    '2A/4E', '3F/4F', '5C/6C', '6L/6-', '2B/3B', '3G/3+', '5E/6G', '6Y/6+',
  ],
};

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
        className={`fixed top-0 left-0 h-full w-64 bg-neutral-900 border-r-2 border-[#84B6C7] shadow-xl z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
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
            {Object.entries(SAMPLE_CIRCUITS).map(([name, circuit]) => (
              <button
                key={name}
                onClick={() => handleSampleClick(circuit)}
                className="w-full px-3 py-2 bg-neutral-800 text-neutral-200 font-sans text-sm text-left rounded hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer border border-neutral-700 hover:border-[#84B6C7]"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay - click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
