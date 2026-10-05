"use client";

/** fetch wrapper for our JSON API; throws the API's error message. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

/** Presigned upload: ask our API for a PUT URL, send the file straight to S3, return what to tell the API next. */
export async function uploadFile(presignPath: string, file: File) {
  const p = await api<{ url: string; key: string; headers: Record<string, string> }>(presignPath, { json: { mime: file.type, size: file.size } });
  const res = await fetch(p.url, { method: "PUT", headers: p.headers, body: file }).catch(() => null);
  if (!res?.ok) throw new Error("Could not upload the file to storage. Try again.");
  return { key: p.key, name: file.name };
}
