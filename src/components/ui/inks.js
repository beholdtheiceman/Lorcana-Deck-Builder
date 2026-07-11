// Ink-name → design-token mapping for the six Lorcana inks (see src/tokens.css).
// Every hex/ledger/curve primitive resolves colors through this so a token
// change re-skins all of them at once.

export const INK_NAMES = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"];

/** CSS color for an ink name (case-insensitive). Falls back to steel. */
export function inkVar(ink) {
  const k = String(ink || "").toLowerCase();
  return INK_NAMES.some((n) => n.toLowerCase() === k) ? `var(--${k})` : "var(--steel)";
}
