"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVertical } from "@/hooks/use-vertical";

interface Brand {
  entity_name: string;
  entity_type: string;
  article_count: number;
  total_mentions: number;
  slug: string;
}

export default function BriefIndexPage() {
  const { vertical } = useVertical();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("company");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/brands?vertical=${vertical}&type=${type}&limit=300`)
      .then((r) => r.json())
      .then((d) => {
        setBrands(d.brands || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [vertical, type]);

  const filtered = search
    ? brands.filter((b) =>
        b.entity_name.toLowerCase().includes(search.toLowerCase())
      )
    : brands;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          AdvertiserBriefs
        </h1>
        <p className="text-sm text-muted mt-1">
          Pick a brand to generate an auto-populated pitch deck using BPG
          editorial coverage, events, and spend data.
        </p>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          type="search"
          placeholder="Search brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="company">Company</option>
          <option value="destination">Destination</option>
          <option value="industry_body">Industry body</option>
          <option value="all">All types</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading brands…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((b) => (
            <Link
              key={`${b.entity_name}-${b.entity_type}`}
              href={`/brief/${encodeURIComponent(b.slug)}?name=${encodeURIComponent(b.entity_name)}`}
              className="block rounded-lg border border-border bg-white p-4 hover:border-accent hover:shadow-sm transition"
            >
              <p className="text-sm font-medium text-foreground truncate">
                {b.entity_name}
              </p>
              <p className="text-xs text-muted mt-1">
                {b.article_count} articles · {b.total_mentions} mentions ·{" "}
                {b.entity_type}
              </p>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted text-sm col-span-full">No brands found.</p>
          )}
        </div>
      )}
    </div>
  );
}
