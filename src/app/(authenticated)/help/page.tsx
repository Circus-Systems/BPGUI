import Link from "next/link";

export const metadata = { title: "Help — BPG Intelligence Platform" };

/**
 * Help & documentation: what the platform is, how to use each section,
 * FAQ (methodology definitions live here — sponsored, material coverage,
 * Promotional Value, badges, brand grouping), and a full site map.
 * Static server component; content maintained alongside the features it
 * describes.
 */

const SECTIONS = [
  { id: "about", label: "What is this?" },
  { id: "guide", label: "How to use it" },
  { id: "faq", label: "FAQ & definitions" },
  { id: "sitemap", label: "Site map" },
];

// [name, vertical, isBpgTitle, paused?] — `paused` = configured but not
// currently collecting, so it contributes no coverage.
const TRACKED_PUBS: Array<[string, string, boolean, boolean?]> = [
  ["Travel Daily", "travel", true],
  ["Cruise Weekly", "cruise", true],
  ["Pharmacy Daily", "pharmacy", true],
  ["travelBulletin", "travel", true],
  ["LATTE", "luxury travel", true],
  ["KarryOn", "travel", false],
  ["Travel Weekly Australia", "travel", false],
  ["Travel Monitor", "travel", false],
  ["Travel Today NZ", "travel", false],
  ["Global Travel Media", "travel", false],
  ["TravelTalk", "travel", false, true],
  ["Cruise Industry News", "cruise", false],
  ["Seatrade Cruise News", "cruise", false],
  ["AJP", "pharmacy", false],
];

const SITE_MAP: Array<{
  group: string;
  items: Array<{ href: string; name: string; desc: string }>;
}> = [
  {
    group: "Analyse",
    items: [
      {
        href: "/articles",
        name: "Articles",
        desc: "Search and filter every collected article. Date presets or custom ranges, multi-publication filters, sponsored filter, and Exclusive / First-to-publish badges.",
      },
      {
        href: "/entities",
        name: "Entities",
        desc: "Brands, destinations and industry bodies extracted from every article, grouped by canonical brand (e.g. NCL and Norwegian Cruise Line count as one).",
      },
      {
        href: "/publications",
        name: "Publications",
        desc: "Publisher-vs-publisher output: volumes, cadence, sponsored share. Compare any subset of publications over any period.",
      },
      {
        href: "/health",
        name: "Health",
        desc: "Collection pipeline status — per-publication run history and data freshness.",
      },
    ],
  },
  {
    group: "Sell",
    items: [
      {
        href: "/brief",
        name: "Briefs",
        desc: "The Key Partner Meeting deck. Pick a brand and host title, preview all 20 slides on live data, add recommendations, export to PowerPoint.",
      },
    ],
  },
  {
    group: "Create",
    items: [
      {
        href: "/chat",
        name: "Chat",
        desc: "Ask the data questions in plain English (“who covered Scenic most this quarter?”). Answers come with charts and tables.",
      },
      {
        href: "/generator",
        name: "Generator",
        desc: "AI article drafting: research a topic, generate a draft in a publication's style guide, edit, finalise.",
      },
      {
        href: "/brief#recommendations",
        name: "Brief recommendations",
        desc: "Slide 17 of any brief is editable in place — notes save per brand and flow into the exported deck.",
      },
    ],
  },
  {
    group: "Admin (data that powers the Brief)",
    items: [
      {
        href: "/admin",
        name: "Overview",
        desc: "Admin landing page.",
      },
      {
        href: "/admin/ave-rates",
        name: "Promotional Value rates",
        desc: "The rate card: dollar value per standard mention and per feature, per publication. Drives every $ figure on the briefs.",
      },
      {
        href: "/admin/campaigns",
        name: "Campaigns",
        desc: "Create campaigns and upload insertion CSVs — fills brief slides 15–16 (most recent campaign + YTD report).",
      },
      {
        href: "/admin/events",
        name: "Events",
        desc: "Events attended/covered, with CSV import — fills the “Events Attended” stat on brief slide 9.",
      },
      {
        href: "/admin/spend",
        name: "Advertiser spend",
        desc: "Salesforce spend imports — fills brief slide 12 (share of voice by advertising).",
      },
      {
        href: "/admin/journalists",
        name: "Journalists",
        desc: "Editorial team roster (names, roles, headshots) used on brief slide 5.",
      },
      {
        href: "/admin/survey",
        name: "Survey",
        desc: "Readership figures (subscribers, engagement stats) used on brief slide 3.",
      },
    ],
  },
];

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What counts as “sponsored”?",
    a: (
      <>
        <p>An article is flagged sponsored when any of three signals fire:</p>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>The publication explicitly categorised it under a known sponsored/partner-content category or tag.</li>
          <li>Its category or tag name contains sponsor / advertorial / partner content / paid.</li>
          <li>A disclosure phrase (“sponsored by …”, “in partnership with …”) appears in the title or opening of the article.</li>
        </ol>
        <p className="mt-2">
          Competitions, giveaways and generic “promotions” are deliberately <strong>not</strong> counted as
          sponsored — they are editorial. The detector was recalibrated in July 2026 (over 7,000 wrongly-flagged
          articles were cleared), so counts before then read higher than they should have.
        </p>
      </>
    ),
  },
  {
    q: "What is a “material” article? Why do brand counts look lower than raw search results?",
    a: (
      <p>
        Headline brand metrics (and the brief) count an article only when the brand&apos;s presence is{" "}
        <strong>material</strong>: mentioned two or more times, <em>or</em> named in the headline, <em>or</em> a
        high-confidence single mention. One-off passing references (“… also attended by representatives of
        X …”) are excluded so that every article we count survives the client actually opening it. The
        Articles search shows everything; the brand metrics apply the materiality standard.
      </p>
    ),
  },
  {
    q: "How is Promotional Value calculated?",
    a: (
      <p>
        <strong>Earned editorial only, valued at the rate card.</strong> Each material, non-sponsored article about
        the brand is valued using the per-publication rates set in{" "}
        <Link className="text-accent underline" href="/admin/ave-rates">
          Admin → Promotional Value rates
        </Link>{" "}
        (standard mention vs feature, split at 500 words). Sponsored/paid content is excluded — it&apos;s already
        paid for, so valuing it as earned would be double counting. Briefs present the result as an indicative
        ±15% band rather than false-precision single figures.
      </p>
    ),
  },
  {
    q: "What do the “Exclusive” and “First to publish” badges mean?",
    a: (
      <p>
        Every article is clustered with similar stories across the actively-collected publications.{" "}
        <strong>Exclusive</strong> = no other actively-collected publication ran the story at all.{" "}
        <strong>First to publish</strong> = others ran it, but this publication was earliest. Articles with no badge
        either shared the story without being first, or haven&apos;t been through clustering yet (new articles
        cluster within minutes).
      </p>
    ),
  },
  {
    q: "How are brand names grouped?",
    a: (
      <p>
        A canonical brand registry groups aliases: NCL, Norwegian Cruise Line and ship names like Norwegian Spirit
        all count as <em>Norwegian Cruise Line</em>. Ambiguous words stay separate on purpose — “Norwegian”
        alone is not merged (it collides with the airline), and Norwegian Cruise Line Holdings is kept distinct as
        the parent group. Brand names that double as common words (Scenic, Voyages, Celebrity…) require the
        brand&apos;s exact capitalisation and a material presence before they&apos;re tagged, so “scenic
        sunsets” never counts toward Scenic.
      </p>
    ),
  },
  {
    q: "How fresh is the data?",
    a: (
      <p>
        Articles are collected roughly every 15 minutes across the actively-collected publications (a few
        low-volume feeds publish rarely, so they show long quiet stretches). New articles get fast placeholder
        brand tags within ~20 minutes and authoritative AI tags within the hour; story clustering runs every couple
        of minutes. Publication-level rollups in some pickers refresh nightly, so a brand-new brand can take up to a
        day to appear in dropdowns while its articles are already searchable.
      </p>
    ),
  },
  {
    q: "Why does a brief slide say “data pending”?",
    a: (
      <p>
        Those slides are wired to data that comes from imports rather than collection: advertising share-of-voice
        (Salesforce spend →{" "}
        <Link className="text-accent underline" href="/admin/spend">
          Admin → Spend
        </Link>
        ), campaign results (console export →{" "}
        <Link className="text-accent underline" href="/admin/campaigns">
          Admin → Campaigns
        </Link>
        ), events (
        <Link className="text-accent underline" href="/admin/events">
          Admin → Events
        </Link>
        ) and social metrics (coming later). The slide fills automatically the moment the data is imported —
        nothing else to configure.
      </p>
    ),
  },
  {
    q: "What CSV formats do the admin imports expect?",
    a: (
      <>
        <p className="font-medium">Campaign insertions (Admin → Campaigns → Upload insertions):</p>
        <p className="font-mono text-xs bg-surface rounded p-2 mt-1">
          date, publication, ad_type, page_position, est_readership, clicks, notes
        </p>
        <p className="mt-2 font-medium">Events (Admin → Events → CSV import):</p>
        <p className="font-mono text-xs bg-surface rounded p-2 mt-1">
          publication, event_name, event_date, advertiser, attended_by, notes
        </p>
        <p className="mt-2">
          Dates as YYYY-MM-DD (DD/MM/YYYY also accepted); <em>publication</em> accepts either the display name
          (“Travel Daily”) or the internal id (travel-daily). Each upload shows a validation preview —
          rejected rows are listed with reasons, and duplicates are skipped automatically.
        </p>
      </>
    ),
  },
  {
    q: "Which host titles can generate briefs?",
    a: (
      <p>
        Travel Daily, Cruise Weekly, Pharmacy Daily, LATTE and travelBulletin — pick the host on the brief page.
        The host determines which publication fronts the deck and which media competitors it&apos;s benchmarked
        against (e.g. Travel Daily vs KarryOn and Travel Weekly).
      </p>
    ),
  },
  {
    q: "Where does the data come from? Is it allowed?",
    a: (
      <p>
        Articles are collected from each publication&apos;s public website via their standard public interfaces
        (the same content anyone can read), stored centrally, and analysed in-house. Brand tagging runs on our own
        local AI models — article content is not sent to third-party AI services for tagging.
      </p>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Help</h1>
        <p className="mt-1 text-sm text-muted">
          What the platform is, how to use it, definitions behind the numbers, and where everything lives.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      {/* ------------------------------ About ------------------------------ */}
      <section id="about" className="mb-10 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground mb-3">What is this platform?</h2>
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-foreground space-y-3">
          <p>
            The <strong>BPG Intelligence Platform</strong> tracks {TRACKED_PUBS.length} Australian
            and New Zealand trade publications across travel, cruise and pharmacy, and continuously collects from
            those that are actively publishing into the feed. It collects every article,
            identifies which brands, destinations and industry bodies each one covers, detects sponsored content,
            and clusters the same story across publications so we know who ran it exclusively and who ran it first.
          </p>
          <p>
            On top of that data it does two jobs: <strong>analysis</strong> (searchable coverage, publisher
            benchmarking, share of voice) and <strong>selling</strong> — the{" "}
            <Link href="/brief" className="text-accent underline">
              Key Partner Meeting brief
            </Link>
            , a 20-slide client-ready deck that assembles a brand&apos;s complete coverage story automatically.
          </p>
          <div>
            <p className="font-medium mb-2">Publications tracked</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {TRACKED_PUBS.map(([name, vertical, own, paused]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      paused ? "bg-transparent border border-muted" : own ? "bg-accent" : "bg-border"
                    }`}
                    title={paused ? "Not currently collecting" : own ? "BPG title" : "Competitor"}
                  />
                  <span className={paused ? "text-muted" : "text-foreground"}>{name}</span>
                  <span className="text-muted">{vertical}</span>
                  {paused && <span className="text-muted italic">· paused</span>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-accent mr-1" /> BPG titles ·{" "}
              <span className="inline-block h-2 w-2 rounded-full bg-border mx-1" /> competitors ·{" "}
              <span className="inline-block h-2 w-2 rounded-full bg-transparent border border-muted mx-1" /> not
              currently collecting
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------ Guide ------------------------------ */}
      <section id="guide" className="mb-10 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground mb-3">How to use it</h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5 text-sm space-y-2">
            <h3 className="font-semibold text-foreground">Prepare for a client meeting (the main workflow)</h3>
            <ol className="list-decimal ml-5 space-y-1.5 text-foreground">
              <li>
                Open{" "}
                <Link href="/brief" className="text-accent underline">
                  Briefs
                </Link>{" "}
                and pick the brand (search groups all its aliases automatically).
              </li>
              <li>Choose the host title (Travel Daily by default) and period (365 days for annual meetings).</li>
              <li>
                Review the preview — every slide mirrors the exported deck. Slides marked{" "}
                <em>data pending</em> fill automatically once the matching admin import is done.
              </li>
              <li>Add tailored notes on slide 17 (Optimisation &amp; recommendations) — they save per brand.</li>
              <li>
                Click <em>Download PPTX</em>. The deck is fully editable in PowerPoint/Keynote for final polish.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 text-sm space-y-2">
            <h3 className="font-semibold text-foreground">Investigate coverage</h3>
            <ul className="list-disc ml-5 space-y-1.5 text-foreground">
              <li>
                <Link href="/articles" className="text-accent underline">
                  Articles
                </Link>
                : search any brand or topic; combine date presets (30/90/180/365 days) or a custom range with
                multi-publication filters. The URL carries your filters — copy it to share the exact view.
              </li>
              <li>
                <Link href="/entities" className="text-accent underline">
                  Entities
                </Link>
                : who gets covered, how often, with what sentiment — grouped by canonical brand.
              </li>
              <li>
                <Link href="/publications" className="text-accent underline">
                  Publications
                </Link>
                : compare publishers head-to-head on volume and cadence over any window.
              </li>
              <li>
                <Link href="/chat" className="text-accent underline">
                  Chat
                </Link>
                : when a question doesn&apos;t fit a filter (“which cruise line gained the most coverage this
                quarter vs last?”), just ask it.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 text-sm space-y-2">
            <h3 className="font-semibold text-foreground">Keep the briefs fed (admin)</h3>
            <p className="text-foreground">
              Four imports power the commercial slides — each takes minutes and shows a validation preview:
            </p>
            <ul className="list-disc ml-5 space-y-1.5 text-foreground">
              <li>
                <Link href="/admin/ave-rates" className="text-accent underline">
                  Promotional Value rates
                </Link>{" "}
                — set once, review quarterly. Every $ figure depends on it.
              </li>
              <li>
                <Link href="/admin/campaigns" className="text-accent underline">
                  Campaigns
                </Link>{" "}
                — create the campaign, upload its insertion CSV (slides 15–16).
              </li>
              <li>
                <Link href="/admin/events" className="text-accent underline">
                  Events
                </Link>{" "}
                — CSV of events attended (slide 9).
              </li>
              <li>
                <Link href="/admin/spend" className="text-accent underline">
                  Advertiser spend
                </Link>{" "}
                — Salesforce export (slide 12).
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------- FAQ ------------------------------- */}
      <section id="faq" className="mb-10 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground mb-3">FAQ &amp; definitions</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-lg border border-border bg-white">
              <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-foreground hover:bg-surface rounded-lg transition-colors">
                {f.q}
              </summary>
              <div className="px-5 pb-4 pt-1 text-sm text-foreground/90">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------- Site map ---------------------------- */}
      <section id="sitemap" className="mb-10 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground mb-3">Site map</h2>
        <div className="space-y-5">
          {SITE_MAP.map((g) => (
            <div key={g.group}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{g.group}</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {g.items.map((item) => (
                  <Link
                    key={item.href + item.name}
                    href={item.href}
                    className="rounded-lg border border-border bg-white p-4 hover:bg-surface transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-1 text-xs text-muted leading-relaxed">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted border-t border-border pt-4">
        Data refreshes continuously; metric definitions above are the authoritative versions used across the
        platform and in exported briefs. Questions or corrections — contact the BPG platform team.
      </p>
    </div>
  );
}
