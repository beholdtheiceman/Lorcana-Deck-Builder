import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { setSession } from "../_lib/auth.js";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body = await readJson(req);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "Reset link is invalid or has expired" });
  }

  const cost = Number(process.env.BCRYPT_COST || 12);
  const passwordHash = await bcrypt.hash(password, cost);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  setSession(res, record.user);
  return res.json({ ok: true });
}
