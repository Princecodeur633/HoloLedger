"use client";

import { useSyncExternalStore } from "react";

import { readJSON, writeJSON } from "./storage";

/** "Hide amounts" switch (eye on the balance card), remembered on this device. */
const KEY = "holoLedger.hideAmounts";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleHidden() {
  writeJSON(KEY, !readJSON(KEY, false));
  listeners.forEach((l) => l());
}

export function useHidden() {
  return useSyncExternalStore(
    subscribe,
    () => readJSON(KEY, false),
    () => false,
  );
}

export const MASK = "••••";
