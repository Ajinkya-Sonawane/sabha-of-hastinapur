import type { PublicPlayer } from "@sabha/protocol";

const TONES = ["bg-saffron/20 text-saffron", "bg-dharma/20 text-dharma", "bg-kuru/20 text-kuru", "bg-kaurava/20 text-error", "bg-neutral/20 text-neutral"];

export function PlayerAvatar({ player, size = "md" }: { player: Pick<PublicPlayer, "displayName" | "seat">; size?: "sm" | "md" }) {
  const initials = player.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dims = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${TONES[player.seat % TONES.length]}`}>
      {initials}
    </span>
  );
}
