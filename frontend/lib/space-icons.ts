import type { SpaceKind } from "./types";

/** Emoji choices offered when naming a space. */
export const SPACE_ICONS: Record<SpaceKind, string[]> = {
  personal: ["👤", "🙂", "😎", "🦁", "🐺", "⭐"],
  couple: ["💑", "❤️", "🏠", "💍", "👨‍👩‍👧", "🌹"],
  business: ["💼", "🛍️", "🏪", "🍽️", "🚕", "✂️", "🏗️", "💻", "🌾", "📦"],
  tontine: ["🔄", "🤝", "💰", "🌍", "⭐", "🎯"],
  family: ["👨‍👩‍👧", "🏠", "🌳", "❤️", "👵", "🎓"],
};
