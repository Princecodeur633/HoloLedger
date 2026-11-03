import type { SpaceKind } from "./types";

/** Icon choices offered when naming a space (keys drawn as line icons, see SpaceIcon). */
export const SPACE_ICONS: Record<SpaceKind, string[]> = {
  personal: ["👤", "⭐", "🎯", "🏠"],
  couple: ["💑", "❤️", "🏠", "💍"],
  business: ["💼", "🛍️", "🏪", "🍽️", "🚕", "✂️", "🏗️", "💻", "🌾", "📦"],
  tontine: ["🔄", "🤝", "💰", "🌍", "⭐", "🎯"],
  family: ["👨‍👩‍👧", "🏠", "🌳", "❤️", "👵", "🎓"],
};
