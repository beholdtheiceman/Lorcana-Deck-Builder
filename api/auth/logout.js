import { clearSession } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  clearSession(res);
  res.json({ ok: true });
}
