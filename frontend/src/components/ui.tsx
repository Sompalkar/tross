"use client";

import { useState, type ReactNode } from "react";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900">
      {children}
    </span>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-400 dark:text-slate-500">{children}</p>;
}

/**
 * LinkedIn image URLs are signed and expire, so there is nothing for Next's
 * image optimizer to do with them — a plain <img> is the honest choice here.
 * Expired or blocked URLs fall back to a neutral placeholder instead of
 * rendering a broken image.
 */
export function Thumb({
  src,
  alt,
  fallback,
  rounded = "rounded-lg",
  size = "h-12 w-12",
}: {
  src: string | null | undefined;
  alt: string;
  fallback?: string;
  rounded?: string;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${size} ${rounded} flex shrink-0 items-center justify-center bg-slate-200 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
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
      className={`${size} ${rounded} shrink-0 object-cover ring-1 ring-slate-200 dark:ring-slate-700`}
    />
  );
}
