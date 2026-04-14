"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type VerticalCode = "travel" | "pharmacy";

const STORAGE_KEY = "bpg_vertical";
const DEFAULT_VERTICAL: VerticalCode = "travel";

export interface VerticalContextValue {
  vertical: VerticalCode;
  setVertical: (v: VerticalCode) => void;
}

export const VerticalContext = createContext<VerticalContextValue>({
  vertical: DEFAULT_VERTICAL,
  setVertical: () => {},
});

export function useVertical(): VerticalContextValue {
  return useContext(VerticalContext);
}

export function useVerticalState(): VerticalContextValue {
  const [vertical, setVerticalState] =
    useState<VerticalCode>(DEFAULT_VERTICAL);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as VerticalCode | null;
    if (stored && ["travel", "pharmacy"].includes(stored)) {
      setVerticalState(stored);
    }
  }, []);

  const setVertical = useCallback((v: VerticalCode) => {
    setVerticalState(v);
    localStorage.setItem(STORAGE_KEY, v);
  }, []);

  return { vertical, setVertical };
}
