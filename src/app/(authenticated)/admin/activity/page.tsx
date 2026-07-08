import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  type ActivityRow,
  describeActivity,
  deriveSessions,
  summarizeByUser,
  formatDuration,
} from "@/lib/activity";

export const dynamic = "force-dynamic";

const DAY_PRESETS = [1, 7, 30, 90];
const FETCH_CAP = 5000;
const FEED_LIMIT = 250;

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActivityAdmin({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; user?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const days = DAY_PRESETS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const userFilter = sp.user?.trim() || "";
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const db = createServiceClient();
  const { data, error } = await db
    .from("user_activity")
    .select("id, user_id, user_email, path, method, ip, user_agent, referer, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);

  const allRows = (data as ActivityRow[] | null) ?? [];
  const allUsers = [...new Set(allRows.map((r) => r.user_email).filter(Boolean))] as string[];
  const rows = userFilter ? allRows.filter((r) => r.user_email === userFilter) : allRows;

  const sessions = deriveSessions(rows);
  const summary = summarizeByUser(rows, sessions);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const d = patch.days ?? String(days);
    if (d) p.set("days", d);
    const u = patch.user !== undefined ? patch.user : userFilter;
    if (u) p.set("user", u);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  const capped = allRows.length >= FETCH_CAP;

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User activity</h2>
          <p className="text-xs text-muted mt-1">
            Who has signed in and what they did. Every authenticated page view and
            action is logged. Admin-only.
          </p>
        </div>
        <p className="text-xs text-muted">
          {rows.length.toLocaleString()} events · last {days}d
          {capped && " (capped)"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted">Range:</span>
          {DAY_PRESETS.map((d) => (
            <Link
              key={d}
              href={qs({ days: String(d) })}
              className={`rounded px-2 py-1 ${
                d === days
                  ? "bg-accent text-white"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {d === 1 ? "24h" : `${d}d`}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">User:</span>
          <Link
            href={qs({ user: "" })}
            className={`rounded px-2 py-1 ${
              !userFilter ? "bg-accent text-white" : "border border-border text-muted hover:text-foreground"
            }`}
          >
            All ({allUsers.length})
          </Link>
          {allUsers.map((u) => (
            <Link
              key={u}
              href={qs({ user: u })}
              className={`rounded px-2 py-1 ${
                u === userFilter ? "bg-accent text-white" : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {u}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error.message}
        </div>
      )}

      {rows.length === 0 && !error && (
        <div className="rounded-lg border border-border bg-white px-3 py-8 text-center text-xs text-muted">
          No activity in this window.
        </div>
      )}

      {/* Per-user summary */}
      {summary.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Who&apos;s been on</h3>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted">User</th>
                  <th className="px-3 py-2 font-medium text-muted">Visits</th>
                  <th className="px-3 py-2 font-medium text-muted">Actions</th>
                  <th className="px-3 py-2 font-medium text-muted">Last active</th>
                  <th className="px-3 py-2 font-medium text-muted">Most used</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((u) => (
                  <tr key={u.user_email ?? "unknown"} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{u.user_email ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.sessions}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.events}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{when(u.lastActive)}</td>
                    <td className="px-3 py-2 text-muted">{u.topSections.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Login sessions / visits */}
      {sessions.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Sign-ins &amp; visits{" "}
            <span className="font-normal text-muted">(new visit after 30 min idle)</span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted">User</th>
                  <th className="px-3 py-2 font-medium text-muted">Started</th>
                  <th className="px-3 py-2 font-medium text-muted">Duration</th>
                  <th className="px-3 py-2 font-medium text-muted">Actions</th>
                  <th className="px-3 py-2 font-medium text-muted">Areas visited</th>
                  <th className="px-3 py-2 font-medium text-muted">IP</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 200).map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{s.user_email ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{when(s.start)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {formatDuration(s.start, s.end)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.events}</td>
                    <td className="px-3 py-2 text-muted">{s.sections.join(" · ")}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{s.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detailed action feed */}
      {rows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Activity detail{" "}
            <span className="font-normal text-muted">
              (most recent {Math.min(rows.length, FEED_LIMIT)})
            </span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted">When</th>
                  <th className="px-3 py-2 font-medium text-muted">User</th>
                  <th className="px-3 py-2 font-medium text-muted">Action</th>
                  <th className="px-3 py-2 font-medium text-muted">Path</th>
                  <th className="px-3 py-2 font-medium text-muted">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, FEED_LIMIT).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{when(r.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.user_email ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{describeActivity(r.path, r.method)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      <span className="text-muted/70">{r.method}</span> {r.path}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
