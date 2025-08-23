export async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try { 
    return JSON.parse(raw || "{}"); 
  } catch { 
    return {}; 
  }
}
