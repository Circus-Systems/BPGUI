import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/journalists", label: "Journalists" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/spend", label: "Spend" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/survey", label: "Survey" },
  { href: "/admin/ave-rates", label: "Promotional Value rates" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tabs = isAdminEmail(user?.email)
    ? [...TABS, { href: "/admin/activity", label: "Activity" }]
    : TABS;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted mt-1">
          Manage journalist roster, events, advertiser spend, campaigns, survey results, and the Promotional Value rate card.
        </p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground border-b-2 border-transparent hover:border-accent"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
