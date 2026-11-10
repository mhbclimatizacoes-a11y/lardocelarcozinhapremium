import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";
import { fromPool } from "./db";
import type { AppContext, MediaStore } from "./http";

const media: MediaStore = {
  async put(key, data, meta) {
    const store = getStore({ name: "media", consistency: "strong" });
    await store.set(key, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, {
      metadata: { mime: meta.mime },
    });
  },
  async get(key) {
    const store = getStore({ name: "media", consistency: "strong" });
    const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!res) return null;
    return { data: new Uint8Array(res.data), mime: String(res.metadata?.mime ?? "application/octet-stream") };
  },
};

let cached: AppContext | null = null;

/** Contexto de produção: Netlify Database (via @netlify/database) + Netlify Blobs. */
export function netlifyContext(): AppContext {
  cached ??= {
    db: fromPool(getDatabase().pool),
    env: process.env,
    fetch: globalThis.fetch,
    media,
    now: () => new Date(),
  };
  return cached;
}
