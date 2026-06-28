import { z } from "zod";
import { prisma } from "../_lib/db.js";
import { withAuth } from "../_lib/withAuth.js";
import { parseReplayZip } from "../_lib/replayParse.js";

/**
 * Replay ingestion endpoint.
 *
 *   POST /api/replays?hubId=...   (raw .match-replay.zip bytes as the body)
 *     - Requires the requester to be owner/member of the hub.
 *     - Parses the zip, derives match metadata, and stores the normalized
 *       `parsed` summary on a Replay row.
 *   GET  /api/replays?hubId=...
 *     - Lists that hub's replays (membership-checked), newest first.
 *
 * TODO(blob-storage): We currently persist ONLY the parsed summary in Postgres.
 * The raw .match-replay.zip is intentionally not stored. When durable raw
 * storage is needed (re-parsing after format fixes, audit, re-review), upload
 * the original bytes to blob storage (e.g. Vercel Blob / S3) and persist the
 * resulting object key on the Replay row.
 */

// We need the raw request body (binary zip), so disable Vercel's JSON body parser.
export const config = {
  api: { bodyParser: false },
};

const GAME_FORMATS = new Set(["Core", "Infinity"]);

/** Read the full raw request body into a Buffer. */
function readRawBody(req) {
  // Some runtimes pre-buffer the body; honor that if present.
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// hubId may come from query (?hubId=) or be omitted there in favor of a header.
const hubIdSchema = z.string().min(1, "hubId is required");

async function assertHubAccess(userId, hubId) {
  const hub = await prisma.hub.findFirst({
    where: { id: hubId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  return hub;
}

/** Derive Replay column values from match.json + parsed summary. */
function deriveMatchMeta(match, parsed) {
  const perspective = parsed.perspectivePlayer ?? null;

  const players = (match.players || [])
    .map((p) => (typeof p === "string" ? p : p?.name))
    .filter(Boolean);
  const playerName = perspective && players.includes(perspective) ? perspective : players[0] ?? null;
  const opponentName = players.find((n) => n !== playerName) ?? null;

  const winner = match.result?.winner ?? null;
  const matchResult = winner == null ? null : winner === playerName ? "W" : "L";

  const rawFormat = match.gameFormat ?? match.format ?? null;
  const format = GAME_FORMATS.has(rawFormat) ? rawFormat : null;

  return {
    source: match.source ?? "unknown",
    matchId: match.matchId ?? null,
    format,
    playerName,
    opponentName,
    matchResult,
    matchScore: match.result?.score ?? null,
  };
}

export default withAuth(async (req, res, session) => {
  const userId = session.uid;

  if (req.method === "GET") {
    const hubId = hubIdSchema.parse(req.query.hubId);

    const hub = await assertHubAccess(userId, hubId);
    if (!hub) return res.status(403).json({ error: "Forbidden" });

    const replays = await prisma.replay.findMany({
      where: { hubId },
      orderBy: { createdAt: "desc" },
      include: { uploader: { select: { id: true, email: true } } },
    });

    return res.status(200).json(replays);
  }

  if (req.method === "POST") {
    const hubId = hubIdSchema.parse(req.query.hubId ?? req.headers["x-hub-id"]);

    const hub = await assertHubAccess(userId, hubId);
    if (!hub) return res.status(403).json({ error: "Forbidden" });

    const raw = await readRawBody(req);
    if (!raw || raw.length === 0) {
      return res.status(400).json({ error: "Empty request body (expected a .match-replay.zip)" });
    }

    // parseReplayZip re-reads match.json internally; we also need a couple of
    // match-level fields for the Replay columns, so read it once here too.
    let parsed;
    try {
      parsed = await parseReplayZip(raw);
    } catch (err) {
      // Bad/unsupported archive -> client error, not a 500.
      return res.status(422).json({ error: "Could not parse replay archive" });
    }

    // Re-extract match.json for column metadata (cheap; archive already in mem).
    let match = {};
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(raw);
      const matchFile = zip.file("match.json");
      if (matchFile) match = JSON.parse(await matchFile.async("string"));
    } catch {
      // Non-fatal: parsed already succeeded; fall back to nulls for metadata.
    }

    const meta = deriveMatchMeta(match, parsed);

    const replay = await prisma.replay.create({
      data: {
        hubId,
        uploaderId: userId,
        source: meta.source,
        matchId: meta.matchId,
        format: meta.format,
        playerName: meta.playerName,
        opponentName: meta.opponentName,
        matchResult: meta.matchResult,
        matchScore: meta.matchScore,
        parsed,
      },
    });

    return res.status(201).json(replay);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
