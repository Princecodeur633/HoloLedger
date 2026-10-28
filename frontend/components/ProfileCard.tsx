"use client";

import { ChevronRight, CircleCheck } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

function memberSince(createdAt: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(createdAt),
  );
}

/** Avatar, name, e-mail and sign-up date; becomes a link to the settings when `href` is given. */
export function ProfileCard({ href, className }: { href?: string; className?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const content = (
    <>
      <UserAvatar name={user.username} className="size-14 text-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{user.username}</p>
        {user.phone && (
          <p className="text-muted-foreground flex items-center gap-1.5 truncate text-sm">
            {formatPhone(user.phone)}
            {user.whatsapp_verified && (
              <span className="text-income inline-flex items-center gap-0.5 text-xs font-medium">
                <CircleCheck className="size-3.5" /> WhatsApp
              </span>
            )}
          </p>
        )}
        {user.email && <p className="text-muted-foreground truncate text-sm">{user.email}</p>}
        <p className="text-muted-foreground text-xs">
          Membre depuis {memberSince(user.created_at)}
        </p>
      </div>
      {href && <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
    </>
  );
  const classes = cn("bg-card flex items-center gap-4 rounded-xl border p-4", className);

  return href ? (
    <Link href={href} className={cn(classes, "hover:bg-muted transition-colors")}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
