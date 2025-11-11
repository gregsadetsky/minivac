import Hole from '../primitives/Hole';

interface PortPairProps {
  label?: string;           // Top label
  centerLabel?: string;     // Label below entire group (like "A")
  sublabels?: string[];     // Individual labels below each hole
  holeCount?: number;       // Number of holes (default 2)
  spacing?: number;         // Gap between holes
  holeSize?: number;
}

export default function PortPair({
  label = '',
  centerLabel = '',
  sublabels = [],
  holeCount = 2,
  spacing = 6,
  holeSize = 10
}: PortPairProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <div className="text-neutral-300 font-mono text-[9px] font-bold tracking-wider">
          {label}
        </div>
      )}
      <div className="flex items-center" style={{ gap: `${spacing}px` }}>
        {sublabels.length > 0 ? (
          sublabels.map((sublabel, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Hole size={holeSize} />
              {sublabel && (
                <div className="text-neutral-300 font-mono text-[10px] font-bold">
                  {sublabel}
                </div>
              )}
            </div>
          ))
        ) : (
          <>
            {Array.from({ length: holeCount }).map((_, i) => (
              <Hole key={i} size={holeSize} />
            ))}
          </>
        )}
      </div>
      {centerLabel && (
        <div className="text-neutral-300 font-mono text-[10px] font-bold">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
