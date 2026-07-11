import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { setSession } from "../_lib/auth.js";
import { rateLimit, clientIp } from "../_lib/rateLimit.js";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Login = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Throttle online password guessing (per IP).
  const rl = await rateLimit(`login:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many attempts, try again shortly" });
  }

  const body = await readJson(req);
  const parsed = Login.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  setSession(res, user);
  return res.json({ ok: true, user: { id: user.id, email: user.email } });
}
