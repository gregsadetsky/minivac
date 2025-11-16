import React from 'react';
import Hole from '../primitives/Hole';

interface MatrixConnectorProps {
  label?: string;          // Label in center (like "1")
  holeSize?: number;
  horizontalSpacing?: number;  // Spacing between left and right holes
  verticalSpacing?: number;    // Spacing between top and bottom rows
  holeIds?: string[];      // Terminal IDs for 4 holes [top-left, top-right, bottom-left, bottom-right]
}

function MatrixConnector({
  label,
  holeSize = 10,
  horizontalSpacing = 12,
  verticalSpacing = 12,
  holeIds = []
}: MatrixConnectorProps) {
  return (
    <div className="relative flex flex-col items-center" style={{ gap: `${verticalSpacing}px` }}>
      {/* Top row: 2 holes with connecting line */}
      <div className="relative flex items-center" style={{ gap: `${horizontalSpacing}px` }}>
        <Hole size={holeSize} dataHoleId={holeIds[0]} />
        {/* Horizontal line connecting top holes */}
        <div
          className="absolute bg-neutral-500"
          style={{
            left: `${holeSize}px`,
            width: `${horizontalSpacing}px`,
            height: '2px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        />
        <Hole size={holeSize} dataHoleId={holeIds[1]} />
      </div>

      {/* Center label */}
      {label && (
        <div
          className="absolute text-neutral-300 font-mono text-[10px] font-bold"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {label}
        </div>
      )}

      {/* Bottom row: 2 holes with connecting line */}
      <div className="relative flex items-center" style={{ gap: `${horizontalSpacing}px` }}>
        <Hole size={holeSize} dataHoleId={holeIds[2]} />
        {/* Horizontal line connecting bottom holes */}
        <div
          className="absolute bg-neutral-500"
          style={{
            left: `${holeSize}px`,
            width: `${horizontalSpacing}px`,
            height: '2px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        />
        <Hole size={holeSize} dataHoleId={holeIds[3]} />
      </div>
    </div>
  );
}

export default React.memo(MatrixConnector);
