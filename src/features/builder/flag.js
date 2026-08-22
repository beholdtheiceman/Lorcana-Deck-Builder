/**
 * Gate for the rebuilt deck builder.
 *
 * The localStorage override is what lets the team dogfood `/builder2` on a
 * Vercel preview without a redeploy. This flag is temporary — it exists to
 * allow side-by-side comparison with the old builder and is removed when
 * `/builder` swaps over.
 */
export function isNewBuilderEnabled() {
  try {
    if (localStorage.getItem('newBuilder') === '1') return true
  } catch {
    // localStorage can throw in private-mode or sandboxed contexts.
  }

  try {
    return import.meta.env?.VITE_NEW_BUILDER === '1'
  } catch {
    return false
  }
}

export default isNewBuilderEnabled
