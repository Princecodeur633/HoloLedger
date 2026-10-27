"use client";

import { useSyncExternalStore } from "react";

import { api, ApiError, NetworkError } from "./api";
import { readJSON, writeJSON } from "./storage";

/** Writes made while offline, replayed in order once the server is reachable again. */
export interface OutboxItem {
  id: string;
  path: string;
  body: unknown;
  label: string;
  createdAt: string;
}

const KEY = "holoLedger.outbox";
const EMPTY: OutboxItem[] = [];
const listeners = new Set<() => void>();
let snapshot: OutboxItem[] | null = null;

function read(): OutboxItem[] {
  if (snapshot === null) snapshot = readJSON<OutboxItem[]>(KEY, []);
  return snapshot;
}

function write(items: OutboxItem[]) {
  snapshot = items;
  writeJSON(KEY, items.length ? items : null);
  listeners.forEach((listener) => listener());
}

export function enqueue(path: string, body: unknown, label: string) {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    path,
    body,
    label,
    createdAt: new Date().toISOString(),
  };
  write([...read(), item]);
}

export function clearOutbox() {
  write([]);
}

let flushing: Promise<{ sent: number; rejected: OutboxItem[] }> | null = null;

/** Send queued writes. Stops at the first network failure; drops items the server rejects. */
export function flushOutbox() {
  flushing ??= (async () => {
    let sent = 0;
    const rejected: OutboxItem[] = [];
    try {
      for (const item of read()) {
        try {
          await api(item.path, { method: "POST", body: item.body });
          sent++;
        } catch (err) {
          if (err instanceof NetworkError) break;
          if (err instanceof ApiError && err.status === 401) break; // wait for a new login
          rejected.push(item);
        }
        write(read().filter((i) => i.id !== item.id));
      }
    } finally {
      flushing = null;
    }
    return { sent, rejected };
  })();
  return flushing;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      snapshot = null; // another tab changed it
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
