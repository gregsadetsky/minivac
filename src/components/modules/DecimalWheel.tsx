import Hole from '../primitives/Hole';

interface DecimalWheelProps {
  diameter?: number;       // Outer diameter
  holeSize?: number;
  currentValue?: number;   // 0-15, for future pointer
  angle?: number;          // Rotation angle in degrees
}

export default function DecimalWheel({
  diameter = 240,
  holeSize = 10
}: DecimalWheelProps) {
  // Geometry measured on a real Minivac 601 (motor section 16x16cm):
  // hole-pair ring at R=4.7cm is the OUTERMOST feature, sitting on the bare panel
  // outside the outer circle (R≈4.3cm ≈ 0.9R). Numbers fill the band between the
  // outer circle and an inner circle around the knob (R≈2.2cm ≈ 0.46R).
  const centerX = diameter / 2;
  const centerY = diameter / 2;
  const holeRadius = diameter / 2 - holeSize / 2 - 1; // outermost: holes on the panel
  const outerRadius = holeRadius * 0.9;
  const innerRadius = holeRadius * 0.46;
  const labelRadius = (innerRadius + outerRadius) / 2;

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
    <div
      className="relative"
      style={{
        width: `${diameter}px`,
        height: `${diameter}px`
      }}
    >
      {/* SVG layer for circles and lines (rotating) and labels (stationary) */}
      <svg
        className="absolute top-0 left-0"
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
      >
        {/* Stationary group: circles, lines, and number labels */}
        <g>
          {/* Outer circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={outerRadius}
            fill="none"
            stroke="#c8c8c8"
            strokeWidth="2"
          />

          {/* Inner circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            fill="none"
            stroke="#c8c8c8"
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
                stroke="#c8c8c8"
                strokeWidth="1.5"
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
                fill="#e8e8e8"
                fontSize="16"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {i}
              </text>
            );
          })}
        </g>
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
          <Hole size={holeSize} dataHoleId={`D${hole.segment}`} />
        </div>
      ))}
    </div>
  );
}
