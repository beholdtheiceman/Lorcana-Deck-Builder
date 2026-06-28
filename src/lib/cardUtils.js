// Pure card helpers extracted from App.jsx (M5 decomposition — first safe slice).
// Behavior is identical to the original in-file definitions.

// Card types (simplified). "Song" represents "Action - Song" cards from the API.
export const CARD_TYPES = ["Character", "Action", "Item", "Location", "Song"];

/** Best-effort image URL for a card across the various API field shapes. */
export function getCardImg(card) {
  // Use multiple image sources for better compatibility
  const u = card.image_url || card._imageFromAPI || card.image || "";
  return u;
}
