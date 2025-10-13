// src/api/client.js
export const API_BASE = "http://127.0.0.1:8000";

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error("status fetch failed");
  return res.json();
}
