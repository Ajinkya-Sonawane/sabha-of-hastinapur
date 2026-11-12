import { Faction, FACTION_PRESENTATION, ROLE_IDS, ROLE_PRESENTATION } from "@sabha/protocol";
import { FactionIcon } from "@/components/FactionBadge";
import { RoleCard } from "@/components/RoleCard";
import { LinkButton } from "@/components/ui";

const FACTION_ORDER = [Faction.DHARMA, Faction.KAURAVA, Faction.KURU, Faction.INDEPENDENT];

export const metadata = { title: "How to play · Sabha of Hastinapur" };

export default function HowToPlay() {
  return (
    <article className="flex flex-col gap-6 pb-8 animate-rise">
      <header>
        <p className="text-xs font-semibold tracking-wide text-saffron">How to play</p>
        <h1 className="mt-2 font-serif text-3xl">Players are people. Cards are identities.</h1>
      </header>

      <ol className="flex flex-col gap-4 text-[15px] leading-relaxed">
        <li>
          <strong className="text-parchment">1. The deal.</strong> Every player gets one secret card; three more lie face-down in the
          centre. Tap to reveal yours, then hide it.
        </li>
        <li>
          <strong className="text-parchment">2. The night.</strong> Your <em>starting</em> card decides what you may do. Some
          characters look at cards, some swap them, some protect. You never gain a new power from a card you receive.
        </li>
        <li>
          <strong className="text-parchment">3. The Sabha opens.</strong> Put the phones down and talk for five minutes. Claim,
          bluff, accuse.
        </li>
        <li>
          <strong className="text-parchment">4. Judgement.</strong> Everyone secretly votes. The player with the most votes is
          removed — and if the vote ties, <em>every</em> tied player is removed. Nobody votes, nobody falls.
        </li>
        <li>
          <strong className="text-parchment">5. Dawn.</strong> Your <em>final</em> card — whatever you hold after the night —
          decides your side and whether you won.
        </li>
      </ol>

      <section className="rounded-xl border border-line bg-panel/80 p-5 text-[15px] leading-relaxed">
        <h2 className="mb-2 font-serif text-xl">The two sides</h2>
        <p>
          <span aria-hidden>🔵</span> <strong>Dharma</strong> wins if at least one Kaurava Conspirator (Duryodhana, Shakuni,
          Dushasana, Ashwatthama) is removed. If no conspirator sits in the Sabha, Dharma wins if anyone is removed.
        </p>
        <p className="mt-2">
          <span aria-hidden>🔴</span> <strong>Kaurava</strong> wins if no Conspirator is removed. Karna is loyal to the
          Kauravas but is <em>not</em> a Conspirator — and he must survive too.
        </p>
        <p className="mt-2">
          <span aria-hidden>🟡</span> <strong>Kuru</strong> and <span aria-hidden>⚪</span> <strong>Independent</strong> characters
          each chase a personal goal.
        </p>
      </section>

      {FACTION_ORDER.map((faction) => (
        <section key={faction}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-medium tracking-[0.15px] text-on-surface">
            <FactionIcon faction={faction} /> {FACTION_PRESENTATION[faction].label}
          </h2>
          <ul className="flex flex-col gap-2">
            {ROLE_IDS.filter((r) => ROLE_PRESENTATION[r].faction === faction).map((r) => {
              return (
                <li key={r}>
                  <RoleCard role={r} deck={[]} variant="detail" />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-xs text-muted">
        Night order: Bhishma → Nakula &amp; Sahadeva → Shakuni → Krishna → Vidura → Draupadi → Drona → Arjuna → Sanjaya → Gandhari.
        All mechanics are game adaptations inspired by the Mahabharata, not claims about the epic.
      </p>

      <LinkButton href="/">Back</LinkButton>
    </article>
  );
}
