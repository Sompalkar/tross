"use client";

import { useState } from "react";
import { ProfileView } from "@/components/ProfileView";
import { Label } from "@/components/ui";
import type { ProfileResult, ProfileSuccess } from "@/lib/types";

const EXAMPLES = ["williamhgates", "satyanadella"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSuccess | null>(null);

  async function lookup(value: string) {
    if (!value.trim() || loading) return;

    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
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

  // Not named `useExample`: a `use` prefix marks a function as a React hook,
  // and this is an ordinary event handler.
  function runExample(slug: string) {
    const example = `https://www.linkedin.com/in/${slug}`;
    setUrl(example);
    void lookup(example);
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-rule bg-ground/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex shrink-0 items-baseline gap-2">
            <span className="font-mono text-[13px] font-medium tracking-tight text-ink">
              profile-api
            </span>
            <span className="font-mono text-[11px] text-mute">v1</span>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(url);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="linkedin.com/in/…"
              aria-label="LinkedIn profile URL"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none placeholder:text-mute focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Fetching" : "Fetch"}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-24">
        {!profile && !loading && !error && (
          <Intro onPick={runExample} disabled={loading} />
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3.5"
          >
            <div className="mb-1">
              <Label>Request failed</Label>
            </div>
            <p className="text-[14px] leading-relaxed text-danger">{error}</p>
          </div>
        )}

        {loading && <Skeleton />}

        {profile && <ProfileView result={profile} />}
      </main>
    </div>
  );
}

function Intro({
  onPick,
  disabled,
}: {
  onPick: (slug: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-10 pt-6">
      <div className="flex flex-col gap-3">
        <h1 className="max-w-[20ch] font-serif text-[40px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[52px]">
          A LinkedIn profile, as structured JSON.
        </h1>
        <p className="max-w-[56ch] text-[16px] leading-relaxed text-soft">
          Paste a profile URL. The API reads the page the way LinkedIn&apos;s own
          mobile site does, then returns name, headline, location, about,
          experience, education, skills, certifications, languages and images.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Try one</Label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => onPick(slug)}
              disabled={disabled}
              className="rounded-lg border border-rule bg-surface px-3 py-1.5 font-mono text-[12px] text-soft transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
            >
              /in/{slug}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-rule pt-8">
        <div className="mb-3">
          <Label>Endpoint</Label>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-rule bg-raised p-4 font-mono text-[12px] leading-relaxed text-soft">
{`curl -G https://your-api.example.com/api/profile \\
  --data-urlencode "url=https://www.linkedin.com/in/williamhgates"`}
        </pre>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <div className="h-28 rounded-xl bg-raised sm:h-36" />
      <div className="-mt-14 px-1">
        <div className="size-[72px] rounded-2xl bg-raised ring-4 ring-ground sm:size-[88px]" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-9 w-56 rounded bg-raised" />
        <div className="h-4 w-80 max-w-full rounded bg-raised" />
        <div className="h-3 w-44 rounded bg-raised" />
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-rule pt-6">
        <div className="h-3 w-24 rounded bg-raised" />
        <div className="h-4 w-full rounded bg-raised" />
        <div className="h-4 w-4/5 rounded bg-raised" />
      </div>
    </div>
  );
}
