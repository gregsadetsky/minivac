import Hole from '../primitives/Hole';

interface TriplePortGroupProps {
  topRow?: React.ReactNode;  // Optional custom top row content
  bottomLabels?: [string?, string?, string?];  // Optional labels below each pair
  holeSize?: number;
  pairSpacing?: number;    // Spacing within each pair (between 2 holes)
  groupGap?: number;       // Spacing between the 3 pairs
}

export default function TriplePortGroup({
  topRow,
  bottomLabels,
  holeSize = 10,
  pairSpacing = 6,
  groupGap = 24
}: TriplePortGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Top row: Custom content if provided */}
      {topRow && (
        <div className="relative" style={{ height: '12px' }}>
          {topRow}
        </div>
      )}

      {/* Middle row: 6 holes in 3 pairs */}
      <div className="flex items-center" style={{ gap: `${groupGap}px` }}>
        {/* Pair 1 */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center" style={{ gap: `${pairSpacing}px` }}>
            <Hole size={holeSize} />
            <Hole size={holeSize} />
          </div>
          {bottomLabels?.[0] && (
            <div className="text-neutral-300 font-mono text-[10px] font-bold">
              {bottomLabels[0]}
            </div>
          )}
        </div>

        {/* Pair 2 */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center" style={{ gap: `${pairSpacing}px` }}>
            <Hole size={holeSize} />
            <Hole size={holeSize} />
          </div>
          {bottomLabels?.[1] && (
            <div className="text-neutral-300 font-mono text-[10px] font-bold">
              {bottomLabels[1]}
            </div>
          )}
        </div>

        {/* Pair 3 */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center" style={{ gap: `${pairSpacing}px` }}>
            <Hole size={holeSize} />
            <Hole size={holeSize} />
          </div>
          {bottomLabels?.[2] && (
            <div className="text-neutral-300 font-mono text-[10px] font-bold">
              {bottomLabels[2]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for the LIGHT/COIL bracket decorations
export function LightCoilDecorations() {
  return (
    <>
      {/* First bracket ┏ */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '10px', width: '8px' }}
      >
        ┏
      </div>

      {/* LIGHT label */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '24px', width: '30px' }}
      >
        <span className="mx-1 tracking-wider">LIGHT</span>
      </div>

      {/* Right bracket ┓ */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '58px', width: '8px' }}
      >
        ┓
      </div>

      {/* Left bracket ┏ */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '61px', width: '8px' }}
      >
        ┏
      </div>

      {/* COIL label */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '75px', width: '30px' }}
      >
        <span className="mx-1 tracking-wider">COIL</span>
      </div>

      {/* Right bracket ┓ */}
      <div
        className="absolute text-neutral-300 font-mono text-[9px] font-bold flex items-center justify-center"
        style={{ left: '110px', width: '8px' }}
      >
        ┓
      </div>
    </>
  );
}
