import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  // Get all publications (all 13 collectors)
  const { data: publications } = await supabase
    .from("publications")
    .select("slug, name, vertical")
    .order("name");

  // Get latest run per collector from run_history
  // Fetch recent runs and deduplicate in JS
  const { data: recentRuns } = await supabase
    .from("run_history")
    .select("collector_id, collector_type, status, started_at, finished_at, items_collected, items_new, items_updated, errors_json")
    .order("started_at", { ascending: false })
    .limit(500);

  // Get latest article per source for freshness
  // Fetch one recent article per source by getting recent articles
  const allSlugs = (publications || []).map((p) => p.slug);
  const { data: recentArticles } = await supabase
    .from("articles")
    .select("source_id, published_at")
    .in("source_id", allSlugs)
    .order("published_at", { ascending: false })
    .limit(500);

  // Build latest article map
  const latestArticleMap = new Map<string, string>();
  for (const a of recentArticles || []) {
    if (a.published_at && !latestArticleMap.has(a.source_id)) {
      latestArticleMap.set(a.source_id, a.published_at);
    }
  }

  // Build latest run map
  const latestRunMap = new Map<string, {
    collector_id: string;
    collector_type: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    items_collected: number;
    items_new: number;
    items_updated: number;
    errors_json: string | null;
  }>();
  for (const r of recentRuns || []) {
    if (!latestRunMap.has(r.collector_id)) {
      latestRunMap.set(r.collector_id, r);
    }
  }

  // Count runs in last 24h per collector for success rate
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentRunsByCollector = new Map<string, { total: number; success: number }>();
  for (const r of recentRuns || []) {
    if (r.started_at >= oneDayAgo) {
      const existing = recentRunsByCollector.get(r.collector_id) || { total: 0, success: 0 };
      existing.total += 1;
      if (r.status === "success") existing.success += 1;
      recentRunsByCollector.set(r.collector_id, existing);
    }
  }

  // Build collector summary
  const collectors = (publications || []).map((pub) => {
    const lastRun = latestRunMap.get(pub.slug);
    const lastArticle = latestArticleMap.get(pub.slug);
    const recentStats = recentRunsByCollector.get(pub.slug);

    let healthStatus: "healthy" | "warning" | "error" | "unknown" = "unknown";
    if (lastRun) {
      if (lastRun.status === "success") {
        // Check if last run was recent (within 24h)
        const runAge = Date.now() - new Date(lastRun.started_at).getTime();
        healthStatus = runAge < 24 * 60 * 60 * 1000 ? "healthy" : "warning";
      } else {
        healthStatus = "error";
      }
    }

    return {
      source_id: pub.slug,
      name: pub.name,
      vertical: pub.vertical,
      health_status: healthStatus,
      last_run: lastRun ? {
        status: lastRun.status,
        started_at: lastRun.started_at,
        finished_at: lastRun.finished_at,
        items_collected: lastRun.items_collected || 0,
        items_new: lastRun.items_new || 0,
      } : null,
      last_article_at: lastArticle || null,
      runs_24h: recentStats?.total || 0,
      success_rate_24h: recentStats ? (recentStats.total > 0 ? recentStats.success / recentStats.total : 0) : null,
    };
  });

  // Summary counts
  const healthy = collectors.filter((c) => c.health_status === "healthy").length;
  const warning = collectors.filter((c) => c.health_status === "warning").length;
  const error = collectors.filter((c) => c.health_status === "error").length;

  return NextResponse.json({
    collectors,
    summary: { total: collectors.length, healthy, warning, error },
  });
}
