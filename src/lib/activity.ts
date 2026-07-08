/**
 * Helpers for the admin User Activity view.
 *
 * Activity is captured by the auth middleware (src/lib/supabase/middleware.ts):
 * one user_activity row per authenticated request. These helpers turn that raw
 * request log into the two things an operator actually wants to see — "who
 * logged in / visited, and when" (sessions) and "what did they do" (readable
 * action labels) — without changing what is captured.
 */

export type ActivityRow = {
  id: number;
  user_id: string | null;
  user_email: string | null;
  path: string;
  method: string;
  ip: string | null;
  user_agent: string | null;
  referer: string | null;
  created_at: string;
};

const titleize = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Coarse section a path belongs to, for grouping ("what areas did they use"). */
export function sectionOf(path: string): string {
  const seg = path.split("/").filter(Boolean);
  if (seg.length === 0) return "Home";
  if (seg[0] === "api") return "API";
  return titleize(seg[0]);
}

/** Human-readable description of a single logged request. */
export function describeActivity(path: string, method: string): string {
  const seg = path.split("/").filter(Boolean);

  // High-value actions first (POSTs / specific endpoints).
  if (method === "POST" && /\/pptx\/?$/.test(path)) {
    return `Downloaded deck${seg[2] ? `: ${titleize(seg[2])}` : ""}`;
  }
  if (path.startsWith("/api/chat")) return "Ran AI chat query";
  if (path.startsWith("/api/generate") || path.startsWith("/api/generated-articles")) {
    return method === "POST" ? "Generated an article" : "Viewed generated articles";
  }
  if (seg[0] === "api" && seg[1] === "admin") {
    return `Admin ${method === "GET" ? "view" : "change"}: ${titleize(seg[2] || "")}`.trim();
  }

  // Page views.
  if (path === "/") return "Home / overview";
  if (seg[0] === "brief") return seg[1] ? `Viewed brief: ${titleize(seg[1])}` : "Opened Brief";
  if (path === "/articles") return "Browsed articles";
  if (path === "/publications") return "Viewed publications";
  if (path === "/entities") return "Viewed entities";
  if (path === "/health") return "Viewed system health";
  if (path === "/help") return "Opened Help";
  if (seg[0] === "generator") return "Article generator";
  if (seg[0] === "admin") return seg[1] ? `Admin: ${titleize(seg[1])}` : "Admin";

  // Data/API fallbacks.
  if (seg[0] === "api") {
    const rest = seg.slice(1).filter((s) => !/^[0-9a-f-]{8,}$/i.test(s)).map(titleize).join(" / ");
    return `${method === "GET" ? "Loaded" : method} ${rest || "data"}`;
  }
  return `${method} ${path}`;
}

export type Session = {
  user_email: string | null;
  start: string;
  end: string;
  events: number;
  ip: string | null;
  sections: string[]; // distinct areas touched, in order first seen
};

/** A new session starts after this long without activity. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

/**
 * Group a flat request log into sessions (a proxy for "visits"/logins): a new
 * session begins whenever a user's gap since their previous request exceeds
 * SESSION_GAP_MS. Returns sessions newest-first.
 */
export function deriveSessions(rows: ActivityRow[]): Session[] {
  const byUser = new Map<string, ActivityRow[]>();
  for (const r of rows) {
    const k = r.user_email ?? r.user_id ?? "unknown";
    const list = byUser.get(k);
    if (list) list.push(r);
    else byUser.set(k, [r]);
  }

  const sessions: Session[] = [];
  for (const list of byUser.values()) {
    const asc = [...list].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
    );
    let cur: ActivityRow[] = [];
    const flush = () => {
      if (!cur.length) return;
      const sections: string[] = [];
      for (const e of cur) {
        const s = sectionOf(e.path);
        if (!sections.includes(s)) sections.push(s);
      }
      sessions.push({
        user_email: cur[0].user_email,
        start: cur[0].created_at,
        end: cur[cur.length - 1].created_at,
        events: cur.length,
        ip: cur[0].ip,
        sections,
      });
      cur = [];
    };
    for (const e of asc) {
      const prev = cur[cur.length - 1];
      if (prev && +new Date(e.created_at) - +new Date(prev.created_at) > SESSION_GAP_MS) {
        flush();
      }
      cur.push(e);
    }
    flush();
  }
  return sessions.sort((a, b) => +new Date(b.start) - +new Date(a.start));
}

export type UserSummary = {
  user_email: string | null;
  events: number;
  sessions: number;
  lastActive: string;
  topSections: string[];
};

/** Per-user rollup: how much each user has used the platform. */
export function summarizeByUser(rows: ActivityRow[], sessions: Session[]): UserSummary[] {
  const map = new Map<string, UserSummary & { _counts: Map<string, number> }>();
  for (const r of rows) {
    const key = r.user_email ?? "unknown";
    let u = map.get(key);
    if (!u) {
      u = {
        user_email: r.user_email,
        events: 0,
        sessions: 0,
        lastActive: r.created_at,
        topSections: [],
        _counts: new Map(),
      };
      map.set(key, u);
    }
    u.events += 1;
    if (new Date(r.created_at) > new Date(u.lastActive)) u.lastActive = r.created_at;
    const s = sectionOf(r.path);
    u._counts.set(s, (u._counts.get(s) ?? 0) + 1);
  }
  for (const s of sessions) {
    const u = map.get(s.user_email ?? "unknown");
    if (u) u.sessions += 1;
  }
  const out: UserSummary[] = [];
  for (const u of map.values()) {
    u.topSections = [...u._counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s]) => s);
    const { _counts, ...rest } = u;
    void _counts;
    out.push(rest);
  }
  return out.sort((a, b) => +new Date(b.lastActive) - +new Date(a.lastActive));
}

/** Human duration like "12m" or "1h 4m". */
export function formatDuration(startIso: string, endIso: string): string {
  const ms = Math.max(0, +new Date(endIso) - +new Date(startIso));
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
