# BPGUI Build Plan

## Overview

BPG Intelligence Platform — a Next.js UI for competitive intelligence across Australian trade media (travel, cruise, pharmacy). Built on Supabase, deployed to Vercel. Architecture mirrors NordicPricingUI.

## Phases

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Foundation | **Complete** | Scaffolding, auth, layout, vertical provider, nav |
| 2 | Article Feed | **Complete** | Browsable, searchable article feed filtered by vertical |
| 3 | Entity Intelligence | **Complete** | Entity ranking, trends, drill-down, co-occurrence |
| 4 | Publication Comparison | **Complete** | Cross-publication competitive analysis dashboard |
| 5 | Collector Health | **Complete** | Operational monitoring for all 13 collectors |
| 6 | Briefing, Chat, Deploy | **Complete** | Morning briefing, AI chat agent, Vercel deployment |

## Verticals

Two UI verticals that group the 13 underlying publications:

- **Travel** — travel-weekly, karryon, travel-daily, latte, traveltalk, travel-monitor, travel-today-nz, global-travel-media, cruise-weekly, cruise-industry-news, seatrade-rss, travel-bulletin (12 sources)
- **Pharmacy** — ajp, pharmacy-daily (2 sources)

## Tech Stack

- Next.js 16 (App Router) + TypeScript strict + React 19
- Tailwind CSS 4 with custom design tokens
- Supabase SSR auth (3 clients: browser, server, middleware)
- Recharts for data visualization
- Vercel for deployment

## Supabase Project

- URL: `https://bqfhxzgcogczdmoqyywc.supabase.co`
- Auth user: `admin@bpg.com.au`
