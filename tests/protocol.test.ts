import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

test("real MCP transport: discovery, view resource, ranking, export, invalid move", async () => {
  const server = spawn(
    "node_modules/.bin/mcp-use",
    ["start", "--port", "3418"],
    { stdio: "pipe" },
  );
  let logs = "";
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  const client = new Client(
    { name: "tier-list-eval", version: "1.0.0" },
    { capabilities: {} },
  );
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fetch("http://127.0.0.1:3418/mcp");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(ready, logs);
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3418/mcp")),
    );
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 4);
    const resources = await client.listResources();
    assert.ok(resources.resources.length >= 4);
    const view = await client.readResource({
      uri: resources.resources[0]!.uri,
    });
    assert.ok(view.contents.length);
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      assert.ok(!r.isError, JSON.stringify(r));
      return r as any;
    };
    const start = await call("create-tier-list", {
      title: "Agent frameworks",
      options: [
        "LangGraph",
        "CrewAI",
        "AutoGen",
        "Mastra",
        "PydanticAI",
        "OpenAI Agents SDK",
      ].map((label) => ({ label })),
    });
    assert.equal(
      start.structuredContent.board.items.every((i: any) => i.tier === null),
      true,
    );
    const first = await call("rank-tier-list", {
      board: start.structuredContent.board,
      moves: [
        { item: "LangGraph", tier: "S" },
        { item: "CrewAI", tier: "A" },
      ],
    });
    const second = await call("rank-tier-list", {
      board: first.structuredContent.board,
      moves: [
        { item: "CrewAI", tier: "B" },
        { item: "Mastra", tier: "A" },
      ],
    });
    assert.equal(
      second.structuredContent.board.items.find(
        (i: any) => i.label === "LangGraph",
      ).tier,
      "S",
    );
    const download = await call("download-tier-list", {
      board: second.structuredContent.board,
    });
    const file = download.content.find(
      (c: any) => c.type === "resource",
    ).resource;
    const bytes = Buffer.from(file.blob, "base64");
    assert.equal((await sharp(bytes).metadata()).format, "png");
    assert.equal(
      file.blob,
      download.content.find((c: any) => c.type === "image").data,
    );
    const invalid = await client.callTool({
      name: "rank-tier-list",
      arguments: {
        board: second.structuredContent.board,
        moves: [{ item: "Imaginary framework", tier: "S" }],
      },
    });
    assert.equal(invalid.isError, true);
    for (const category of [
      { title: "Fruit", options: ["Mango", "Pear", "Peach"] },
      {
        title: "Weekend activities",
        options: ["Hiking", "Reading", "Cooking"],
      },
    ]) {
      const r = await call("create-tier-list", {
        title: category.title,
        options: category.options.map((label) => ({ label })),
      });
      assert.equal(r.structuredContent.board.items.length, 3);
    }
    if (process.env.EVAL_OUTPUT_DIR) {
      await mkdir(process.env.EVAL_OUTPUT_DIR, { recursive: true });
      for (const [name, result] of [
        ["options", start],
        ["first-ranking", first],
        ["corrected-ranking", second],
        ["download", download],
      ] as const) {
        await writeFile(
          `${process.env.EVAL_OUTPUT_DIR}/${name}.png`,
          Buffer.from(
            result.content.find((c: any) => c.type === "image").data,
            "base64",
          ),
        );
      }
      await writeFile(
        `${process.env.EVAL_OUTPUT_DIR}/board.json`,
        JSON.stringify(second.structuredContent.board, null, 2),
      );
    }
  } finally {
    await client.close();
    server.kill();
  }
});
