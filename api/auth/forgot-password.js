import { prisma } from "../_lib/db.js";
import { readJson } from "../_lib/http.js";
import { Resend } from "resend";
import crypto from "crypto";
import { z } from "zod";

const Schema = z.object({ email: z.string().email() });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.RESEND_API_KEY) return res.status(501).json({ error: "Email not configured" });

  const body = await readJson(req);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return res.json({ ok: true });

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const host = process.env.RESEND_FROM_EMAIL
    ? "https://uninkabledeckbuilder.com"
    : `https://${req.headers.host}`;
  const resetUrl = `${host}/reset-password?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Reset your Uninkables password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Reset your password</h2>
        <p>Click the link below to set a new password. This link expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="color:#8b5cf6">${resetUrl}</a></p>
        <p style="color:#6b7280;font-size:14px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return res.json({ ok: true });
}
