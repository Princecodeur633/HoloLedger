const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "holoLedger.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): the session lasts until reload.
  }
}

/** Error carrying DRF's field errors, e.g. { amount: ["..."] }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown> | null,
  ) {
    super(ApiError.describe(data) ?? `Erreur ${status}`);
  }

  static describe(data: Record<string, unknown> | null): string | null {
    if (!data) return null;
    if (typeof data.detail === "string") return data.detail;
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
    return null;
  }

  fieldError(field: string): string | undefined {
    const value = this.data?.[field];
    return Array.isArray(value) ? String(value[0]) : undefined;
  }
}

export type Query = Record<string, string | number | undefined | null>;

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** The server could not be reached (offline, DNS, server down…). */
export class NetworkError extends Error {
  constructor() {
    super("Impossible de contacter le serveur.");
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; query?: Query },
  accept: string,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body; // the browser sets the multipart boundary itself
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${buildQuery(options.query)}`, {
      method: options.method ?? "GET",
      headers,
      body,
    });
  } catch {
    throw new NetworkError();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data);
  }
  return res;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const res = await request(path, options, "application/json");
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch an authenticated file and hand it to the browser as a download. */
export async function download(path: string, query: Query, fallbackName: string) {
  const res = await request(path, { query }, "*/*");
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
