import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: number;
  user_email: string | null;
  path: string;
  method: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export default async function ActivityAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) redirect("/");

  const db = createServiceClient();
  const { data, error } = await db
    .from("user_activity")
    .select("id, user_email, path, method, ip, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data as ActivityRow[] | null) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User activity</h2>
          <p className="text-xs text-muted mt-1">
            Last 500 authenticated requests. Only visible to you.
          </p>
        </div>
        <p className="text-xs text-muted">{rows.length} rows</p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-muted">When</th>
              <th className="px-3 py-2 font-medium text-muted">User</th>
              <th className="px-3 py-2 font-medium text-muted">Method</th>
              <th className="px-3 py-2 font-medium text-muted">Path</th>
              <th className="px-3 py-2 font-medium text-muted">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-xs text-muted"
                >
                  No activity yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap text-muted">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.user_email ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                  {r.method}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.path}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">
                  {r.ip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
