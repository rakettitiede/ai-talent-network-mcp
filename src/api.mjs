import { AGILEDAY_BASE_URL } from "./constants.mjs";

export async function api({ path, method = "GET", body, token }) {
  const res = await fetch(`${AGILEDAY_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}
