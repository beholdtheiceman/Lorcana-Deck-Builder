/**
 * Minimal Discord webhook poster for the team hub bridge.
 *
 * Discord incoming webhooks accept a JSON body with `content` (and optionally
 * `embeds`). We keep it to plain `content` for now. Failures are swallowed and
 * logged: a notification problem must never break the primary action (creating
 * an event, filing a review, etc.).
 *
 * @param {string|null|undefined} webhookUrl - the hub's configured webhook URL
 * @param {string} content - message text (<= 2000 chars per Discord limits)
 * @returns {Promise<boolean>} true if Discord accepted the message
 */
export async function postDiscord(webhookUrl, content) {
  if (!webhookUrl || typeof webhookUrl !== "string") return false;
  // Only accept real Discord webhook URLs to avoid being used as an open relay.
  if (!/^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(webhookUrl)) {
    console.warn("[discord] refusing non-Discord webhook URL");
    return false;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: String(content).slice(0, 2000) }),
    });
    if (!res.ok) {
      console.warn(`[discord] webhook responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[discord] webhook post failed:", err?.message ?? err);
    return false;
  }
}
