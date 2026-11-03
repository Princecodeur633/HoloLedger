import {
  Briefcase,
  CarTaxiFront,
  Coins,
  Gem,
  Globe,
  GraduationCap,
  Handshake,
  HardHat,
  Heart,
  HeartHandshake,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  Package,
  RefreshCw,
  Scissors,
  ShoppingBag,
  Star,
  Store,
  Target,
  TreePine,
  User,
  Users,
  Utensils,
  Wheat,
} from "lucide-react";
import { createElement } from "react";

import type { SpaceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Spaces store a short emoji key (kept for compatibility); it is drawn as a line icon so it
 * looks the same on every phone and matches the rest of the app.
 */
export const SPACE_GLYPHS: Record<string, LucideIcon> = {
  "👤": User,
  "⭐": Star,
  "🎯": Target,
  "🏠": House,
  "💑": HeartHandshake,
  "❤️": Heart,
  "💍": Gem,
  "💼": Briefcase,
  "🛍️": ShoppingBag,
  "🏪": Store,
  "🍽️": Utensils,
  "🚕": CarTaxiFront,
  "✂️": Scissors,
  "🏗️": HardHat,
  "💻": Laptop,
  "🌾": Wheat,
  "📦": Package,
  "🔄": RefreshCw,
  "🤝": Handshake,
  "💰": Coins,
  "🌍": Globe,
  "👨‍👩‍👧": Users,
  "🌳": TreePine,
  "👵": HeartPulse,
  "🎓": GraduationCap,
};

const KIND_DEFAULT: Record<SpaceKind, LucideIcon> = {
  personal: User,
  couple: HeartHandshake,
  business: Briefcase,
  tontine: RefreshCw,
  family: Users,
};

export function spaceGlyph(icon: string | undefined, kind?: SpaceKind) {
  return (icon && SPACE_GLYPHS[icon]) || (kind ? KIND_DEFAULT[kind] : User);
}

/** Round neutral badge with the space's line icon. */
export function SpaceIcon({
  icon,
  kind,
  className,
  iconClassName,
}: {
  icon?: string;
  kind?: SpaceKind;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-full",
        className,
      )}
    >
      {createElement(spaceGlyph(icon, kind), {
        className: cn("size-[45%]", iconClassName),
        strokeWidth: 1.75,
      })}
    </span>
  );
}
