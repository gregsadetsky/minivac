interface CableProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  droop?: number; // How much the cable droops (default: auto-calculated)
  onClick?: () => void;
}

export default function Cable({
  startX,
  startY,
  endX,
  endY,
  color = '#d4af37', // Gold/brass color for classic wire
  droop,
  onClick
}: CableProps) {
  // Validate inputs
  if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
    console.error('Cable received NaN coordinates:', { startX, startY, endX, endY });
    return null;
  }

  // Calculate cable path with natural droop
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Don't render cables with zero or near-zero distance (prevents division by zero)
  if (distance < 0.1) {
    return null;
  }

  // Auto-calculate droop based on distance if not provided
  const droopAmount = droop ?? Math.min(distance * 0.3, 80);

  // Calculate control points for bezier curve
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Add droop in the perpendicular direction to make it sag naturally
  const perpX = -dy / distance;
  const perpY = dx / distance;

  const controlX = midX + perpX * droopAmount * 0.3;
  const controlY = midY + perpY * droopAmount * 0.3 + droopAmount;

  // Bounding box for SVG
  const minX = Math.min(startX, endX, controlX) - 10;
  const minY = Math.min(startY, endY, controlY) - 10;
  const maxX = Math.max(startX, endX, controlX) + 10;
  const maxY = Math.max(startY, endY, controlY) + 10;
  const width = maxX - minX;
  const height = maxY - minY;

  // Adjust coordinates relative to SVG viewBox
  const relStartX = startX - minX;
  const relStartY = startY - minY;
  const relEndX = endX - minX;
  const relEndY = endY - minY;
  const relControlX = controlX - minX;
  const relControlY = controlY - minY;

  const pathD = `M ${relStartX} ${relStartY} Q ${relControlX} ${relControlY} ${relEndX} ${relEndY}`;

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 1
      }}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Cable shadow for depth */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          transform: 'translate(1px, 2px)',
          filter: 'blur(2px)'
        }}
      />

      {/* Main cable body */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        className="transition-opacity"
        style={{ opacity: 0.7 }}
      />

      {/* Highlight on cable for 3D effect */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
        strokeLinecap="round"
        className="transition-opacity"
        style={{
          transform: 'translate(-0.5px, -0.5px)',
          opacity: 0.7
        }}
      />

      {/* Clickable wider path for easier clicking - hover brightens */}
      {onClick && (
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          strokeLinecap="round"
          className="cursor-pointer"
          style={{ pointerEvents: 'stroke' }}
          onClick={onClick}
          onMouseEnter={(e) => {
            const svg = e.currentTarget.parentElement;
            if (svg) {
              const paths = svg.querySelectorAll('path[stroke]:not([stroke="transparent"])');
              paths.forEach(path => {
                (path as SVGPathElement).style.opacity = '1';
              });
            }
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.parentElement;
            if (svg) {
              const paths = svg.querySelectorAll('path[stroke]:not([stroke="transparent"])');
              paths.forEach(path => {
                (path as SVGPathElement).style.opacity = '0.7';
              });
            }
          }}
        />
      )}
    </svg>
  );
}
