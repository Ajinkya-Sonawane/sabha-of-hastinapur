import type { RoleId } from "@sabha/protocol";
import { RoleFigure } from "@/components/RoleFigure";
import { LinkButton } from "@/components/ui";

const HERO: { role: RoleId; tone: string; tilt: string }[] = [
  { role: "DURYODHANA", tone: "bg-kaurava-container", tilt: "-rotate-6 translate-y-2" },
  { role: "KRISHNA", tone: "bg-dharma-container", tilt: "z-10 -translate-y-1 shadow-elevation-3" },
  { role: "BHISHMA", tone: "bg-kuru-container", tilt: "rotate-6 translate-y-2" },
];

export default function Landing() {
  return (
    <section className="flex flex-1 flex-col animate-rise">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div aria-hidden className="mb-8 flex items-end justify-center -space-x-3">
          {HERO.map(({ role, tone, tilt }) => (
            <div key={role} className={`h-36 w-24 overflow-hidden rounded-xl shadow-elevation-2 ${tone} ${tilt}`}>
              <RoleFigure role={role} className="h-full w-full" />
            </div>
          ))}
        </div>
        <p className="text-sm font-medium tracking-[0.1px] text-primary">Sabha of</p>
        <h1 className="font-serif text-[57px] leading-[64px] text-on-surface">Hastinapur</h1>
        <p className="mt-4 max-w-[320px] text-base leading-6 tracking-[0.5px] text-on-surface-variant">
          One night of court intrigue. Cards move in the dark. At dawn, the Sabha must judge.
        </p>
        <p className="mt-2 text-sm tracking-[0.25px] text-on-surface-variant">5–10 players · one phone each</p>
      </div>
      <nav className="flex flex-col gap-2">
        <LinkButton href="/create">Create Sabha</LinkButton>
        <LinkButton href="/join" variant="secondary">
          Join Sabha
        </LinkButton>
        <LinkButton href="/how-to-play" variant="ghost">
          How to play
        </LinkButton>
      </nav>
      <p className="mt-4 text-center text-xs leading-4 tracking-[0.4px] text-on-surface-variant">
        Inspired by the Mahabharata. All mechanics are game adaptations, not canonical claims.
      </p>
    </section>
  );
}
