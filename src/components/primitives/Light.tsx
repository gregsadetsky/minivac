import React from 'react';

interface LightProps {
  size?: number;
  isOn?: boolean;
}

function Light({
  size = 40,
  isOn = false
}: LightProps) {
  // Calculate scaled dimensions based on size (default 40px)
  // Special case for debug lights (size ~44): 8px shadow, 24px bulb
  // For sizes <= 30: use 0.1 ratio, for size 40: use custom values
  const shadowOffsetTop = size > 42 ? 8 : (size <= 30 ? size * 0.1 : 9);         // 8px for size 44, 3px for size 30, 9px for size 40
  const shadowOffsetLeft = size > 42 ? 8 : (size <= 30 ? size * 0.1 : 8);        // 8px for size 44, 3px for size 30, 8px for size 40
  const bulbOffset = size > 42 ? 8 : (size <= 30 ? size * 0.1 : size * 0.25);    // 8px for size 44, 3px for size 30, 10px for size 40
  const innerRingSize = size > 42 ? 28 : size * 0.65;   // 28px for size 44, 26px for size 40, 19.5px for size 30
  const bulbSize = size > 42 ? 24 : size * 0.55;        // 24px for size 44, 22px for size 40, 16.5px for size 30
  const highlightTop = size * 0.1;     // 4px for size 40, 3px for size 30
  const highlightRight = size * 0.15;  // 6px for size 40, 4.5px for size 30
  const highlightWidthOn = size > 42 ? 12 : size * 0.275;  // 12px for size 44, 11px for size 40
  const highlightWidthOff = size > 42 ? 8 : size * 0.175;  // 8px for size 44, 7px for size 40
  const highlightHeightOn = size > 42 ? 8 : size * 0.175;  // 8px for size 44, 7px for size 40
  const highlightHeightOff = size > 42 ? 6 : size * 0.125; // 6px for size 44, 5px for size 40
  const glowOffset = size > 42 ? 8 : size * 0.175;     // 8px for size 44, 7px for size 40

  return (
    <div
      className="relative select-none"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Housing/bezel */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: '#1a1d24',
          boxShadow: `
            inset 0 2px 4px rgba(0,0,0,0.9),
            inset 0 -1px 2px rgba(255,255,255,0.1),
            0 1px 2px rgba(0,0,0,0.5)
          `
        }}
      >
        {/* Inner ring for depth */}
        <div
          className="absolute rounded-full"
          style={{
            top: `${shadowOffsetTop}px`,
            left: `${shadowOffsetLeft}px`,
            width: `${innerRingSize}px`,
            height: `${innerRingSize}px`,
            background: '#0d0f13',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)'
          }}
        />
      </div>

      {/* The light bulb */}
      <div
        className="absolute rounded-full"
        style={{
          top: `${bulbOffset}px`,
          left: `${bulbOffset}px`,
          width: `${bulbSize}px`,
          height: `${bulbSize}px`,
          background: isOn ? `radial-gradient(
            circle at 35% 35%,
            #fff5f0 0%,
            #ffe4d0 15%,
            #ffb088 40%,
            #ff8855 60%,
            #ee6633 80%,
            #cc4422 100%
          )` : `radial-gradient(
            circle at 35% 35%,
            #4a3838 0%,
            #2d2020 50%,
            #1a1414 100%
          )`,
          boxShadow: isOn ? `
            0 0 10px rgba(255,100,50,0.6),
            0 0 20px rgba(255,100,50,0.3),
            inset 0 1px 2px rgba(255,255,255,0.4),
            inset 0 -1px 3px rgba(200,50,20,0.4)
          ` : `
            inset 0 1px 2px rgba(0,0,0,0.8),
            inset 0 -1px 1px rgba(255,255,255,0.05)
          `
        }}
      >
        {/* Glass highlight */}
        <div
          className="absolute rounded-full"
          style={{
            top: `${highlightTop}px`,
            right: `${highlightRight}px`,
            width: isOn ? `${highlightWidthOn}px` : `${highlightWidthOff}px`,
            height: isOn ? `${highlightHeightOn}px` : `${highlightHeightOff}px`,
            background: isOn ? `radial-gradient(
              ellipse at center,
              rgba(255,255,255,0.9) 0%,
              rgba(255,255,255,0.3) 50%,
              rgba(255,255,255,0) 70%
            )` : `radial-gradient(
              ellipse at center,
              rgba(255,255,255,0.2) 0%,
              rgba(255,255,255,0) 70%
            )`,
            transform: 'rotate(-25deg)'
          }}
        />

        {/* Glow effect when on */}
        {isOn && (
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              top: `-${glowOffset}px`,
              left: `-${glowOffset}px`,
              right: `-${glowOffset}px`,
              bottom: `-${glowOffset}px`,
              background: `radial-gradient(
                circle at center,
                rgba(255,120,80,0.3) 0%,
                rgba(255,120,80,0) 70%
              )`
            }}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(Light);
