import type { ReactNode } from "react";
import type { RoleId } from "@sabha/protocol";
import { ROLE_PRESENTATION } from "@sabha/protocol";

/**
 * Flat, Material-style character portraits. Each figure is a shared bust
 * (shoulders, head) dressed with the attributes the character is known for.
 * Pure inline SVG: no network requests, scales to any size.
 */

type Hair = "short" | "long" | "bun" | "veil" | "none";
type Headgear = "crown" | "tallCrown" | "diadem" | "turban" | "helmet" | "peacock" | "headband" | "cap";
type Prop =
  | "mace"
  | "club"
  | "bow"
  | "bowArrow"
  | "dice"
  | "scales"
  | "flute"
  | "sword"
  | "scroll"
  | "shield"
  | "target"
  | "horse"
  | "orb"
  | "candle"
  | "spear";
type Halo = "sun" | "flame" | "stars" | "arrows" | "eye";

interface FigureSpec {
  skin: string;
  garment: string;
  accent: string;
  hair: Hair;
  hairColor?: string;
  beard?: "short" | "long" | "goatee";
  moustache?: boolean;
  headgear?: Headgear;
  brows?: "calm" | "stern" | "sly";
  mark?: "tilak" | "gem";
  blindfold?: boolean;
  earrings?: boolean;
  armor?: boolean;
  broad?: boolean;
  /** Shikhandi: the garment is split in two tones. */
  split?: string;
  halo?: Halo;
  prop?: Prop;
}

const GOLD = "#E9B949";
const GOLD_DARK = "#B8862B";
const STEEL = "#C9D1D9";
const STEEL_DARK = "#8B98A5";
const WOOD = "#8A5A33";
const INK = "#2B1D14";
const WHITE_HAIR = "#ECE6DA";
const BLACK_HAIR = "#2A1B14";

const SKIN = { fair: "#DDA775", tan: "#C98D5E", deep: "#A9713F" };

export const ROLE_FIGURES: Record<RoleId, FigureSpec> = {
  DURYODHANA: { skin: SKIN.tan, garment: "#8E2A2A", accent: GOLD, hair: "long", moustache: true, headgear: "tallCrown", brows: "stern", prop: "mace" },
  SHAKUNI: { skin: SKIN.fair, garment: "#5B2A4E", accent: "#C9A227", hair: "short", beard: "goatee", moustache: true, headgear: "turban", brows: "sly", prop: "dice" },
  DUSHASANA: { skin: SKIN.deep, garment: "#7A2E22", accent: "#D08A3C", hair: "short", moustache: true, headgear: "headband", brows: "stern", broad: true, prop: "club" },
  ASHWATTHAMA: { skin: SKIN.tan, garment: "#4A2F2A", accent: "#6FD3E8", hair: "long", beard: "short", brows: "stern", mark: "gem", halo: "flame", prop: "sword" },
  YUDHISHTHIRA: { skin: SKIN.fair, garment: "#2C5AA0", accent: GOLD, hair: "short", moustache: true, headgear: "crown", mark: "tilak", prop: "scales" },
  BHIMA: { skin: SKIN.tan, garment: "#1F6F78", accent: GOLD, hair: "short", moustache: true, headgear: "headband", brows: "stern", broad: true, prop: "mace" },
  ARJUNA: { skin: SKIN.tan, garment: "#2E6BC6", accent: GOLD, hair: "long", headgear: "diadem", prop: "bowArrow" },
  NAKULA: { skin: SKIN.fair, garment: "#3F7FBF", accent: "#EED9A0", hair: "long", headgear: "diadem", prop: "horse" },
  SAHADEVA: { skin: SKIN.fair, garment: "#3B5BA9", accent: "#C6A8F0", hair: "long", headgear: "diadem", halo: "stars", prop: "orb" },
  DRAUPADI: { skin: SKIN.tan, garment: "#B23A48", accent: "#F2B544", hair: "veil", headgear: "diadem", mark: "tilak", earrings: true, halo: "flame" },
  KRISHNA: { skin: "#4E7FCB", garment: "#E3B437", accent: "#2E8B57", hair: "long", headgear: "peacock", mark: "tilak", earrings: true, prop: "flute" },
  VIDURA: { skin: SKIN.fair, garment: "#6C7A5B", accent: "#E8DFC8", hair: "short", hairColor: "#8E8778", beard: "short", headgear: "cap", prop: "scroll" },
  KARNA: { skin: SKIN.tan, garment: "#C98A1B", accent: GOLD, hair: "long", moustache: true, earrings: true, armor: true, halo: "sun", prop: "bow" },
  BHISHMA: { skin: SKIN.fair, garment: "#D8D2C4", accent: STEEL, hair: "long", hairColor: WHITE_HAIR, beard: "long", headgear: "crown", halo: "arrows", prop: "shield" },
  DRONA: { skin: SKIN.fair, garment: "#B9A27A", accent: "#F1E7CF", hair: "bun", hairColor: WHITE_HAIR, beard: "long", mark: "tilak", prop: "target" },
  SANJAYA: { skin: SKIN.tan, garment: "#7A6A3A", accent: "#F3E3A1", hair: "short", moustache: true, headgear: "cap", halo: "eye", prop: "scroll" },
  SHIKHANDI: { skin: SKIN.tan, garment: "#5E6470", accent: STEEL, hair: "long", headgear: "helmet", split: "#8C5A7A", prop: "spear" },
  GANDHARI: { skin: SKIN.fair, garment: "#6A4C93", accent: "#E7DCF5", hair: "veil", headgear: "diadem", blindfold: true, earrings: true, prop: "candle" },
};

/** Rounded so server and client render byte-identical markup. */
const rd = (n: number) => Math.round(n * 100) / 100;

function haloLayer(kind: Halo | undefined, accent: string): ReactNode {
  switch (kind) {
    case "sun":
      return (
        <g>
          <circle cx="60" cy="46" r="36" fill="#F6C343" opacity="0.35" />
          <circle cx="60" cy="46" r="28" fill="#F6C343" opacity="0.45" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <line
                key={i}
                x1={rd(60 + Math.cos(a) * 39)}
                y1={rd(46 + Math.sin(a) * 39)}
                x2={rd(60 + Math.cos(a) * 46)}
                y2={rd(46 + Math.sin(a) * 46)}
                stroke="#F6C343"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case "flame":
      return (
        <g>
          <path d="M60 2 C80 22 96 40 90 64 C87 80 74 88 60 88 C46 88 33 80 30 64 C24 42 46 30 60 2Z" fill="#E8622C" opacity="0.75" />
          <path d="M60 18 C74 34 84 46 80 62 C78 74 70 80 60 80 C50 80 42 74 40 62 C36 48 50 38 60 18Z" fill="#F6A63A" opacity="0.8" />
        </g>
      );
    case "stars":
      return (
        <g fill={accent}>
          {[
            [20, 24, 5],
            [100, 18, 6],
            [30, 58, 3.5],
            [96, 50, 3.5],
            [16, 86, 3],
          ].map(([x, y, r], i) => (
            <path key={i} d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z`} />
          ))}
        </g>
      );
    case "arrows":
      return (
        <g stroke={STEEL_DARK} strokeWidth="2.5" strokeLinecap="round">
          {[-50, -30, -12, 12, 30, 50].map((deg, i) => {
            const a = ((deg - 90) * Math.PI) / 180;
            const x2 = rd(60 + Math.cos(a) * 56);
            const y2 = rd(92 + Math.sin(a) * 56);
            return (
              <g key={i}>
                <line x1={rd(60 + Math.cos(a) * 30)} y1={rd(92 + Math.sin(a) * 30)} x2={x2} y2={y2} />
                <circle cx={x2} cy={y2} r="2.6" fill={STEEL} stroke="none" />
              </g>
            );
          })}
        </g>
      );
    case "eye":
      return (
        <g>
          {[-40, -20, 0, 20, 40].map((deg, i) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={rd(60 + Math.cos(a) * 15)}
                y1={rd(12 + Math.sin(a) * 10)}
                x2={rd(60 + Math.cos(a) * 21)}
                y2={rd(12 + Math.sin(a) * 15)}
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          <path d="M44 13 C50 5 70 5 76 13 C70 21 50 21 44 13Z" fill="#FBF6E6" stroke={accent} strokeWidth="1.5" />
          <circle cx="60" cy="13" r="5" fill="#3B6FB6" />
          <circle cx="60" cy="13" r="2.2" fill={INK} />
        </g>
      );
    default:
      return null;
  }
}

function hairBack(spec: FigureSpec): ReactNode {
  const color = spec.hairColor ?? BLACK_HAIR;
  if (spec.hair === "long") return <path d="M40 52 C36 24 84 24 80 52 L85 90 C72 82 48 82 35 90Z" fill={color} />;
  if (spec.hair === "veil")
    return (
      <g>
        <path d="M33 104 C24 44 44 20 60 20 C76 20 96 44 87 104 C78 88 42 88 33 104Z" fill={spec.accent} />
        <path d="M33 104 C24 44 44 20 60 20 C52 30 40 50 41 96Z" fill="#000" opacity="0.12" />
      </g>
    );
  return null;
}

function hairFront(spec: FigureSpec): ReactNode {
  const color = spec.hairColor ?? BLACK_HAIR;
  switch (spec.hair) {
    case "none":
      return null;
    case "bun":
      return (
        <g fill={color}>
          <circle cx="60" cy="24" r="8" />
          <path d="M42.5 48 C41 28 79 28 77.5 48 C72 37 48 37 42.5 48Z" />
        </g>
      );
    case "veil":
      return <path d="M43 47 C44 31 58 31 60 36 C62 31 76 31 77 47 C72 39 64 37 60 37 C56 37 48 39 43 47Z" fill={color} />;
    default:
      return <path d="M42.5 48 C41 28 79 28 77.5 48 C72 37 48 37 42.5 48Z" fill={color} />;
  }
}

function headgear(kind: Headgear | undefined, accent: string): ReactNode {
  switch (kind) {
    case "crown":
      return (
        <g>
          <path d="M43 36 L46 21 L53 30 L60 17 L67 30 L74 21 L77 36Z" fill={GOLD} />
          <rect x="42" y="33" width="36" height="6" rx="2" fill={GOLD_DARK} />
          <circle cx="60" cy="36" r="2.4" fill="#D64545" />
          <circle cx="50" cy="36" r="1.6" fill="#3E8ED0" />
          <circle cx="70" cy="36" r="1.6" fill="#3E8ED0" />
        </g>
      );
    case "tallCrown":
      return (
        <g>
          <path d="M42 36 L44 16 L52 27 L60 8 L68 27 L76 16 L78 36Z" fill={GOLD} />
          <circle cx="60" cy="8" r="3" fill="#D64545" />
          <circle cx="44" cy="16" r="2" fill={GOLD_DARK} />
          <circle cx="76" cy="16" r="2" fill={GOLD_DARK} />
          <rect x="41" y="32" width="38" height="7" rx="2" fill={GOLD_DARK} />
          <path d="M57 35.5 L60 32.5 L63 35.5 L60 38.5Z" fill="#D64545" />
        </g>
      );
    case "diadem":
      return (
        <g>
          <path d="M43 39 C50 31 70 31 77 39 L77 43 C70 36 50 36 43 43Z" fill={GOLD} />
          <path d="M57 35 L60 30 L63 35 L60 39Z" fill={accent} stroke={GOLD_DARK} strokeWidth="0.8" />
        </g>
      );
    case "turban":
      return (
        <g>
          <path d="M39 42 C35 16 85 16 81 42 C72 33 48 33 39 42Z" fill={accent} />
          <path d="M43 34 C52 26 68 24 79 30 M41 39 C52 30 70 29 80 36" stroke="#000" strokeOpacity="0.18" strokeWidth="1.6" fill="none" />
          <circle cx="60" cy="27" r="3.2" fill="#D64545" stroke={GOLD} strokeWidth="1.2" />
          <path d="M60 23 C58 14 62 10 66 8 C65 14 64 18 62 23Z" fill="#F4EBDD" />
        </g>
      );
    case "helmet":
      return (
        <g>
          <path d="M41 44 C40 16 80 16 79 44 C72 38 48 38 41 44Z" fill={STEEL} />
          <path d="M41 44 C40 16 60 16 60 18 L60 40 C52 40 46 41 41 44Z" fill="#fff" opacity="0.25" />
          <rect x="58" y="6" width="4" height="13" rx="2" fill={STEEL_DARK} />
          <path d="M60 2 C66 4 68 9 62 12 C63 8 62 5 60 2Z" fill="#D64545" />
          <rect x="58" y="38" width="4" height="12" rx="1.5" fill={STEEL_DARK} />
          <path d="M41 43 L41 58 L45 60 L45 44Z M79 43 L79 58 L75 60 L75 44Z" fill={STEEL_DARK} />
        </g>
      );
    case "peacock":
      return (
        <g>
          <path d="M44 38 L47 26 L54 33 L60 24 L66 33 L73 26 L76 38Z" fill={GOLD} />
          <rect x="43" y="35" width="34" height="5" rx="2" fill={GOLD_DARK} />
          <path d="M62 30 C63 20 66 12 70 6" stroke="#2E8B57" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="71" cy="10" rx="7" ry="10" fill="#2E8B57" transform="rotate(20 71 10)" />
          <ellipse cx="71.5" cy="9" rx="4.4" ry="6.4" fill="#2BB3A3" transform="rotate(20 71.5 9)" />
          <ellipse cx="72" cy="8" rx="2.4" ry="3.4" fill="#27408B" transform="rotate(20 72 8)" />
        </g>
      );
    case "headband":
      return (
        <g>
          <rect x="42.5" y="38" width="35" height="5" rx="2" fill={accent} />
          <path d="M77 40 L86 37 L84 43 L88 47 L78 44Z" fill={accent} />
        </g>
      );
    case "cap":
      return <path d="M42 41 C42 22 78 22 78 41 C70 36 50 36 42 41Z" fill={accent} />;
    default:
      return null;
  }
}

function propLayer(kind: Prop | undefined, accent: string): ReactNode {
  switch (kind) {
    case "mace":
      return (
        <g>
          <line x1="94" y1="118" x2="100" y2="70" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
          <circle cx="101" cy="58" r="13" fill={GOLD} />
          <path d="M101 45 V71 M88 58 H114 M92 49 L110 67 M110 49 L92 67" stroke={GOLD_DARK} strokeWidth="2" />
          <circle cx="101" cy="58" r="4.5" fill={GOLD_DARK} />
          <path d="M97 46 L101 37 L105 46Z" fill={GOLD_DARK} />
        </g>
      );
    case "club":
      return (
        <g>
          <path d="M92 118 L96 84 C90 76 92 62 100 60 C109 60 112 76 105 85 L101 118Z" fill={WOOD} />
          {[
            [95, 70],
            [106, 72],
            [100, 64],
            [100, 78],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2" fill={STEEL} />
          ))}
        </g>
      );
    case "bow":
    case "bowArrow":
      return (
        <g>
          <path d="M24 116 C4 90 4 54 24 28" stroke={WOOD} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <line x1="24" y1="116" x2="24" y2="28" stroke="#F4EBDD" strokeWidth="1.4" />
          <path d="M22 30 L27 24 M22 114 L27 120" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          {kind === "bowArrow" && (
            <g>
              <line x1="6" y1="72" x2="40" y2="72" stroke={STEEL} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M2 72 L10 67 L10 77Z" fill={STEEL} />
              <path d="M40 72 L46 67 M40 72 L46 77 M36 72 L42 67 M36 72 L42 77" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )}
        </g>
      );
    case "dice":
      return (
        <g>
          <g transform="rotate(-14 92 96)">
            <rect x="82" y="86" width="20" height="20" rx="4" fill="#F7F1E3" stroke="#00000030" />
            <circle cx="87" cy="91" r="1.8" fill={INK} />
            <circle cx="92" cy="96" r="1.8" fill={INK} />
            <circle cx="97" cy="101" r="1.8" fill={INK} />
          </g>
          <g transform="rotate(12 106 106)">
            <rect x="98" y="98" width="17" height="17" rx="3.5" fill="#F7F1E3" stroke="#00000030" />
            <circle cx="102.5" cy="102.5" r="1.6" fill="#B3261E" />
            <circle cx="110.5" cy="110.5" r="1.6" fill="#B3261E" />
            <circle cx="110.5" cy="102.5" r="1.6" fill="#B3261E" />
            <circle cx="102.5" cy="110.5" r="1.6" fill="#B3261E" />
          </g>
        </g>
      );
    case "scales":
      return (
        <g stroke={GOLD} strokeLinecap="round" fill="none">
          <line x1="99" y1="62" x2="99" y2="116" strokeWidth="3" />
          <line x1="84" y1="68" x2="114" y2="68" strokeWidth="3" />
          <path d="M84 68 L79 86 M84 68 L89 86 M114 68 L109 86 M114 68 L119 86" strokeWidth="1.3" />
          <path d="M77 86 H91 C91 92 77 92 77 86Z M107 86 H121 C121 92 107 92 107 86Z" fill={GOLD} stroke="none" />
          <circle cx="99" cy="61" r="3.4" fill={GOLD} stroke="none" />
          <line x1="91" y1="116" x2="107" y2="116" strokeWidth="3.4" />
        </g>
      );
    case "flute":
      return (
        <g>
          <line x1="64" y1="82" x2="114" y2="66" stroke={WOOD} strokeWidth="6" strokeLinecap="round" />
          <line x1="64" y1="82" x2="114" y2="66" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
          {[80, 88, 96, 104].map((x, i) => (
            <circle key={i} cx={x} cy={82 - (x - 64) * 0.32} r="1.5" fill={INK} />
          ))}
          <path d="M110 66 L118 62 M112 70 L119 72" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "sword":
      return (
        <g>
          <path d="M97 100 L102 46 L106 40 L108 47 L104 101Z" fill={STEEL} />
          <path d="M102 46 L106 40 L105 100 L100.5 100Z" fill="#fff" opacity="0.3" />
          <rect x="90" y="99" width="21" height="5" rx="2" fill={GOLD} transform="rotate(5 100 101)" />
          <rect x="97" y="104" width="6" height="13" rx="2" fill={WOOD} transform="rotate(5 100 110)" />
          <circle cx="99" cy="118" r="3" fill={accent} />
        </g>
      );
    case "scroll":
      return (
        <g>
          <rect x="82" y="88" width="30" height="22" fill="#F1E3BF" />
          <rect x="79" y="85" width="36" height="6" rx="3" fill="#D9C28C" />
          <rect x="79" y="107" width="36" height="6" rx="3" fill="#D9C28C" />
          <path d="M87 96 H107 M87 100 H104 M87 104 H106" stroke="#7A6542" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
    case "shield":
      return (
        <g>
          <circle cx="97" cy="98" r="19" fill={STEEL_DARK} />
          <circle cx="97" cy="98" r="15" fill={STEEL} />
          <circle cx="97" cy="98" r="5.5" fill={GOLD} />
          <path d="M97 83 V93 M97 103 V113 M82 98 H92 M102 98 H112" stroke={STEEL_DARK} strokeWidth="2" />
        </g>
      );
    case "target":
      return (
        <g>
          <circle cx="98" cy="96" r="18" fill="#F4EBDD" />
          <circle cx="98" cy="96" r="12.5" fill="#D64545" />
          <circle cx="98" cy="96" r="7.5" fill="#F4EBDD" />
          <circle cx="98" cy="96" r="3" fill="#D64545" />
          <line x1="98" y1="96" x2="116" y2="74" stroke={WOOD} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M116 74 L112 72 M116 74 L118 78 M113 78 L109 76 M113 78 L115 82" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "horse":
      return (
        <g>
          <path d="M86 118 L87 100 C85 88 91 78 100 74 L103 65 L107 74 C114 79 117 90 115 99 L108 96 C105 100 105 108 109 118Z" fill={accent} />
          <path d="M100 74 C94 80 91 90 92 100 L87 100 C85 88 91 78 100 74Z" fill="#7A5A3A" />
          <circle cx="107" cy="85" r="1.8" fill={INK} />
          <path d="M112 97 L115 99" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case "orb":
      return (
        <g>
          <circle cx="97" cy="97" r="15" fill="#7C5CC4" />
          <circle cx="97" cy="97" r="15" fill={accent} opacity="0.35" />
          <path d="M88 91 C90 86 95 84 99 85" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M97 90 L98.6 95.4 L104 97 L98.6 98.6 L97 104 L95.4 98.6 L90 97 L95.4 95.4Z" fill="#FBF6E6" />
          <path d="M84 112 H110 L106 118 H88Z" fill={GOLD_DARK} />
        </g>
      );
    case "candle":
      return (
        <g>
          <path d="M98 66 C104 74 104 80 98 82 C92 80 92 74 98 66Z" fill="#F6A63A" />
          <path d="M98 72 C101 76 101 79 98 80 C95 79 95 76 98 72Z" fill="#FBE7A1" />
          <rect x="93" y="84" width="10" height="26" rx="2" fill="#F4EBDD" />
          <path d="M86 110 H110 L106 117 H90Z" fill={GOLD_DARK} />
        </g>
      );
    case "spear":
      return (
        <g>
          <line x1="100" y1="118" x2="100" y2="34" stroke={WOOD} strokeWidth="4" strokeLinecap="round" />
          <path d="M100 8 L107 30 L100 36 L93 30Z" fill={STEEL} />
          <path d="M100 8 L100 36 L93 30Z" fill="#fff" opacity="0.3" />
          <rect x="95" y="34" width="10" height="4" rx="1.5" fill={accent} />
        </g>
      );
    default:
      return null;
  }
}

function face(spec: FigureSpec): ReactNode {
  const hair = spec.hairColor ?? BLACK_HAIR;
  const brows =
    spec.brows === "stern"
      ? ["M48.5 43.5 L56.5 46", "M63.5 46 L71.5 43.5"]
      : spec.brows === "sly"
        ? ["M48.5 46 L56.5 43", "M63.5 44.5 L71.5 45.5"]
        : ["M49 45 Q53 43 57 45", "M63 45 Q67 43 71 45"];
  return (
    <g>
      {spec.beard === "long" && <path d="M43.5 55 C41 80 52 100 60 103 C68 100 79 80 76.5 55 C72 65 48 65 43.5 55Z" fill={hair} />}
      {spec.beard === "short" && <path d="M43.5 55 C44 72 52 77 60 77 C68 77 76 72 76.5 55 C72 65 48 65 43.5 55Z" fill={hair} />}
      {spec.beard === "goatee" && <path d="M54 66 C55 78 58 84 60 86 C62 84 65 78 66 66 C63 69 57 69 54 66Z" fill={hair} />}
      {spec.blindfold ? (
        <g>
          <path d="M78 47 L88 52 L84 56 L90 62" stroke="#F4EBDD" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="42.5" y="44" width="35" height="9" rx="2.5" fill="#F4EBDD" />
          <path d="M44 48.5 H76" stroke="#00000022" strokeWidth="1" />
        </g>
      ) : (
        <g>
          <path d={brows[0]} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d={brows[1]} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="53" cy="50" rx="2" ry="2.3" fill={INK} />
          <ellipse cx="67" cy="50" rx="2" ry="2.3" fill={INK} />
        </g>
      )}
      <path d="M60 51 L58.4 57.5 H61.6" stroke="#00000030" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {spec.moustache ? (
        <path d="M49.5 61.5 C54 57.5 58 58.5 60 60.5 C62 58.5 66 57.5 70.5 61.5 C66 64 62 63 60 62 C58 63 54 64 49.5 61.5Z" fill={hair} />
      ) : (
        <path d={spec.beard ? "M56 62.5 H64" : "M55.5 61.5 Q60 65 64.5 61.5"} stroke={spec.beard ? "#00000050" : "#7A3B2E"} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
      {spec.mark === "tilak" && <path d="M60 37 C61.4 39.5 61.4 42 60 43.5 C58.6 42 58.6 39.5 60 37Z" fill="#D64545" />}
      {spec.mark === "gem" && (
        <g>
          <path d="M60 34 L64 39 L60 44 L56 39Z" fill={spec.accent} stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" />
          <path d="M60 34 L60 44 L56 39Z" fill="#fff" opacity="0.35" />
        </g>
      )}
    </g>
  );
}

export function RoleFigure({ role, className = "", title }: { role: RoleId; className?: string; title?: string }) {
  const spec = ROLE_FIGURES[role];
  const shoulders = spec.broad ? "M8 120 C8 90 34 80 60 80 C86 80 112 90 112 120Z" : "M18 120 C18 92 38 82 60 82 C82 82 102 92 102 120Z";
  const label = title ?? `${ROLE_PRESENTATION[role].name}, ${ROLE_PRESENTATION[role].title}`;
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMax meet">
      {haloLayer(spec.halo, spec.accent)}
      {hairBack(spec)}
      <path d={shoulders} fill={spec.garment} />
      {spec.split && <path d="M60 82 C82 82 102 92 102 120 H60Z" fill={spec.split} />}
      {spec.armor ? (
        <g>
          <path d="M34 120 C34 100 44 88 60 88 C76 88 86 100 86 120Z" fill={GOLD} />
          <path d="M40 104 H80 M38 112 H82 M60 88 V120" stroke={GOLD_DARK} strokeWidth="1.6" />
          <circle cx="60" cy="100" r="5" fill="#F6C343" stroke={GOLD_DARK} strokeWidth="1.4" />
        </g>
      ) : (
        <g>
          <path d="M46 84 C50 96 70 96 74 84 L78 86 C72 102 48 102 42 86Z" fill={spec.accent} opacity="0.9" />
          <circle cx="60" cy="98" r="3" fill={spec.accent} />
        </g>
      )}
      <rect x="53" y="64" width="14" height="22" rx="6" fill={spec.skin} />
      <rect x="53" y="64" width="14" height="12" fill="#000" opacity="0.14" />
      <ellipse cx="42.5" cy="52" rx="3" ry="5" fill={spec.skin} />
      <ellipse cx="77.5" cy="52" rx="3" ry="5" fill={spec.skin} />
      {spec.earrings && (
        <g fill={GOLD}>
          <circle cx="42" cy="60" r="3.2" />
          <circle cx="78" cy="60" r="3.2" />
        </g>
      )}
      <ellipse cx="60" cy="50" rx="17" ry="20.5" fill={spec.skin} />
      {face(spec)}
      {hairFront(spec)}
      {headgear(spec.headgear, spec.accent)}
      {propLayer(spec.prop, spec.accent)}
    </svg>
  );
}
