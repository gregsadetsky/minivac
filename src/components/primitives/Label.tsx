interface LabelProps {
  text: string;
  rotation?: number; // Rotation in degrees
}

/**
 * Skeuomorphic label component that looks like a handwritten sticker
 */
export default function Label({ text, rotation = -2 }: LabelProps) {
  return (
    <div
      className="relative flex items-center justify-center py-2 px-4"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Sticker background - paper-like with shadow */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 50%, #fef08a 100%)',
          boxShadow:
            '0 2px 4px rgba(0,0,0,0.4), ' +
            '0 4px 8px rgba(0,0,0,0.2), ' +
            'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      />

      {/* Handwritten text with Sharpie-like appearance */}
      <div
        className="relative select-none"
        style={{
          fontFamily: '"Permanent Marker", "Marker Felt", "Comic Sans MS", cursive',
          fontSize: '16px',
          fontWeight: 'normal',
          color: '#1a1a1a',
          letterSpacing: '0.5px',
        }}
      >
        {text}
      </div>
    </div>
  );
}
