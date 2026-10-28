"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, getToken, NetworkError, setToken, setUnauthorizedHandler } from "./api";
import { readJSON, writeJSON } from "./storage";
import type { AuthResponse, User } from "./types";

const USER_KEY = "holoLedger.user";
export const API_CACHE = "holoLedger-api";

interface AuthContextValue {
  user: User | null;
  /** True until the stored token has been checked against /auth/me/. */
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    phone: string;
    phone_country: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    // Kept locally so the app still opens offline.
    writeJSON(USER_KEY, next);
  }, []);

  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
    // Cached API answers belong to the user who just left.
    if (typeof caches !== "undefined") caches.delete(API_CACHE).catch(() => {});
  }, [setUser]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    const check = getToken()
      ? api<User>("/auth/me/")
          .then(setUser)
          .catch((err) => {
            // Offline: trust the stored session; any other failure means it is invalid.
            const cached = readJSON<User | null>(USER_KEY, null);
            if (err instanceof NetworkError && cached) setUserState(cached);
            else clear();
          })
      : Promise.resolve();
    check.finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [clear, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      async login(login, password) {
        const res = await api<AuthResponse>("/auth/login/", {
          method: "POST",
          body: { login, password },
        });
        setToken(res.token);
        setUser(res.user);
      },
      async register(data) {
        const res = await api<AuthResponse>("/auth/register/", { method: "POST", body: data });
        setToken(res.token);
        setUser(res.user);
      },
      async logout() {
        try {
          await api("/auth/logout/", { method: "POST" });
        } catch {
          // Logging out locally is enough if the server can't be reached.
        } finally {
          clear();
        }
      },
    }),
    [user, loading, clear, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
