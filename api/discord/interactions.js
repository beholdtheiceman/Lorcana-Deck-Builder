import crypto from "crypto";

/**
 * Discord Interactions endpoint (inbound intake).
 *
 * Configure in the Discord developer portal as the app's "Interactions Endpoint
 * URL": https://<your-app>/api/discord/interactions  (set DISCORD_PUBLIC_KEY).
 * Discord verifies the URL by sending a signed PING; we must echo a PONG.
 *
 * Requires the RAW request body for signature verification, so body parsing is
 * disabled here.
 */
export const config = { api: { bodyParser: false } };

// SPKI DER prefix for a raw 32-byte Ed25519 public key.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function ed25519KeyFromHex(hex) {
  const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(hex, "hex")]);
  return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
}

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

const reply = (res, content, ephemeral = false) =>
  res.status(200).json({ type: 4, data: { content, ...(ephemeral ? { flags: 64 } : {}) } });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(501).json({ error: "Discord intake not configured (set DISCORD_PUBLIC_KEY)." });
  }

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const body = await readRawBody(req);
  if (!signature || !timestamp) return res.status(401).json({ error: "missing signature headers" });

  let valid = false;
  try {
    valid = crypto.verify(
      null,
      Buffer.concat([Buffer.from(timestamp), body]),
      ed25519KeyFromHex(publicKey),
      Buffer.from(signature, "hex")
    );
  } catch {
    valid = false;
  }
  if (!valid) return res.status(401).json({ error: "invalid request signature" });

  let interaction;
  try {
    interaction = JSON.parse(body.toString() || "{}");
  } catch {
    return res.status(400).json({ error: "invalid JSON" });
  }

  // 1 = PING (URL verification + keepalive)
  if (interaction.type === 1) return res.status(200).json({ type: 1 });

  // 2 = APPLICATION_COMMAND (slash command)
  if (interaction.type === 2) {
    const name = interaction.data?.name;
    const opts = Object.fromEntries((interaction.data?.options ?? []).map((o) => [o.name, o.value]));

    if (name === "lorcana-review") {
      // Filing reviews from Discord is disabled: a hub invite code is not proof
      // of hub membership, and there is currently no Discord-user -> hub-member
      // identity link to authorize the write against. Re-enable once that link
      // exists (see H3 in POSTMORTEM.md). Until then, reject rather than let
      // anyone with an invite code write into a team's review archive.
      return reply(
        res,
        "⚠️ Filing reviews from Discord is temporarily unavailable. Please file reviews from the web app while we add account linking.",
        true
      );
    }

    return reply(res, "Unknown command.", true);
  }

  return res.status(200).json({ type: 1 });
}
