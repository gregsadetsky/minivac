import Hole from '../primitives/Hole';

interface DecimalWheelProps {
  diameter?: number;       // Outer diameter
  holeSize?: number;
  currentValue?: number;   // 0-15, for future pointer
}

export default function DecimalWheel({
  diameter = 240,
  holeSize = 10,
  currentValue = 0  // eslint-disable-line @typescript-eslint/no-unused-vars
}: DecimalWheelProps) {
  const centerX = diameter / 2;
  const centerY = diameter / 2;
  const outerRadius = diameter / 2 - 10;
  const innerRadius = diameter / 2 - 65;
  const holeRadius = outerRadius - 8; // Holes positioned on outer circle
  const labelRadius = outerRadius - 40; // Labels positioned between circles

  const segments = 16;
  const segmentAngle = 360 / segments;
  const holeOffset = 4; // Offset in degrees for the two holes in each segment

  // Generate hole positions
  const holes: Array<{ x: number; y: number; segment: number; index: number }> = [];

  for (let i = 0; i < segments; i++) {
    const baseAngle = i * segmentAngle - 90; // -90 to start at top

    // Two holes per segment
    const angle1 = (baseAngle - holeOffset) * Math.PI / 180;
    const angle2 = (baseAngle + holeOffset) * Math.PI / 180;

    holes.push({
      x: centerX + holeRadius * Math.cos(angle1),
      y: centerY + holeRadius * Math.sin(angle1),
      segment: i,
      index: 0
    });

    holes.push({
      x: centerX + holeRadius * Math.cos(angle2),
      y: centerY + holeRadius * Math.sin(angle2),
      segment: i,
      index: 1
    });
  }

  return (
    <div className="relative" style={{ width: `${diameter}px`, height: `${diameter}px` }}>
      {/* SVG layer for circles, lines, and labels */}
      <svg
        className="absolute top-0 left-0"
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
      >
        {/* Outer circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={outerRadius}
          fill="none"
          stroke="#888"
          strokeWidth="2"
        />

        {/* Inner circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={innerRadius}
          fill="none"
          stroke="#888"
          strokeWidth="2"
        />

        {/* Radial separator lines */}
        {Array.from({ length: segments }).map((_, i) => {
          // Shift by half a segment so lines are BETWEEN labels, not on them
          const angle = ((i + 0.5) * segmentAngle - 90) * Math.PI / 180;
          const x1 = centerX + innerRadius * Math.cos(angle);
          const y1 = centerY + innerRadius * Math.sin(angle);
          const x2 = centerX + outerRadius * Math.cos(angle);
          const y2 = centerY + outerRadius * Math.sin(angle);

          return (
            <line
              key={`line-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#888"
              strokeWidth="1"
            />
          );
        })}

        {/* Number labels */}
        {Array.from({ length: segments }).map((_, i) => {
          const angle = (i * segmentAngle - 90) * Math.PI / 180;
          const x = centerX + labelRadius * Math.cos(angle);
          const y = centerY + labelRadius * Math.sin(angle);

          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#d0d0d0"
              fontSize="14"
              fontFamily="'Courier New', monospace"
              fontWeight="bold"
            >
              {i}
            </text>
          );
        })}
      </svg>

      {/* HTML layer for holes (better for interaction) */}
      {holes.map((hole, idx) => (
        <div
          key={`hole-${idx}`}
          className="absolute"
          style={{
            left: `${hole.x - holeSize / 2}px`,
            top: `${hole.y - holeSize / 2}px`
          }}
        >
          <Hole size={holeSize} />
        </div>
      ))}
    </div>
  );
}
