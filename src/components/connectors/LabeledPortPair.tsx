import Hole from '../primitives/Hole';

interface LabeledPortPairProps {
  leftLabel?: string;      // Label on left side (like "16")
  bottomLabel?: string;    // Label below holes (like "ARM")
  holeSize?: number;
  holeSpacing?: number;    // Horizontal spacing between 2 holes
}

export default function LabeledPortPair({
  leftLabel,
  bottomLabel,
  holeSize = 10,
  holeSpacing = 6
}: LabeledPortPairProps) {
  return (
    <div className="flex flex-col">
      {/* Hole row with left label */}
      <div className="flex items-center gap-3">
        {/* Left label */}
        {leftLabel && (
          <div className="text-neutral-300 font-mono text-[10px] font-bold w-4 text-right">
            {leftLabel}
          </div>
        )}
        {!leftLabel && <div className="w-4" />}

        {/* Two holes */}
        <div className="flex items-center" style={{ gap: `${holeSpacing}px` }}>
          <Hole size={holeSize} />
          <Hole size={holeSize} />
        </div>
      </div>

      {/* Bottom label */}
      {bottomLabel && (
        <div className="flex items-center gap-3 mt-1">
          <div className="w-4" />
          <div className="text-neutral-300 font-mono text-[10px] font-bold" style={{ paddingLeft: `${holeSpacing / 2}px` }}>
            {bottomLabel}
          </div>
        </div>
      )}
    </div>
  );
}
