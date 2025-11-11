import Hole from '../primitives/Hole';

interface MatrixConnector6Props {
  label?: string;          // Label at bottom (like "11")
  holeSize?: number;
  horizontalSpacing?: number;  // Spacing between left and right holes
  verticalSpacing?: number;    // Spacing between rows
}

export default function MatrixConnector6({
  label,
  holeSize = 10,
  horizontalSpacing = 12,
  verticalSpacing = 12
}: MatrixConnector6Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Main grid structure */}
      <div className="relative flex flex-col" style={{ gap: `${verticalSpacing}px` }}>
        {/* Top row: 2 holes with horizontal line */}
        <div className="relative flex items-center" style={{ gap: `${horizontalSpacing}px` }}>
          <Hole size={holeSize} />
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
          <Hole size={holeSize} />

          {/* Vertical lines from top to middle */}
          {/* Left vertical line */}
          <div
            className="absolute bg-neutral-500"
            style={{
              left: '4px',
              width: '2px',
              height: `${verticalSpacing}px`,
              top: `${holeSize}px`
            }}
          />
          {/* Right vertical line */}
          <div
            className="absolute bg-neutral-500"
            style={{
              left: '26px',
              width: '2px',
              height: `${verticalSpacing}px`,
              top: `${holeSize}px`
            }}
          />
        </div>

        {/* Middle row: 2 holes (no horizontal line) */}
        <div className="relative flex items-center" style={{ gap: `${horizontalSpacing}px` }}>
          <Hole size={holeSize} />
          <Hole size={holeSize} />

          {/* Vertical lines from middle to bottom */}
          {/* Left vertical line */}
          <div
            className="absolute bg-neutral-500"
            style={{
              left: '4px',
              width: '2px',
              height: `${verticalSpacing}px`,
              top: `${holeSize}px`
            }}
          />
          {/* Right vertical line */}
          <div
            className="absolute bg-neutral-500"
            style={{
              left: '26px',
              width: '2px',
              height: `${verticalSpacing}px`,
              top: `${holeSize}px`
            }}
          />
        </div>

        {/* Bottom row: 2 holes with horizontal line */}
        <div className="relative flex items-center" style={{ gap: `${horizontalSpacing}px` }}>
          <Hole size={holeSize} />
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
          <Hole size={holeSize} />
        </div>
      </div>

      {/* Bottom label */}
      {label && (
        <div className="text-neutral-300 font-mono text-[10px] font-bold">
          {label}
        </div>
      )}
    </div>
  );
}
