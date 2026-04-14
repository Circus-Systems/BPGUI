# Phase 1: Foundation

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### Project Scaffolding
- Next.js 16.2.3 with App Router, TypeScript strict mode, React 19
- Tailwind CSS 4 with `@tailwindcss/postcss`, custom design tokens matching NordicPricingUI palette
- Geist sans + mono fonts via `next/font/google`

### Supabase Connection Layer (`src/lib/supabase/`)
Three clients following the NordicPricingUI pattern:
- **`client.ts`** — Browser client using `createBrowserClient` with anon key. Used in client components (login, sign out).
- **`server.ts`** — Two exports:
  - `createClient()` — Server component client with cookie management (anon key, respects RLS)
  - `createServiceClient()` — Service role client that bypasses RLS (API routes only)
- **`middleware.ts`** — Session refresh on every request, auth enforcement, MFA flow support. Public paths: `/login`, `/auth/callback`.

### Authentication
- **Middleware** (`src/middleware.ts`) — Delegates to Supabase middleware for session management
- **Login page** (`src/app/login/page.tsx`) — Email/password form, branded "BPG Intelligence Platform"
- **Auth callback** (`src/app/auth/callback/route.ts`) — Code exchange for OAuth/recovery flows
- **SKIP_MFA=true** during development (env var)
- Test user created: `admin@bpg.com.au` via Supabase signup API + email confirmation

### Vertical Provider (equivalent to NordicPricing's CountryProvider)
- **Hook** (`src/hooks/use-vertical.ts`) — `VerticalCode = "travel" | "pharmacy"`, localStorage persistence (key: `bpg_vertical`), default: `"travel"`
- **Provider** (`src/providers/vertical-provider.tsx`) — React Context wrapping `useVerticalState()`
- **Selector** (`src/components/vertical-selector.tsx`) — Two-button pill toggle: Travel / Pharmacy

### Layout Hierarchy
1. **Root layout** (`src/app/layout.tsx`) — Geist fonts, metadata, antialiasing
2. **Authenticated layout** (`src/app/(authenticated)/layout.tsx`) — Server component that checks auth, wraps children in `VerticalProvider` + `NavBar` + `VerticalSelector`
3. **Home page** (`src/app/(authenticated)/page.tsx`) — Placeholder with vertical-aware description

### Navigation
- **NavBar** (`src/components/nav-bar.tsx`) — Sticky header with items: Briefing (/), Articles (/articles), Entities (/entities), Publications (/publications), Health (/health). User avatar with sign-out dropdown. Responsive: hidden nav items at <md, hamburger menu on mobile.

### Utilities
- **Constants** (`src/lib/constants.ts`) — `VERTICAL_SOURCES` mapping (Travel: 12 slugs, Pharmacy: 2 slugs), `SOURCE_LABELS`, `SOURCE_COLORS` for chart coloring
- **Format** (`src/lib/format.ts`) — `formatRelativeTime`, `formatDate`, `formatDateShort`, `formatNumber`

## File Structure

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── auth/callback/route.ts
│   └── (authenticated)/
│       ├── layout.tsx
│       └── page.tsx
├── components/
│   ├── nav-bar.tsx
│   └── vertical-selector.tsx
├── hooks/
│   └── use-vertical.ts
├── lib/
│   ├── constants.ts
│   ├── format.ts
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── middleware.ts
├── middleware.ts
└── providers/
    └── vertical-provider.tsx
```

## Verification Results

| Check | Result |
|-------|--------|
| Dev server starts clean | Pass |
| Unauthenticated → /login redirect | Pass |
| Login with Supabase credentials | Pass |
| NavBar renders all items (desktop) | Pass |
| Vertical toggle (Travel ↔ Pharmacy) | Pass |
| Context text changes with vertical | Pass |
| localStorage persistence | Pass |

## Decisions Made

1. **No user_profiles table** — Using email as display name for now. Can add user_profiles in Phase 6 if needed.
2. **MFA skipped** during development via `SKIP_MFA=true` env var.
3. **Nav items hidden at <768px** — Mobile responsive via hamburger menu, following NordicPricing pattern.
4. **Signal colors swapped** — In BPG, `increase` is green (good) and `decrease` is red (bad), unlike NordicPricing where increase=red (price up is bad for McDonald's).
