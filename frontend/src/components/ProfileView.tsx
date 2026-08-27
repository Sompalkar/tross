import type { LinkedInProfile, ProfileSuccess } from "@/lib/types";
import { Chip, Label, Muted, Row, Rows, Section, Thumb } from "./ui";

export function ProfileView({ result }: { result: ProfileSuccess }) {
  const profile = result.data;

  return (
    <article className="flex flex-col gap-8">
      <Identity profile={profile} meta={result.meta} />

      {profile.summary && (
        <Section title="About">
          <p className="max-w-[62ch] text-[15px] leading-relaxed whitespace-pre-line text-soft">
            {profile.summary}
          </p>
        </Section>
      )}

      <Section title="Experience" count={profile.experience.length}>
        {profile.experience.length === 0 ? (
          <Empty />
        ) : (
          <Rows>
            {profile.experience.map((position, index) => (
              <Row key={index}>
                <Thumb
                  src={position.companyLogo?.original}
                  alt=""
                  fallback={initials(position.companyName)}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-ink">
                    {position.title ?? "—"}
                  </h3>
                  <p className="text-[14px] text-soft">
                    {position.companyLinkedInUrl && position.companyName ? (
                      <a
                        className="underline decoration-rule underline-offset-2 hover:decoration-accent"
                        href={position.companyLinkedInUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {position.companyName}
                      </a>
                    ) : (
                      position.companyName
                    )}
                    {position.employmentType && (
                      <span className="text-mute"> · {position.employmentType}</span>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3">
                    {position.dateRange?.text && <Muted>{position.dateRange.text}</Muted>}
                    {position.location && <Muted>{position.location}</Muted>}
                  </div>
                  {position.description && (
                    <p className="mt-2.5 max-w-[60ch] text-[14px] leading-relaxed whitespace-pre-line text-soft">
                      {position.description}
                    </p>
                  )}
                </div>
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      <Section title="Education" count={profile.education.length}>
        {profile.education.length === 0 ? (
          <Empty />
        ) : (
          <Rows>
            {profile.education.map((school, index) => (
              <Row key={index}>
                <Thumb
                  src={school.schoolLogo?.original}
                  alt=""
                  fallback={initials(school.schoolName)}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-ink">
                    {school.schoolName ?? "—"}
                  </h3>
                  {/* Many schools list no degree; an empty line beats a dash. */}
                  {(school.degreeName ?? school.fieldOfStudy) && (
                    <p className="text-[14px] text-soft">
                      {[school.degreeName, school.fieldOfStudy].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-3">
                    {school.dateRange?.text && <Muted>{school.dateRange.text}</Muted>}
                    {school.grade && <Muted>Grade {school.grade}</Muted>}
                  </div>
                </div>
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      {profile.skills.length > 0 && (
        <Section title="Skills" count={profile.skills.length}>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <Chip key={skill.name}>{skill.name}</Chip>
            ))}
          </div>
        </Section>
      )}

      {profile.certifications.length > 0 && (
        <Section title="Certifications" count={profile.certifications.length}>
          <Rows>
            {profile.certifications.map((certification, index) => (
              <Row key={index}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-ink">
                    {certification.url ? (
                      <a
                        className="underline decoration-rule underline-offset-2 hover:decoration-accent"
                        href={certification.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {certification.name}
                      </a>
                    ) : (
                      certification.name
                    )}
                  </h3>
                  {certification.authority && (
                    <p className="text-[14px] text-soft">{certification.authority}</p>
                  )}
                  {certification.dateRange?.text && (
                    <div className="mt-1.5">
                      <Muted>{certification.dateRange.text}</Muted>
                    </div>
                  )}
                </div>
              </Row>
            ))}
          </Rows>
        </Section>
      )}

      {profile.languages.length > 0 && (
        <Section title="Languages" count={profile.languages.length}>
          <Rows>
            {profile.languages.map((language, index) => (
              <Row key={index}>
                <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-[15px] text-ink">{language.name}</span>
                  {language.proficiency && <Muted>{language.proficiency}</Muted>}
                </div>
              </Row>
            ))}
          </Rows>
        </Section>
      )}

      {profile.projects.length > 0 && (
        <Section title="Projects" count={profile.projects.length}>
          <Rows>
            {profile.projects.map((project, index) => (
              <Row key={index}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-ink">{project.title}</h3>
                  {project.dateRange?.text && (
                    <div className="mt-1">
                      <Muted>{project.dateRange.text}</Muted>
                    </div>
                  )}
                  {project.description && (
                    <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-soft">
                      {project.description}
                    </p>
                  )}
                </div>
              </Row>
            ))}
          </Rows>
        </Section>
      )}

      {profile.volunteerExperience.length > 0 && (
        <Section title="Volunteering" count={profile.volunteerExperience.length}>
          <Rows>
            {profile.volunteerExperience.map((entry, index) => (
              <Row key={index}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-ink">{entry.role}</h3>
                  <p className="text-[14px] text-soft">{entry.companyName}</p>
                  {entry.dateRange?.text && (
                    <div className="mt-1.5">
                      <Muted>{entry.dateRange.text}</Muted>
                    </div>
                  )}
                </div>
              </Row>
            ))}
          </Rows>
        </Section>
      )}

      <Section title="Raw response">
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-mono text-[12px] text-soft hover:text-ink">
            <span className="text-mute transition-transform group-open:rotate-90">›</span>
            {JSON.stringify(result).length.toLocaleString("en-US")} bytes of JSON
          </summary>
          <pre className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-rule bg-raised p-4 font-mono text-[12px] leading-relaxed text-soft">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </Section>
    </article>
  );
}

function Empty() {
  return <p className="font-mono text-[12px] text-mute">Not listed on this profile.</p>;
}

function Identity({
  profile,
  meta,
}: {
  profile: LinkedInProfile;
  meta: ProfileSuccess["meta"];
}) {
  const cover = profile.backgroundPicture?.original;

  return (
    <header>
      {/* A flat band when there is no cover image — never an invented gradient. */}
      <div className="relative h-28 overflow-hidden rounded-xl border border-rule bg-raised sm:h-36">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        )}
      </div>

      {/* `relative` matters: the cover above is positioned, so without it the
          cover paints over the overlapping avatar and clips its top half. */}
      <div className="relative -mt-9 px-1 sm:-mt-11">
        <Thumb
          src={profile.profilePicture?.original}
          alt={profile.fullName ?? "Profile picture"}
          fallback={initials(profile.fullName)}
          className="size-[72px] rounded-2xl bg-raised text-[15px] ring-4 ring-ground sm:size-[88px]"
        />

        <h1 className="mt-4 font-serif text-[34px] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[42px]">
          {profile.fullName ?? "Unknown"}
        </h1>

        {profile.headline && (
          <p className="mt-1.5 max-w-[52ch] text-[15px] leading-snug text-soft">
            {profile.headline}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {profile.location.full && <Muted>{profile.location.full}</Muted>}
          {profile.followersCount !== null && (
            <Muted>{profile.followersCount.toLocaleString("en-US")} followers</Muted>
          )}
          {profile.connectionsCount !== null && (
            <Muted>{profile.connectionsCount.toLocaleString("en-US")}+ connections</Muted>
          )}
          {profile.connectionDegree && <Chip>{profile.connectionDegree} degree</Chip>}
          {profile.isOpenToWork && <Chip>Open to work</Chip>}
          {profile.isHiring && <Chip>Hiring</Chip>}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {profile.profileUrl && (
            <a
              className="font-mono text-[12px] text-accent underline decoration-transparent underline-offset-4 hover:decoration-current"
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              View on LinkedIn ↗
            </a>
          )}
          <span className="flex items-center gap-2">
            <Label>{meta.source}</Label>
            <span className="text-rule">/</span>
            <Label>{meta.cached ? "cached" : "fresh"}</Label>
            <span className="text-rule">/</span>
            <Label>{meta.durationMs} ms</Label>
          </span>
        </div>
      </div>
    </header>
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
