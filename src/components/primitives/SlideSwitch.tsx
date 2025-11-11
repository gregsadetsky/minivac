import { useState } from 'react';

interface SlideSwitchProps {
  width?: number;
  height?: number;
  isRight?: boolean;
  onChange?: (isRight: boolean) => void;
}

export default function SlideSwitch({
  width = 50,
  height = 24,
  isRight: controlledIsRight,
  onChange
}: SlideSwitchProps) {
  const [internalIsRight, setInternalIsRight] = useState(false);

  // Use controlled if provided, otherwise use internal state
  const isRight = controlledIsRight !== undefined ? controlledIsRight : internalIsRight;

  const handleClick = () => {
    const newState = !isRight;
    if (controlledIsRight === undefined) {
      setInternalIsRight(newState);
    }
    onChange?.(newState);
  };

  const sliderWidth = width * 0.4;
  const sliderHeight = height * 0.85;
  const sliderLeftPos = isRight ? width - sliderWidth - 2 : 2;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={handleClick}
    >
      {/* Track/housing */}
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          background: 'linear-gradient(180deg, #0a0c10 0%, #1a1d24 50%, #0a0c10 100%)',
          borderRadius: '3px',
          boxShadow: `
            inset 0 2px 4px rgba(0,0,0,0.8),
            inset 0 -1px 2px rgba(0,0,0,0.5),
            0 1px 0 rgba(255,255,255,0.05)
          `
        }}
      />

      {/* Sliding button */}
      <div
        className="absolute transition-all duration-150"
        style={{
          top: `${(height - sliderHeight) / 2}px`,
          left: `${sliderLeftPos}px`,
          width: `${sliderWidth}px`,
          height: `${sliderHeight}px`,
          background: 'linear-gradient(180deg, #8b4a4a 0%, #b85d5d 30%, #c97070 50%, #b85d5d 70%, #8b4a4a 100%)',
          borderRadius: '2px',
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 2px 4px rgba(0,0,0,0.5)
          `
        }}
      >
        {/* Grooves for tactile feel */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: 0,
              left: `${3 + i * 3}px`,
              width: '1px',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)',
              boxShadow: '1px 0 0 rgba(255,255,255,0.1)'
            }}
          />
        ))}
      </div>
    </div>
  );
}
