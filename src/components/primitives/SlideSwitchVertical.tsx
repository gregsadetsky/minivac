import React, { useState } from 'react';

interface SlideSwitchVerticalProps {
  width?: number;
  height?: number;
  isBottom?: boolean;
  onChange?: (isBottom: boolean) => void;
  disabled?: boolean;
}

function SlideSwitchVertical({
  width = 24,
  height = 50,
  isBottom: controlledIsBottom,
  onChange,
  disabled = false
}: SlideSwitchVerticalProps) {
  const [internalIsBottom, setInternalIsBottom] = useState(false);

  // Use controlled if provided, otherwise use internal state
  const isBottom = controlledIsBottom !== undefined ? controlledIsBottom : internalIsBottom;

  const handleMouseDown = () => {
    if (disabled) return;
    const newState = !isBottom;
    if (controlledIsBottom === undefined) {
      setInternalIsBottom(newState);
    }
    onChange?.(newState);
  };

  const sliderHeight = height * 0.4;
  const sliderWidth = width * 0.85;
  const sliderTopPos = isBottom ? height - sliderHeight - 2 : 2;

  return (
    <div
      className={`relative select-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onMouseDown={handleMouseDown}
    >
      {/* Track/housing */}
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          background: 'linear-gradient(90deg, #0a0c10 0%, #1a1d24 50%, #0a0c10 100%)',
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
        className="absolute transition-all duration-[30ms]"
        style={{
          top: `${sliderTopPos}px`,
          left: `${(width - sliderWidth) / 2}px`,
          width: `${sliderWidth}px`,
          height: `${sliderHeight}px`,
          background: 'linear-gradient(90deg, #8b4a4a 0%, #b85d5d 30%, #c97070 50%, #b85d5d 70%, #8b4a4a 100%)',
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
              top: `${3 + i * 3}px`,
              left: 0,
              width: '100%',
              height: '1px',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.1)'
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(SlideSwitchVertical);
