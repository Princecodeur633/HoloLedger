/** Id of the space the app currently works in, remembered on this device. */
import { readJSON, writeJSON } from "./storage";

const KEY = "holoLedger.space";
const listeners = new Set<() => void>();
let current: string | null | undefined;

export function getSpaceId(): string | null {
  if (current === undefined) current = typeof window === "undefined" ? null : readJSON(KEY, null);
  return current ?? null;
}

export function setSpaceId(id: string | null) {
  current = id;
  writeJSON(KEY, id);
  listeners.forEach((listener) => listener());
}

export function subscribeSpace(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** API paths that are about the person, not about one space. */
const PERSON_LEVEL = ["/auth/", "/spaces/", "/invitations/", "/reminders/", "/notifications/"];

export function isSpaceScoped(path: string) {
  return !PERSON_LEVEL.some((prefix) => path.startsWith(prefix));
}
