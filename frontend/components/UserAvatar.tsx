import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** Shades of grey only: people stay distinguishable without adding colors to the theme. */
const SHADES = ["#27272a", "#3f3f46", "#52525b", "#71717a", "#44403c", "#57534e"];

/** Same name → same shade, so the avatar stays recognizable across devices. */
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SHADES[Math.abs(hash) % SHADES.length];
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-white/10",
        className,
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initials(name)}
    </span>
  );
}
