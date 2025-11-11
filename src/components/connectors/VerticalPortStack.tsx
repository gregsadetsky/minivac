import Hole from '../primitives/Hole';

interface PortRow {
  leftLabel?: string;      // Label on left side (like "16", "17")
  labelAfter?: string;     // Label that appears AFTER this row (like "RUN", "STOP")
}

interface VerticalPortStackProps {
  rows: PortRow[];         // Array of rows
  holeSize?: number;
  holeSpacing?: number;    // Horizontal spacing between 2 holes in a row
}

export default function VerticalPortStack({
  rows,
  holeSize = 10,
  holeSpacing = 6
}: VerticalPortStackProps) {
  return (
    <div className="flex flex-col">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex}>
          {/* Hole row */}
          <div className="flex items-center gap-3">
            {/* Left label */}
            {row.leftLabel && (
              <div className="text-neutral-300 font-mono text-[10px] font-bold w-4 text-right">
                {row.leftLabel}
              </div>
            )}
            {!row.leftLabel && <div className="w-4" />}

            {/* Two holes */}
            <div className="flex items-center" style={{ gap: `${holeSpacing}px` }}>
              <Hole size={holeSize} />
              <Hole size={holeSize} />
            </div>

            {/* Top bracket if there's a label after this row */}
            {row.labelAfter && (
              <div className="text-neutral-300 font-mono text-[10px] font-bold">┐</div>
            )}
          </div>

          {/* Label section (appears BETWEEN rows) */}
          {row.labelAfter && (
            <div className="flex items-center gap-3">
              <div className="w-4" />
              <div style={{ width: `${holeSize * 2 + holeSpacing}px` }} />
              <div className="flex flex-col items-center">
                <div className="text-neutral-300 font-mono text-[9px] font-bold tracking-wider">
                  {row.labelAfter}
                </div>
              </div>
            </div>
          )}

          {/* Bottom bracket row (if there's a label after this row) */}
          {row.labelAfter && (
            <div className="flex items-center gap-3" style={{ marginBottom: '-13px' }}>
              <div className="w-4" />
              <div style={{ width: `${holeSize * 2 + holeSpacing}px` }} />
              <div className="text-neutral-300 font-mono text-[10px] font-bold">┘</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
