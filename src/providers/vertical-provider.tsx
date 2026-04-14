"use client";

import { VerticalContext, useVerticalState } from "@/hooks/use-vertical";

export function VerticalProvider({ children }: { children: React.ReactNode }) {
  const value = useVerticalState();

  return (
    <VerticalContext.Provider value={value}>
      {children}
    </VerticalContext.Provider>
  );
}
