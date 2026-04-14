"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Briefing" },
  { href: "/articles", label: "Articles" },
  { href: "/entities", label: "Entities" },
  { href: "/publications", label: "Publications" },
  { href: "/health", label: "Health" },
  { href: "/chat", label: "Chat" },
];

export function NavBar({ displayName }: { displayName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = displayName
    ? displayName
        .split(/[@.\s]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0].toUpperCase())
        .join("")
    : "?";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-foreground">
            BPG
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-medium text-muted hover:bg-surface-elevated transition-colors"
          >
            {initials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 rounded-lg border border-border bg-white py-1 shadow-lg">
              <div className="border-b border-border px-3 py-2">
                <p className="text-xs text-muted truncate">{displayName}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full px-3 py-2 text-left text-sm text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden ml-2 rounded-md p-1.5 text-muted hover:bg-surface"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
