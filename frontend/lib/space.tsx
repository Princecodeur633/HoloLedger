"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "react";

import { api } from "./api";
import { useAuth } from "./auth";
import { getSpaceId, setSpaceId, subscribeSpace } from "./space-store";
import type { Invitation, Space, SpaceKind } from "./types";

export const SPACE_KINDS: Record<SpaceKind, { label: string; icon: string }> = {
  personal: { label: "Personnel", icon: "👤" },
  couple: { label: "Couple", icon: "💑" },
  business: { label: "Business", icon: "💼" },
  tontine: { label: "Tontine", icon: "🔄" },
  family: { label: "Famille", icon: "👨‍👩‍👧" },
};

interface SpaceContextValue {
  spaces: Space[] | null;
  /** The space the app works in (personal until the list is loaded). */
  current: Space | null;
  invitations: Invitation[];
  switchTo: (id: string) => void;
  reload: () => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [version, setVersion] = useState(0);
  const currentId = useSyncExternalStore(subscribeSpace, getSpaceId, () => null);

  useEffect(() => {
    if (!user) {
      // Forget the space only once logged out: while the session is still being checked
      // after a reload, `user` is briefly null and the chosen space must survive.
      if (!loading) setSpaceId(null);
      return;
    }
    let cancelled = false;
    Promise.all([api<Space[]>("/spaces/"), api<Invitation[]>("/invitations/")])
      .then(([list, received]) => {
        if (cancelled) return;
        setSpaces(list);
        setInvitations(received);
        // A space left or deleted elsewhere: fall back to the personal one.
        if (!list.some((s) => s.id === getSpaceId())) {
          setSpaceId(list.find((s) => s.kind === "personal")?.id ?? null);
        }
      })
      .catch(() => {
        // Offline: keep working in the remembered space.
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const switchTo = useCallback((id: string) => setSpaceId(id), []);

  const value = useMemo<SpaceContextValue>(() => {
    const visible = user ? spaces : null;
    const current =
      visible?.find((s) => s.id === currentId) ??
      visible?.find((s) => s.kind === "personal") ??
      null;
    return { spaces: visible, current, invitations: user ? invitations : [], switchTo, reload };
  }, [user, spaces, currentId, invitations, switchTo, reload]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error("useSpace must be used inside <SpaceProvider>");
  return ctx;
}

/** Currency of the current space (each space keeps its own). */
export function useCurrency() {
  const { current } = useSpace();
  const { user } = useAuth();
  return current?.currency ?? user?.currency ?? "XAF";
}

/** Wording that changes with the kind of space. */
export function spaceWords(kind: SpaceKind | undefined) {
  if (kind === "business")
    return {
      income: "Chiffre d’affaires",
      expense: "Dépenses",
      net: "Bénéfice",
      owedToMe: "Clients",
      iOwe: "Fournisseurs",
      debts: "Clients et fournisseurs",
    };
  return {
    income: "Revenus",
    expense: "Dépenses",
    net: "Résultat",
    owedToMe: "On me doit",
    iOwe: "Je dois",
    debts: "Dettes et prêts",
  };
}
