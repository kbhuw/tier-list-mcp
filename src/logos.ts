import sharp from "sharp";
import type { Board } from "./board.js";

// Only the fixed favicon service is contacted, never a user-supplied URL.
export async function loadLogo(
  domain: string,
  request: typeof fetch = fetch,
): Promise<string | undefined> {
  try {
    const url = new URL("https://www.google.com/s2/favicons");
    url.searchParams.set("domain", domain);
    url.searchParams.set("sz", "128");
    const response = await request(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 256_000) {
          await reader.cancel();
          return;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const data = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 1_000_000,
    })
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return;
  }
}
export async function withLogos(input: Board): Promise<Board> {
  const board = structuredClone(input);
  for (let offset = 0; offset < board.items.length; offset += 6) {
    await Promise.all(
      board.items.slice(offset, offset + 6).map(async (item) => {
        if (item.logo) return;
        const domain =
          item.logoDomain ??
          (item.source ? new URL(item.source).hostname : undefined);
        if (domain) item.logo = await loadLogo(domain);
      }),
    );
  }
  return board;
}
