import { useState } from 'react';

interface PushButtonProps {
  size?: number;
  onPress?: () => void;
  onRelease?: () => void;
  pressed?: boolean; // External control of pressed state
}

export default function PushButton({
  size = 60,
  onPress,
  onRelease,
  pressed
}: PushButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  // Use external pressed state if provided, otherwise use internal state
  const actualPressed = pressed !== undefined ? pressed : isPressed;

  const handleMouseDown = () => {
    setIsPressed(true);
    onPress?.();
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    onRelease?.();
  };

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width: `${size}px`, height: `${size}px` }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isPressed && handleMouseUp()}
    >
      {/* Base/housing */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: '#1a1d24',
          boxShadow: `
            inset 0 3px 6px rgba(0,0,0,0.9),
            inset 0 -1px 2px rgba(255,255,255,0.1)
          `
        }}
      />

      {/* Button cap - concave appearance */}
      <div
        className="absolute rounded-full transition-all duration-100"
        style={{
          top: actualPressed ? '5px' : '3px',
          left: '3px',
          width: `${size - 6}px`,
          height: `${size - 6}px`,
          background: `radial-gradient(
            circle at 65% 65%,
            #8b1f1f 0%,
            #b92e2e 30%,
            #d24444 60%,
            #e85d5d 100%
          )`,
          boxShadow: actualPressed ? `
            0 2px 4px rgba(0,0,0,0.5),
            0 1px 2px rgba(0,0,0,0.3),
            inset 0 -1px 0 rgba(255,255,255,0.2),
            inset 0 3px 8px rgba(0,0,0,0.5)
          ` : `
            0 6px 12px rgba(0,0,0,0.5),
            0 2px 4px rgba(0,0,0,0.3),
            inset 0 -1px 0 rgba(255,255,255,0.3),
            inset 0 3px 10px rgba(0,0,0,0.4)
          `
        }}
      />
    </div>
  );
}
