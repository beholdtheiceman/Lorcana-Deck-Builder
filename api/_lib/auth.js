import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";

const COOKIE = "deckbuilder_auth";
const SECURE = process.env.NODE_ENV === "production";

export function setSession(res, user) {
  const token = jwt.sign(
    { uid: user.id, email: user.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: "7d" }
  );
  
  res.setHeader("Set-Cookie", serialize(COOKIE, token, {
    httpOnly: true, 
    sameSite: "lax", 
    secure: SECURE, 
    path: "/", 
    maxAge: 60 * 60 * 24 * 7
  }));
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", serialize(COOKIE, "", {
    httpOnly: true, 
    sameSite: "lax", 
    secure: SECURE, 
    path: "/", 
    maxAge: 0
  }));
}

export function getSession(req) {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[COOKIE];
  if (!token) return null;
  
  try { 
    return jwt.verify(token, process.env.JWT_SECRET); 
  } catch { 
    return null; 
  }
}
