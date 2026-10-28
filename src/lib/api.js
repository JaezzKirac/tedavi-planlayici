// Sunucu (api/) çağrıları. Oturum HttpOnly çerezde tutulur.
async function call(path, { method = "GET", body } = {}) {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch { /* boş yanıt */ }
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status });
  return data;
}

export const api = {
  me: () => call("/api/me"),
  login: (username, password) => call("/api/login", { method: "POST", body: { username, password } }),
  logout: () => call("/api/logout", { method: "POST" }),
  plans: () => call("/api/plans"),
  createPlan: (data) => call("/api/plans", { method: "POST", body: data }),
  updatePlan: (id, data) => call(`/api/plans?id=${encodeURIComponent(id)}`, { method: "PUT", body: data }),
};
