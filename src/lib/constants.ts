import type { VerticalCode } from "@/hooks/use-vertical";

/**
 * Maps each UI vertical to the source_id slugs it includes.
 * Travel merges travel + cruise + luxury-travel publications.
 */
export const VERTICAL_SOURCES: Record<VerticalCode, readonly string[]> = {
  travel: [
    "travel-weekly",
    "karryon",
    "travel-daily",
    "latte",
    "traveltalk",
    "travel-monitor",
    "travel-today-nz",
    "global-travel-media",
    "cruise-weekly",
    "cruise-industry-news",
    "seatrade-rss",
    "travel-bulletin",
  ],
  pharmacy: ["ajp", "pharmacy-daily"],
} as const;

/** Human-readable labels for each source_id */
export const SOURCE_LABELS: Record<string, string> = {
  "travel-weekly": "Travel Weekly",
  karryon: "KarryOn",
  "travel-daily": "Travel Daily",
  latte: "LATTE",
  traveltalk: "TravelTalk",
  "travel-monitor": "Travel Monitor",
  "travel-today-nz": "Travel Today NZ",
  "global-travel-media": "Global Travel Media",
  "cruise-weekly": "Cruise Weekly",
  "cruise-industry-news": "Cruise Industry News",
  "seatrade-rss": "Seatrade Cruise",
  "travel-bulletin": "Travel Bulletin",
  ajp: "AJP",
  "pharmacy-daily": "Pharmacy Daily",
};

/** Chart colors per source_id */
export const SOURCE_COLORS: Record<string, string> = {
  "travel-weekly": "#2563EB",
  karryon: "#7C3AED",
  "travel-daily": "#0891B2",
  latte: "#D97706",
  traveltalk: "#059669",
  "travel-monitor": "#DC2626",
  "travel-today-nz": "#4F46E5",
  "global-travel-media": "#0D9488",
  "cruise-weekly": "#2563EB",
  "cruise-industry-news": "#9333EA",
  "seatrade-rss": "#0369A1",
  "travel-bulletin": "#CA8A04",
  ajp: "#16A34A",
  "pharmacy-daily": "#EA580C",
};
