import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { loadLogo } from "../src/logos.js";
import { createBoard, rankBoard } from "../src/board.js";
import { png } from "../src/render.js";
test("logo loads from fixed service, survives moves, and is embedded in exported PNG", async () => {
  const red = await sharp({
    create: { width: 64, height: 64, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const logo = await loadLogo("example.com", (async (url: any) => {
    assert.equal(new URL(url).hostname, "www.google.com");
    assert.equal(new URL(url).searchParams.get("domain"), "example.com");
    return new Response(red, { headers: { "content-type": "image/png" } });
  }) as typeof fetch);
  assert.ok(logo);
  const initial = createBoard("Test", [{ label: "Example", logo }]);
  const moved = rankBoard(initial, [{ item: "Example", tier: "S" }]);
  assert.equal(moved.items[0]!.logo, logo);
  const pixel = await sharp(await png(moved))
    .extract({ left: 225, top: 130, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.deepEqual([...pixel], [255, 0, 0]);
});
test("missing, oversized, and invalid logos fall back without breaking the list", async () => {
  for (const response of [
    new Response("", { status: 404 }),
    new Response("x".repeat(256001)),
    new Response("not an image"),
  ]) {
    assert.equal(
      await loadLogo("example.com", (async () => response) as typeof fetch),
      undefined,
    );
  }
});
