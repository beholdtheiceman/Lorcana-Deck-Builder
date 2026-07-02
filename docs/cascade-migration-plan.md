# Prisma cascade / onDelete migration plan (DRAFT — not applied)

**Status:** review-only. Nothing in this doc has been run. It touches the **production
Neon DB**, so apply it deliberately (ideally *after* rotating the leaked
`DATABASE_URL` / `JWT_SECRET`), not as a drive-by change.

## Problem

Six `User` relations in `prisma/schema.prisma` have **no `onDelete`** (Prisma defaults
to `Restrict`), while the rest of the schema consistently cascades. There is **no
account-deletion endpoint today**, so this is latent — but the day one is added,
deleting any user who ever uploaded a replay, logged a game, created an
event/practice, or authored a report will throw Prisma `P2003` (FK constraint).

| Model | Line | Relation field | FK column | Nullable today? |
|---|---|---|---|---|
| `Replay` | 187 | `uploader User` | `uploaderId` | no |
| `Review` | 214 | `author User?` | `authorId` | **yes** |
| `PlaytestGame` | 240 | `loggedBy User` | `loggedById` | no |
| `Event` | 263 | `createdBy User` | `createdById` | no |
| `Practice` | 284 | `createdBy User` | `createdById` | no |
| `MetaReport` | 366 | `author User` | `authorId` | no |

## Recommended policy: preserve team history, anonymize author

These records are **shared team history** (a departed member's replays, logged games,
reports should not vanish from a hub). So the recommended fix is: make each author FK
**nullable** and set `onDelete: SetNull`. `Review.author` is already nullable — it just
needs `SetNull`.

### schema.prisma edits (proposed)

```prisma
// Replay (line ~175/187)
uploaderId    String?                                   // was: String
uploader      User?   @relation(fields: [uploaderId], references: [id], onDelete: SetNull)

// Review (line ~214) — already nullable, just add the action
author        User?   @relation(fields: [authorId], references: [id], onDelete: SetNull)

// PlaytestGame (line ~228/240)
loggedById    String?                                   // was: String
loggedBy      User?   @relation(fields: [loggedById], references: [id], onDelete: SetNull)

// Event (line ~254/263)
createdById   String?                                   // was: String
createdBy     User?   @relation(fields: [createdById], references: [id], onDelete: SetNull)

// Practice (line ~277/284)
createdById   String?                                   // was: String
createdBy     User?   @relation(fields: [createdById], references: [id], onDelete: SetNull)

// MetaReport (line ~358/366)
authorId      String?                                   // was: String
author        User?   @relation(fields: [authorId], references: [id], onDelete: SetNull)
```

Any UI/api that renders `x.author.email` / `x.uploader.email` must then handle a
`null` author (e.g. show "former member"). Grep before applying:
`git grep -nE '\.(uploader|author|loggedBy|createdBy)\b'`.

### Alternative: cascade-delete

If instead a user's content *should* be deleted with them, use
`onDelete: Cascade` and keep the FKs non-nullable. Simpler migration, but destroys
hub history. Not recommended for the five team-content models.

## How to apply (when ready)

1. Rotate secrets first; confirm `DATABASE_URL` points where you expect.
2. Make the schema edits above.
3. Generate a migration WITHOUT applying, and read the SQL:
   `npx prisma migrate dev --create-only --name user_ondelete_setnull`
   - Verify it only `ALTER`s the six columns to nullable and rewrites the six FK
     constraints to `ON DELETE SET NULL`. No data loss expected (nullable widening +
     constraint swap).
4. Apply to prod: `npx prisma migrate deploy` (against the prod `DATABASE_URL`).
5. Redeploy so the generated client matches.

## Related audit follow-ups (separate work)

- **Rate limiting** on `login`/`register`/`forgot-password`/`hubs/join` — needs an
  external store (Upstash/Redis) because serverless has no shared memory.
- **`api/hubs/[id]/members.js`** hand-rolls auth; move it onto the shared `withAuth`.
- **Dependency advisories** (`npm audit`): `cookie <0.7` and dev-only `esbuild`/`vite`
  — both require major bumps; low real risk here.
