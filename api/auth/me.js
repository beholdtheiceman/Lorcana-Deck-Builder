import { getSession } from "../_lib/auth.js";

export default async function handler(req, res) {
  const sess = getSession(req);
  res.json({ user: sess ? { id: sess.uid, email: sess.email } : null });
}
