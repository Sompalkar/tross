import type { LinkedInProfile, ProfileSuccess } from "@/lib/types";
import { Empty, Meta, Pill, Section, Thumb } from "./ui";

export function ProfileView({ result }: { result: ProfileSuccess }) {
  const profile = result.data;

  return (
    <div className="space-y-6">
      <MetaBar result={result} />
      <Header profile={profile} />

      {profile.summary && (
        <Section title="About">
          <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">
            {profile.summary}
          </p>
        </Section>
      )}

      <Section title="Experience" count={profile.experience.length}>
        {profile.experience.length === 0 ? (
          <Empty>Nothing listed.</Empty>
        ) : (
          <ol className="space-y-6">
            {profile.experience.map((position, index) => (
              <li key={index} className="flex gap-4">
                <Thumb
                  src={position.companyLogo?.original}
                  alt=""
                  fallback={initials(position.companyName)}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {position.title ?? "—"}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {position.companyLinkedInUrl && position.companyName ? (
                      <a
                        className="hover:underline"
                        href={position.companyLinkedInUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {position.companyName}
                      </a>
                    ) : (
                      position.companyName
                    )}
                    {position.employmentType && ` · ${position.employmentType}`}
                  </p>
                  <Meta>
                    {[position.dateRange?.text, position.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </Meta>
                  {position.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
                      {position.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Education" count={profile.education.length}>
        {profile.education.length === 0 ? (
          <Empty>Nothing listed.</Empty>
        ) : (
          <ol className="space-y-6">
            {profile.education.map((school, index) => (
              <li key={index} className="flex gap-4">
                <Thumb
                  src={school.schoolLogo?.original}
                  alt=""
                  fallback={initials(school.schoolName)}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {school.schoolName ?? "—"}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {[school.degreeName, school.fieldOfStudy].filter(Boolean).join(", ")}
                  </p>
                  <Meta>
                    {[school.dateRange?.text, school.grade && `Grade: ${school.grade}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Meta>
                  {school.activities && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {school.activities}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Skills" count={profile.skills.length}>
          {profile.skills.length === 0 ? (
            <Empty>Nothing listed.</Empty>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <Pill key={skill.name}>
                  {skill.name}
                  {skill.endorsementCount ? ` · ${skill.endorsementCount}` : ""}
                </Pill>
              ))}
            </div>
          )}
        </Section>

        <Section title="Languages" count={profile.languages.length}>
          {profile.languages.length === 0 ? (
            <Empty>Nothing listed.</Empty>
          ) : (
            <ul className="space-y-2">
              {profile.languages.map((language, index) => (
                <li key={index} className="text-slate-700 dark:text-slate-300">
                  {language.name}
                  {language.proficiency && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      — {language.proficiency}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Certifications" count={profile.certifications.length}>
        {profile.certifications.length === 0 ? (
          <Empty>Nothing listed.</Empty>
        ) : (
          <ul className="space-y-4">
            {profile.certifications.map((certification, index) => (
              <li key={index}>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {certification.url ? (
                    <a
                      className="hover:underline"
                      href={certification.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {certification.name}
                    </a>
                  ) : (
                    certification.name
                  )}
                </p>
                <Meta>
                  {[certification.authority, certification.dateRange?.start?.text]
                    .filter(Boolean)
                    .join(" · ")}
                </Meta>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {profile.projects.length > 0 && (
        <Section title="Projects" count={profile.projects.length}>
          <ul className="space-y-4">
            {profile.projects.map((project, index) => (
              <li key={index}>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {project.title}
                </p>
                <Meta>{project.dateRange?.text}</Meta>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {project.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.volunteerExperience.length > 0 && (
        <Section title="Volunteering" count={profile.volunteerExperience.length}>
          <ul className="space-y-4">
            {profile.volunteerExperience.map((entry, index) => (
              <li key={index}>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {entry.role} · {entry.companyName}
                </p>
                <Meta>{[entry.dateRange?.text, entry.cause].filter(Boolean).join(" · ")}</Meta>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Raw JSON">
        <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-200">
          {JSON.stringify(result, null, 2)}
        </pre>
      </Section>
    </div>
  );
}

function MetaBar({ result }: { result: ProfileSuccess }) {
  const { meta } = result;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
        source: {meta.source}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
        {meta.cached ? "served from cache" : "fresh"}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
        {meta.durationMs} ms
      </span>
    </div>
  );
}

function Header({ profile }: { profile: LinkedInProfile }) {
  const cover = profile.backgroundPicture?.original;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* The gradient stays behind the cover image, so an expired LinkedIn
          URL degrades to a plain banner rather than an empty grey strip. */}
      <div
        className="h-28 bg-gradient-to-r from-sky-500 to-indigo-500 bg-cover bg-center"
        style={
          cover
            ? {
                backgroundImage: `url(${cover}), linear-gradient(to right, #0ea5e9, #6366f1)`,
              }
            : undefined
        }
      />
      <div className="px-6 pb-6">
        <div className="-mt-12 mb-4">
          <Thumb
            src={profile.profilePicture?.original}
            alt={profile.fullName ?? "Profile picture"}
            fallback={initials(profile.fullName)}
            rounded="rounded-full"
            size="h-24 w-24 text-xl ring-4 ring-white dark:ring-slate-900"
          />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {profile.fullName ?? "Unknown"}
        </h1>
        {profile.headline && (
          <p className="mt-1 text-slate-700 dark:text-slate-300">{profile.headline}</p>
        )}
        <Meta>
          {[profile.location.full, profile.industry].filter(Boolean).join(" · ")}
        </Meta>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {profile.connectionsCount !== null && (
            <Pill>{formatCount(profile.connectionsCount)}+ connections</Pill>
          )}
          {profile.followersCount !== null && (
            <Pill>{formatCount(profile.followersCount)} followers</Pill>
          )}
          {profile.isOpenToWork && <Pill>Open to work</Pill>}
          {profile.isHiring && <Pill>Hiring</Pill>}
        </div>
        {profile.profileUrl && (
          <a
            className="mt-4 inline-block text-sm text-sky-700 hover:underline dark:text-sky-400"
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            View on LinkedIn ↗
          </a>
        )}
      </div>
    </div>
  );
}

/** "Ada Lovelace" -> "AL". Used when an image URL will not load. */
function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** 12136640 -> "12,136,640" */
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
