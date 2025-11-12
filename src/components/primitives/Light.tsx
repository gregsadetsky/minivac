interface LightProps {
  size?: number;
  isOn?: boolean;
}

export default function Light({
  size = 40,
  isOn = false
}: LightProps) {

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
            top: '8px',
            left: '8px',
            width: '26px',
            height: '26px',
            background: '#0d0f13',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)'
          }}
        />
      </div>

      {/* The light bulb */}
      <div
        className="absolute rounded-full"
        style={{
          top: '10px',
          left: '10px',
          width: '22px',
          height: '22px',
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
            top: '4px',
            right: '6px',
            width: isOn ? '11px' : '7px',
            height: isOn ? '7px' : '5px',
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
              top: '-7px',
              left: '-7px',
              right: '-7px',
              bottom: '-7px',
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
