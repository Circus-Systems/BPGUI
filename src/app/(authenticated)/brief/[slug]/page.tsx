"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrintButton } from "@/components/brief/print-button";
import { DEFAULT_HOST_SLUG, type BriefDeckData } from "@/lib/brief-deck";
import {
  S1TitleSlide,
  S2ContentsSlide,
  S3ReadershipSlide,
  S4AudienceSlide,
  S5TeamSlide,
  S6RespectedSlide,
  S7ContentVolumeSlide,
  S8TitleCardSlide,
  S9CoverageSlide,
  S10UniqueSlide,
  S11SovSlide,
  S12AdvSovSlide,
  S13ProofSlide,
  S14AllProofSlide,
  S15CampaignSlide,
  S16CampaignYtdSlide,
  S17RecommendationsSlide,
  S18ProposalSlide,
  S19LookingAheadSlide,
  S20ThankYouSlide,
} from "@/components/brief/slides";

/** Hosts seeded in brief_config. */
const HOST_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "travel-daily", label: "Travel Daily" },
  { slug: "cruise-weekly", label: "Cruise Weekly" },
  { slug: "pharmacy-daily", label: "Pharmacy Daily" },
  { slug: "latte", label: "LATTE" },
  { slug: "travel-bulletin", label: "Travel Bulletin" },
];

export default function BriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  // Fallback must de-slugify: the raw slug ("norwegian-cruise-line") matches
  // no brand alias and silently renders an all-zero deck.
  const brandName = sp.get("name") || slug.replace(/-/g, " ");
  const host = sp.get("host") || DEFAULT_HOST_SLUG;
  const period = parseInt(sp.get("period") || "365", 10);

  const [deck, setDeck] = useState<BriefDeckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      next.set(key, value);
      router.replace(`/brief/${encodeURIComponent(slug)}?${next.toString()}`);
    },
    [router, sp, slug]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDeck(null);

    async function load(attempt: number) {
      try {
        const r = await fetch(
          `/api/brief/deck?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(
            brandName
          )}&period=${period}&host=${encodeURIComponent(host)}`
        );
        const d = await r.json();
        if (!r.ok || d?.error || !d?.coverage?.summary) {
          // Retry once on transient Supabase timeouts.
          if (attempt < 1) {
            return load(attempt + 1);
          }
          setError(d?.error || `HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        setDeck(d);
        setLoading(false);
      } catch (e) {
        if (attempt < 1) return load(attempt + 1);
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }
    load(0);
  }, [slug, brandName, period, host]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-muted">
          Generating Key Partner Brief for {brandName}…
        </p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="text-xl font-semibold text-foreground">
          KeyPartnerBrief · {brandName}
        </h1>
        <p className="mt-4 text-sm text-red-700">
          Couldn&apos;t generate the brief. {error || "No data returned."}
        </p>
        <p className="mt-2 text-xs text-muted">
          This usually means the coverage query hit Supabase&apos;s statement
          timeout. Try a shorter period or reload.
        </p>
        <button
          onClick={() => location.reload()}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 print:p-0 print:max-w-none">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            KeyPartnerBrief · {deck.brand}
          </h1>
          <p className="text-xs text-muted mt-1">
            {deck.host.title_name} Key Partner Annual Meeting deck —
            auto-generated from BPG editorial, campaign, and spend data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={host}
            onChange={(e) => setParam("host", e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            {HOST_OPTIONS.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.label}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setParam("period", e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
            <option value={730}>Last 2 years</option>
            <option value={1825}>Last 5 years</option>
            <option value={10000}>All-time</option>
          </select>
          <PrintButton
            slug={slug}
            brandName={brandName}
            period={period}
            host={host}
            hostSlug={deck.host.slug}
            brand={deck.brand}
          />
        </div>
      </div>

      <S1TitleSlide data={deck} />
      <S2ContentsSlide />
      <S3ReadershipSlide data={deck} />
      <S4AudienceSlide />
      <S5TeamSlide data={deck} />
      <S6RespectedSlide />
      <S7ContentVolumeSlide data={deck} />
      <S8TitleCardSlide data={deck} />
      <S9CoverageSlide data={deck} />
      <S10UniqueSlide data={deck} />
      <S11SovSlide data={deck} />
      <S12AdvSovSlide data={deck} />
      <S13ProofSlide data={deck} />
      <S14AllProofSlide data={deck} />
      <S15CampaignSlide data={deck} />
      <S16CampaignYtdSlide data={deck} />
      <S17RecommendationsSlide data={deck} />
      <S18ProposalSlide data={deck} />
      <S19LookingAheadSlide />
      <S20ThankYouSlide data={deck} />
    </div>
  );
}
