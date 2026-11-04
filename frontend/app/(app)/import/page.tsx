"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Importing now lives in "+" (tab "Relevé"); old links and bookmarks land there. */
export default function ImportPage() {
  const router = useRouter();
  useEffect(() => router.replace("/transactions/new?tab=releve"), [router]);
  return null;
}
