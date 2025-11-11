import { useState, useRef, useCallback, useEffect } from 'react';

interface RotaryKnobProps {
  size?: number;
  angle?: number;
  onChange?: (angle: number) => void;
  minAngle?: number;
  maxAngle?: number;
}

export default function RotaryKnob({
  size = 80,
  angle: controlledAngle,
  onChange,
  minAngle = 0,
  maxAngle = 360
}: RotaryKnobProps) {
  const [internalAngle, setInternalAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);

  const angle = controlledAngle !== undefined ? controlledAngle : internalAngle;

  const updateAngle = useCallback((clientX: number, clientY: number) => {
    if (!knobRef.current) return;

    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    let newAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (newAngle < 0) newAngle += 360;

    // Clamp angle if needed
    if (maxAngle < 360) {
      newAngle = Math.max(minAngle, Math.min(maxAngle, newAngle));
    }

    if (controlledAngle === undefined) {
      setInternalAngle(newAngle);
    }
    onChange?.(newAngle);
  }, [controlledAngle, onChange, minAngle, maxAngle]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateAngle(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      updateAngle(e.clientX, e.clientY);
    }
  }, [isDragging, updateAngle]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={knobRef}
      className="relative cursor-pointer select-none"
      style={{ width: `${size}px`, height: `${size}px` }}
      onMouseDown={handleMouseDown}
    >
      {/* Base/shadow */}
      <div
        className="absolute rounded-full"
        style={{
          top: '3px',
          left: '3px',
          width: `${size - 6}px`,
          height: `${size - 6}px`,
          background: 'rgba(0,0,0,0.5)',
          filter: 'blur(4px)'
        }}
      />

      {/* Knob body - flatter disc */}
      <div
        className="absolute rounded-full"
        style={{
          top: 0,
          left: 0,
          width: `${size}px`,
          height: `${size}px`,
          background: `radial-gradient(circle at 40% 35%,
            #b87070 0%,
            #964545 40%,
            #7d3030 70%,
            #5a2020 100%
          )`,
          boxShadow: `
            0 2px 6px rgba(0,0,0,0.6),
            inset 0 1px 2px rgba(255,255,255,0.15),
            inset 0 -1px 2px rgba(0,0,0,0.4)
          `,
          transform: `rotate(${angle}deg)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* Subtle top shine - more diffuse */}
        <div
          className="absolute rounded-full"
          style={{
            top: '20%',
            left: '30%',
            width: '35%',
            height: '30%',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 60%)'
          }}
        />

        {/* Pointer - large white triangle */}
        <div
          className="absolute"
          style={{
            top: '3%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: `${size * 0.18}px solid transparent`,
            borderRight: `${size * 0.18}px solid transparent`,
            borderBottom: `${size * 0.70}px solid #ffffff`,
            filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.5))'
          }}
        />
      </div>
    </div>
  );
}
