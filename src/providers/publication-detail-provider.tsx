"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { PublicationDetailModal } from "@/components/publication-detail/publication-detail-modal";

export interface PublicationDetailContextValue {
  openPublication: (sourceId: string) => void;
  closePublication: () => void;
}

const PublicationDetailContext = createContext<PublicationDetailContextValue>({
  openPublication: () => {},
  closePublication: () => {},
});

export function usePublicationDetail(): PublicationDetailContextValue {
  return useContext(PublicationDetailContext);
}

/** Sync the ?publication= deep-link param without triggering a Next router navigation. */
function setPublicationParam(sourceId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (sourceId) {
    url.searchParams.set("publication", sourceId);
  } else {
    url.searchParams.delete("publication");
  }
  window.history.replaceState(null, "", url.toString());
}

export function PublicationDetailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [source, setSource] = useState<string | null>(null);

  const openPublication = useCallback((sourceId: string) => {
    setSource(sourceId);
    setPublicationParam(sourceId);
  }, []);

  const closePublication = useCallback(() => {
    setSource(null);
    setPublicationParam(null);
  }, []);

  // Deep link: auto-open from ?publication= on mount — but only when there is
  // no ?entity= param, since the entity modal wins if both are present.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const initial = search.get("publication");
    if (initial && !search.get("entity")) setSource(initial);
  }, []);

  // While open: Esc closes and the body scroll is locked.
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePublication();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [source, closePublication]);

  return (
    <PublicationDetailContext.Provider
      value={{ openPublication, closePublication }}
    >
      {children}
      {source && (
        <PublicationDetailModal source={source} onClose={closePublication} />
      )}
    </PublicationDetailContext.Provider>
  );
}
