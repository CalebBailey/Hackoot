import { cn } from "@/lib/utils";

const AVATAR_COLOUR_CLASSES = [
  "bg-emerald-400/85 text-emerald-950 ring-emerald-200/45",
  "bg-sky-400/85 text-sky-950 ring-sky-200/45",
  "bg-amber-300/90 text-amber-950 ring-amber-100/45",
  "bg-rose-400/85 text-rose-950 ring-rose-200/45",
  "bg-violet-400/85 text-violet-950 ring-violet-200/45",
  "bg-cyan-300/90 text-cyan-950 ring-cyan-100/45",
];

type AvatarSize = "sm" | "md";

interface ParticipantAvatarProps {
  participantId: string;
  name: string;
  size?: AvatarSize;
  className?: string;
}

function toInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getAvatarColourClass(participantId: string, name: string): string {
  const key = participantId || name;
  const index = hashString(key) % AVATAR_COLOUR_CLASSES.length;
  return AVATAR_COLOUR_CLASSES[index];
}

export function ParticipantAvatar({
  participantId,
  name,
  size = "md",
  className,
}: ParticipantAvatarProps) {
  const sizeClasses = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase ring-1",
        sizeClasses,
        getAvatarColourClass(participantId, name),
        className
      )}
      title={name}
      aria-label={name}
    >
      {toInitials(name)}
    </div>
  );
}
