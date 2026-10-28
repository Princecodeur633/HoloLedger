"use client";

import { useApi } from "./use-api";

/** Whether the server has WhatsApp configured; false while loading or offline. */
export function useWhatsAppEnabled() {
  const { data } = useApi<{ enabled: boolean }>("/auth/whatsapp/");
  return data?.enabled ?? false;
}
