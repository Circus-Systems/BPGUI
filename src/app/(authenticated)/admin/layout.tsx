import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/journalists", label: "Journalists" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/spend", label: "Spend" },
  { href: "/admin/survey", label: "Survey" },
  { href: "/admin/ave-rates", label: "AVE rates" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted mt-1">
          Manage journalist roster, events, advertiser spend, survey results, and AVE rate card.
        </p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
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
