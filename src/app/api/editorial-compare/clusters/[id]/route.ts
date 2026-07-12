import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

interface ClusterRow {
  source_id: string;
  title: string;
  url: string;
  published_at: string | null;
  is_first: boolean;
  similarity: number | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clusterId = Number(id);
  if (!Number.isInteger(clusterId)) {
    return NextResponse.json({ error: "Invalid cluster id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cluster_detail", {
    p_cluster_id: clusterId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items: ClusterRow[] = (data || []).map(
    (r: {
      source_id: string;
      title: string;
      url: string;
      published_at: string | null;
      is_first: boolean;
      similarity: number | string | null;
    }) => ({
      source_id: r.source_id,
      title: r.title,
      url: r.url,
      published_at: r.published_at,
      is_first: r.is_first,
      similarity: r.similarity == null ? null : Number(r.similarity),
    })
  );

  return NextResponse.json({ cluster_id: clusterId, items });
}
