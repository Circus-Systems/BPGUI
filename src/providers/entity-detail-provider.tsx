"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { EntityDetailModal } from "@/components/entity-detail/entity-detail-modal";

export interface EntityDetailContextValue {
  openEntity: (name: string) => void;
  closeEntity: () => void;
}

const EntityDetailContext = createContext<EntityDetailContextValue>({
  openEntity: () => {},
  closeEntity: () => {},
});

export function useEntityDetail(): EntityDetailContextValue {
  return useContext(EntityDetailContext);
}

/** Sync the ?entity= deep-link param without triggering a Next router navigation. */
function setEntityParam(name: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (name) {
    url.searchParams.set("entity", name);
  } else {
    url.searchParams.delete("entity");
  }
  window.history.replaceState(null, "", url.toString());
}

export function EntityDetailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [name, setName] = useState<string | null>(null);

  const openEntity = useCallback((entityName: string) => {
    setName(entityName);
    setEntityParam(entityName);
  }, []);

  const closeEntity = useCallback(() => {
    setName(null);
    setEntityParam(null);
  }, []);

  // Deep link: auto-open from ?entity= on mount.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("entity");
    if (initial) setName(initial);
  }, []);

  // While open: Esc closes and the body scroll is locked.
  useEffect(() => {
    if (!name) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEntity();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [name, closeEntity]);

  return (
    <EntityDetailContext.Provider value={{ openEntity, closeEntity }}>
      {children}
      {name && <EntityDetailModal name={name} onClose={closeEntity} />}
    </EntityDetailContext.Provider>
  );
}
