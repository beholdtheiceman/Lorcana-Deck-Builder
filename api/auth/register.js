import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { setSession } from "../_lib/auth.js";
import bcrypt from "bcrypt";
import { z } from "zod";

const Register = z.object({ 
  email: z.string().email(), 
  password: z.string().min(8).max(128) 
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const body = await readJson(req);
  const parsed = Register.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already in use" });

  const cost = Number(process.env.BCRYPT_COST || 12);
  const passwordHash = await bcrypt.hash(password, cost);
  const user = await prisma.user.create({ 
    data: { email, passwordHash }, 
    select: { id: true, email: true } 
  });

  setSession(res, user);
  return res.json({ ok: true, user: { id: user.id, email: user.email } });
}
