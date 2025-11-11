import { useState } from 'react';

interface RelayProps {
  width?: number;
  height?: number;
  isEnergized?: boolean;
  onChange?: (isEnergized: boolean) => void;
}

export default function Relay({
  width = 90,
  height = 80,
  isEnergized: controlledIsEnergized,
  onChange
}: RelayProps) {
  const [internalIsEnergized, setInternalIsEnergized] = useState(false);

  // Use controlled if provided, otherwise use internal state
  const isEnergized = controlledIsEnergized !== undefined ? controlledIsEnergized : internalIsEnergized;

  return (
    <div
      className="relative select-none"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Vertical cylindrical coil on the left */}
      <div
        className="absolute"
        style={{
          top: '10px',
          left: '5px',
          width: '35px',
          height: '60px',
          background: `linear-gradient(90deg,
            #1a1d24 0%,
            #4a4d55 5%,
            #8a8d95 12%,
            #b8bbc3 16%,
            #e8e4dc 20%,
            #f8f5ed 35%,
            #ffffff 50%,
            #f8f5ed 65%,
            #e8e4dc 80%,
            #b8bbc3 84%,
            #8a8d95 88%,
            #4a4d55 95%,
            #1a1d24 100%
          )`,
          borderRadius: '4px',
          boxShadow: `
            inset 2px 0 4px rgba(0,0,0,0.4),
            inset -2px 0 4px rgba(0,0,0,0.4),
            inset 0 2px 2px rgba(0,0,0,0.2),
            inset 0 -2px 2px rgba(0,0,0,0.2),
            0 4px 8px rgba(0,0,0,0.5)
          `
        }}
      >
        {/* Left highlight to suggest cylindrical curve */}
        <div
          className="absolute"
          style={{
            top: '8px',
            left: '4px',
            width: '2px',
            height: '44px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 100%)',
            borderRadius: '1px'
          }}
        />

        {/* Right shadow to suggest cylindrical curve */}
        <div
          className="absolute"
          style={{
            top: '8px',
            right: '4px',
            width: '2px',
            height: '44px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)',
            borderRadius: '1px'
          }}
        />

        {/* Center highlight on white tape */}
        <div
          className="absolute"
          style={{
            top: '15px',
            left: '14px',
            width: '7px',
            height: '30px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
            borderRadius: '1px'
          }}
        />
      </div>

      {/* Armature - vertical bar that moves towards coil when energized */}
      <div
        className="absolute transition-all duration-150"
        style={{
          top: '10px',
          left: isEnergized ? '48px' : '55px',
          width: '8px',
          height: '60px',
          background: 'linear-gradient(90deg, #4a4d55 0%, #2a2d35 50%, #1a1d24 100%)',
          borderRadius: '2px',
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -1px 0 rgba(0,0,0,0.5),
            0 2px 4px rgba(0,0,0,0.5)
          `
        }}
      />
    </div>
  );
}
