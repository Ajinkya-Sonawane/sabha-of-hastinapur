"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-saffron text-ink hover:bg-gold active:translate-y-px disabled:bg-panel-2 disabled:text-muted",
  secondary:
    "border border-line bg-panel text-parchment hover:border-saffron/70 active:translate-y-px disabled:opacity-50",
  ghost: "text-muted underline-offset-4 hover:text-parchment hover:underline",
  danger: "border border-kaurava/60 bg-kaurava/10 text-kaurava hover:bg-kaurava/20",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-[52px] w-full rounded-2xl px-5 text-base font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

const BASE = "flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 text-base font-semibold uppercase tracking-[0.14em] transition";

export function LinkButton({ href, variant = "primary", children }: { href: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.3em] text-saffron ${className}`}>{children}</p>;
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-serif text-3xl leading-tight text-parchment ${className}`}>{children}</h1>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-panel/80 p-5 ${className}`}>{children}</div>;
}

export function Divider() {
  return <div aria-hidden className="my-6 h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" />;
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-1 flex-col gap-5 animate-rise ${className}`}>{children}</section>;
}

/** Pushes children to the bottom of the screen, within thumb reach. */
export function BottomActions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3 pt-4">{children}</div>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-kaurava/40 bg-kaurava/10 px-4 py-3 text-sm text-kaurava">
      {children}
    </p>
  );
}
