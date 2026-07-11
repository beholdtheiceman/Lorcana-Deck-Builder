// scripts/ingest-cards.mjs
// Runs the server-side Lorcast catalog ingest against the local `Card` table.
//
// Usage: node scripts/ingest-cards.mjs
//
// Fetches the full Lorcana catalog from the Lorcast API and upserts every card
// into Postgres via api/_lib/cardIngest.js. ADDITIVE — nothing in the live app
// reads from this table yet.

import { ingestCards } from "../api/_lib/cardIngest.js";

async function main() {
  console.log("[ingest-cards] Fetching full Lorcast catalog and upserting...");
  const summary = await ingestCards();
  console.log(
    `[ingest-cards] Done. fetched=${summary.fetched} upserted=${summary.upserted}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ingest-cards] ERROR:", err?.message ?? err);
    process.exit(1);
  });
