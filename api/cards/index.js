import { prisma } from "../_lib/db.js";

// Normalize a single-word ink to Lorcast's capitalization ("amber" -> "Amber")
// so the exact-match `has` filter is forgiving about caller casing.
function titleCase(s) {
  const t = String(s).trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;
}

// GET /api/cards — read-only query over the locally mirrored Card table.
// Query params (all optional):
//   q       case-insensitive substring match on name
//   ink     exact ink match (e.g. "Amber"); case-forgiving
//   set     set code (e.g. "1", "D23"); case-forgiving
//   maxCost maximum ink cost (inclusive)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { q, ink, set, maxCost } = req.query || {};
  const where = {};

  if (q && String(q).trim()) {
    where.name = { contains: String(q).trim(), mode: "insensitive" };
  }
  if (ink && String(ink).trim()) {
    where.inks = { has: titleCase(ink) };
  }
  if (set && String(set).trim()) {
    where.setCode = String(set).trim().toUpperCase();
  }
  if (maxCost != null && String(maxCost).trim() !== "") {
    const mc = Number(maxCost);
    if (Number.isFinite(mc)) where.cost = { lte: mc };
  }

  try {
    const cards = await prisma.card.findMany({
      where,
      orderBy: [{ setNum: "asc" }, { number: "asc" }],
      take: 1000,
    });
    return res.status(200).json({ count: cards.length, cards });
  } catch (err) {
    console.error("[cards/index] query failed:", err?.message ?? err);
    return res.status(500).json({ error: "Query failed" });
  }
}
