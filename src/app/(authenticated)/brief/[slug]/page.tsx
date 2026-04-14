"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { PrintButton } from "@/components/brief/print-button";
import {
  TitleSlide,
  TeamSlide,
  ActivitySlide,
  AuthoritySlide,
  BrandSupportSlide,
  ClippingsSlide,
  PeopleSlide,
  UniqueCoverageSlide,
  SpendScatterSlide,
  TimelineSlide,
} from "@/components/brief/slides";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Coverage = any;

export default function BriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const sp = useSearchParams();
  const brandName = sp.get("name") || slug;
  const [period, setPeriod] = useState(365);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/brand/${encodeURIComponent(slug)}/coverage?name=${encodeURIComponent(brandName)}&period=${period}`
    )
      .then((r) => r.json())
      .then((d) => {
        setCoverage(d);
        setLoading(false);
      });
  }, [slug, brandName, period]);

  if (loading || !coverage) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-muted">Generating brief for {brandName}…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 print:p-0 print:max-w-none">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            AdvertiserBrief · {coverage.brand}
          </h1>
          <p className="text-xs text-muted mt-1">
            Auto-generated from BPG editorial, events, and spend data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
            <option value={730}>Last 2 years</option>
            <option value={1825}>Last 5 years</option>
            <option value={10000}>All-time</option>
          </select>
          <PrintButton />
        </div>
      </div>

      <TitleSlide coverage={coverage} />
      <TeamSlide />
      <ActivitySlide coverage={coverage} />
      <AuthoritySlide />
      <BrandSupportSlide coverage={coverage} />
      <ClippingsSlide coverage={coverage} />
      <PeopleSlide coverage={coverage} />
      <UniqueCoverageSlide coverage={coverage} />
      <SpendScatterSlide coverage={coverage} />
      <TimelineSlide coverage={coverage} />
    </div>
  );
}
