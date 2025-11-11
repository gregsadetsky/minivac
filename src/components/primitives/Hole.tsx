interface HoleProps {
  size?: number;
}

export default function Hole({ size = 10 }: HoleProps) {
  return (
    <div
      className="
        rounded-full
        bg-neutral-900
        border-2
        border-neutral-500
        shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)]
        cursor-pointer
        transition-all
        duration-150
        hover:border-neutral-400
        hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.2),0_0_8px_rgba(255,255,255,0.3)]
      "
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
}
