"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Material Design 3 primitives: buttons (filled, tonal, text, error),
 * cards (elevated, filled, outlined), type roles and layout helpers.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";

/** primary = filled, secondary = filled tonal, ghost = text, danger = error tonal */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-elevation-1 disabled:shadow-none",
  secondary: "bg-secondary-container text-on-secondary-container",
  ghost: "text-primary",
  danger: "bg-error-container text-on-error-container",
};

/** M3 common button: full shape, label-large. 48dp tall for a comfortable touch target. */
const BUTTON_BASE =
  "state-layer flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-medium tracking-[0.1px] transition-shadow disabled:cursor-not-allowed disabled:bg-on-surface/12 disabled:text-on-surface/38";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", children }: { href: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}

type CardVariant = "elevated" | "filled" | "outlined";

const CARDS: Record<CardVariant, string> = {
  elevated: "bg-surface-container-low shadow-elevation-1",
  filled: "bg-surface-container-highest",
  outlined: "border border-outline-variant bg-surface",
};

/** M3 card: medium shape (12dp), 16dp padding. */
export function Card({ variant = "filled", children, className = "" }: { variant?: CardVariant; children: ReactNode; className?: string }) {
  return <div className={`rounded-xl p-4 ${CARDS[variant]} ${className}`}>{children}</div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Card variant="elevated" className={className}>
      {children}
    </Card>
  );
}

/** Label-large in the primary colour: names the screen or section. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm font-medium tracking-[0.1px] text-primary ${className}`}>{children}</p>;
}

/** Headline-medium (28/36). */
export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-serif text-[28px] leading-9 text-on-surface ${className}`}>{children}</h1>;
}

/** Label-medium section label. */
export function Label({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={`text-xs font-medium tracking-[0.5px] text-on-surface-variant ${className}`}>
      {children}
    </p>
  );
}

export function Divider() {
  return <hr aria-hidden className="my-4 h-px w-full border-0 bg-outline-variant" />;
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-1 flex-col gap-4 animate-rise ${className}`}>{children}</section>;
}

/** Pushes children to the bottom of the screen, within thumb reach. */
export function BottomActions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 pt-4">{children}</div>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
      {children}
    </p>
  );
}
