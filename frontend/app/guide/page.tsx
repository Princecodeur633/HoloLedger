import { ChevronDown, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";
import { loadGuide } from "@/lib/guide";

export const metadata: Metadata = {
  title: "Guide — HoloLedger",
  description: "Comment utiliser HoloLedger, fiche par fiche.",
};

/** **bold** → <strong>: the only markdown used inside the guide's sentences. */
function Text({ children }: { children: string }) {
  return children.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="text-foreground font-semibold">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default function GuidePage() {
  const guide = loadGuide();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ChevronLeft /> Retour
        </Link>
        <Logo className="size-10" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{guide.title}</h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">{guide.intro}</p>

      {/* Table of contents as quick chips. */}
      <nav aria-label="Sommaire" className="mb-5 flex flex-wrap gap-2">
        {guide.sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="hover:bg-muted rounded-full border px-3 py-1 text-xs transition-colors"
          >
            {s.emoji} {s.title}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-2">
        {guide.sections.map((s, index) => (
          <details
            key={s.id}
            id={s.id}
            open={index === 0}
            className="group bg-card scroll-mt-4 rounded-xl border"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full text-lg">
                {s.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="text-muted-foreground block text-sm">{s.summary}</span>
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>

            <div className="flex flex-col gap-3 border-t px-4 pt-3 pb-4 text-sm">
              {s.why && (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-semibold">Pourquoi ? </span>
                  <Text>{s.why}</Text>
                </p>
              )}
              {s.steps.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Comment ?</p>
                  <ol className="flex flex-col gap-2">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="bg-foreground text-background flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">
                          <Text>{step}</Text>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {s.tip && (
                <p className="bg-muted flex gap-2 rounded-lg p-2.5 text-xs">
                  <Lightbulb className="size-4 shrink-0" />
                  <span>
                    <Text>{s.tip}</Text>
                  </span>
                </p>
              )}
              {s.link && (
                <Link
                  href={s.link.href}
                  className={buttonVariants({ size: "sm", className: "self-start" })}
                >
                  {s.link.label} <ChevronRight />
                </Link>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
