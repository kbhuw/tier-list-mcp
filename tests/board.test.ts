import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createBoard, rankBoard } from "../src/board.js";
import { png, svg } from "../src/render.js";
const options = ["LangGraph", "CrewAI", "AutoGen", "Mastra", "PydanticAI"].map(
  (label) => ({ label }),
);
test("category -> options -> incremental ranking -> correction -> unrank -> download", async () => {
  const initial = createBoard("Agent frameworks", options);
  assert.equal(initial.items.filter((i) => i.tier === null).length, 5);
  const first = rankBoard(initial, [
    { item: "LangGraph", tier: "S" },
    { item: "CrewAI", tier: "A" },
  ]);
  const next = rankBoard(first, [{ item: "AutoGen", tier: "B" }]);
  assert.equal(next.items.find((i) => i.label === "LangGraph")?.tier, "S");
  const corrected = rankBoard(next, [
    { item: "CrewAI", tier: "S", position: 0 },
  ]);
  assert.deepEqual(
    corrected.items.filter((i) => i.tier === "S").map((i) => i.label),
    ["CrewAI", "LangGraph"],
  );
  const last = rankBoard(corrected, [{ item: "AutoGen", tier: null }]);
  assert.equal(last.items.length, 5);
  assert.equal(last.revision, 4);
  assert.equal(
    initial.items.every((i) => i.tier === null),
    true,
    "prior snapshots remain valid for undo",
  );
  const bytes = await png(last);
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1104);
  assert.notDeepEqual(
    await png(initial),
    bytes,
    "preview changes with ranking",
  );
});
test("invalid batches are atomic and reject ambiguous or duplicate identities", () => {
  const initial = createBoard("Any category", options);
  assert.throws(() =>
    rankBoard(initial, [
      { item: "CrewAI", tier: "S" },
      { item: "missing", tier: "B" },
    ]),
  );
  assert.equal(
    initial.items.every((i) => i.tier === null),
    true,
  );
  assert.throws(() => rankBoard(initial, [{ item: "CrewAI", tier: "F" }]));
  assert.throws(() =>
    rankBoard(initial, [
      { item: "CrewAI", tier: "S" },
      { item: "item-2", tier: "A" },
    ]),
  );
  assert.throws(() =>
    createBoard("Duplicates", [{ label: "Cat" }, { label: "cat" }]),
  );
});
test("arbitrary category, custom tiers, escaped markup, and wrapped labels", async () => {
  const board = createBoard(
    "Fruit < & >",
    [{ label: "Apple" }, { label: "Orange" }, { label: "a".repeat(60) }],
    [
      { name: "Love", color: "#ffaaaa" },
      { name: "Skip", color: "#aaaaee" },
    ],
  );
  const ranked = rankBoard(board, [{ item: "Apple", tier: "Love" }]);
  assert.match(svg(ranked), /Fruit &lt; &amp; &gt;/);
  assert.equal((await sharp(await png(ranked)).metadata()).format, "png");
  assert.doesNotMatch(svg(ranked, false), /Orange/);
});
