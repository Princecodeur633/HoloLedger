import Image from "next/image";

import { cn } from "@/lib/utils";

/** Official wolf logo: black on the light theme, white on the dark one. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image
        src="/logo/holoLedger-black.png"
        alt="HoloLedger"
        width={384}
        height={384}
        priority={priority}
        className={cn("shrink-0 dark:hidden", className)}
      />
      <Image
        src="/logo/holoLedger-white.png"
        alt=""
        aria-hidden
        width={384}
        height={384}
        priority={priority}
        className={cn("hidden shrink-0 dark:block", className)}
      />
    </>
  );
}
