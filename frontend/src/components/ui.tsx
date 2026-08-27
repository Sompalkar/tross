"use client";

import { useState, type ReactNode } from "react";

/** Small uppercase monospace label. Used for section names and metadata. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-mute">
      {children}
    </span>
  );
}

/**
 * A section of the profile. Deliberately not a card — a labelled band with a
 * hairline above it reads as one continuous document rather than a pile of
 * floating boxes.
 */
export function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-6">
      <header className="mb-5 flex items-baseline gap-2">
        <Label>{title}</Label>
        {count !== undefined && count > 0 && (
          <span className="font-mono text-[11px] tabular-nums text-mute">
            {String(count).padStart(2, "0")}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Rows separated by hairlines rather than gaps. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>;
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-rule-soft py-4 first:pt-0 last:border-b-0 last:pb-0">
      {children}
    </li>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-rule bg-surface px-2.5 py-1 font-mono text-[12px] text-soft">
      {children}
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[12px] tabular-nums text-mute">{children}</p>;
}

/**
 * LinkedIn image URLs are signed and expire, so there is nothing for Next's
 * image optimizer to do with them. Expired or blocked URLs fall back to
 * initials rather than rendering a broken image.
 */
export function Thumb({
  src,
  alt,
  fallback,
  className = "size-10 rounded-lg",
}: {
  src: string | null | undefined;
  alt: string;
  fallback?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center border border-rule bg-raised font-mono text-[11px] text-mute`}
        aria-hidden
      >
        {fallback ?? ""}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${className} shrink-0 border border-rule object-cover`}
    />
  );
}
