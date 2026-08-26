"use client";

import { useState } from "react";
import { ProfileView } from "@/components/ProfileView";
import type { ProfileResult, ProfileSuccess } from "@/lib/types";

const EXAMPLE = "https://www.linkedin.com/in/ada-lovelace";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSuccess | null>(null);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as ProfileResult;

      if (result.success) setProfile(result);
      else setError(result.error.message);
    } catch {
      setError("The request failed. Check that the API is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          LinkedIn Profile API
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Paste a public LinkedIn profile URL. The API reads it through LinkedIn&apos;s
          internal Voyager endpoints and returns structured JSON.
        </p>
      </header>

      <form onSubmit={lookup} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={EXAMPLE}
          aria-label="LinkedIn profile URL"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Fetching…" : "Fetch profile"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setUrl(EXAMPLE)}
        className="mb-8 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
      >
        Use the example URL
      </button>

      {error && (
        <div
          role="alert"
          className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {loading && <SkeletonCard />}

      {profile && <ProfileView result={profile} />}
    </main>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
      <div className="h-24 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
