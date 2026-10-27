import {
  Baby,
  Briefcase,
  Bus,
  Car,
  Coins,
  Droplet,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PartyPopper,
  PiggyBank,
  Plane,
  Receipt,
  RotateCcw,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Store,
  Tag,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Icon keys stored in Category.icon (kebab-case, matching the backend defaults). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "shopping-basket": ShoppingBasket,
  bus: Bus,
  car: Car,
  home: House,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "party-popper": PartyPopper,
  users: Users,
  baby: Baby,
  utensils: Utensils,
  shirt: Shirt,
  smartphone: Smartphone,
  wifi: Wifi,
  zap: Zap,
  droplet: Droplet,
  dumbbell: Dumbbell,
  plane: Plane,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  gift: Gift,
  "rotate-ccw": RotateCcw,
  coins: Coins,
  wallet: Wallet,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  tag: Tag,
};

export const CATEGORY_COLORS = [
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#64748b",
];

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}
