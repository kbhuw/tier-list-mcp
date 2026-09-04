import { MCPServer } from "mcp-use";
import { z } from "zod";
import {
  boardSchema,
  optionSchema,
  tierSchema,
  moveSchema,
  createBoard,
  rankBoard,
  summary,
  validate,
  type Board,
} from "./src/board.js";
import { png } from "./src/render.js";

const server = new MCPServer({
  name: "tier-list-mcp",
  title: "Tier List",
  version: "0.1.0",
  description:
    "Create, rank, preview, and download tier lists entirely in chat.",
  icons: [{ src: "icon.svg", mimeType: "image/svg+xml", sizes: ["128x128"] }],
  instructions:
    "When given a category, research or propose relevant options using your own knowledge/search tools, then call create-tier-list. Do not ask the user to supply every option. Do not invent sources or silently rank anything. Show the returned image/card and options. For each user ranking, pass the most recent complete board to rank-tier-list. Always show the new image. Preserve unmentioned rankings. For undo, use the previous board snapshot. On download call download-tier-list and save/attach the returned PNG resource; do not claim a download until the file is saved. This is a standalone tier-list maker, not affiliated with TierMaker.com.",
});
const output = z.object({
  board: boardSchema,
  filename: z.string().optional(),
});
const view = {
  name: "board",
  description: "Tier list with unranked options and a PNG download",
  prefersBorder: true,
};
async function result(board: Board, download = false, includeUnranked = true) {
  const bytes = await png(board, includeUnranked);
  const filename = `${
    board.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tier-list"
  }-v${board.revision}.png`;
  const content: any[] = [
    { type: "text", text: summary(board) },
    { type: "image", mimeType: "image/png", data: bytes.toString("base64") },
  ];
  if (download)
    content.push({
      type: "resource",
      resource: {
        uri: `tier-list://download/${filename}`,
        mimeType: "image/png",
        blob: bytes.toString("base64"),
      },
    });
  return {
    content,
    structuredContent: { board, ...(download ? { filename } : {}) },
    _meta: { png: bytes.toString("base64"), filename },
  };
}
export const createTierList = server.tool(
  {
    name: "create-tier-list",
    description:
      "Create a blank tier list and show all candidate options in chat. The host agent supplies options for ANY user category. All start unranked.",
    inputSchema: z.object({
      title: z.string().min(1).max(100),
      options: z.array(optionSchema).min(1).max(80),
      tiers: z.array(tierSchema).min(1).max(12).optional(),
    }),
    outputSchema: output,
    view: { ...view, name: "create-board" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ title, options, tiers }) =>
    result(createBoard(title, options, tiers)),
);
export const rankTierList = server.tool(
  {
    name: "rank-tier-list",
    description:
      "Apply only the user-requested moves and return the updated board and PNG preview. Pass the latest board unchanged. Moves accept option IDs or exact labels. Null tier un-ranks an option.",
    inputSchema: z.object({
      board: boardSchema,
      moves: z.array(moveSchema).min(1).max(80),
    }),
    outputSchema: output,
    view: { ...view, name: "rank-board" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ board, moves }) => result(rankBoard(board, moves)),
);
export const showTierList = server.tool(
  {
    name: "show-tier-list",
    description:
      "Show a board snapshot, including a previous snapshot for undo. No state is stored on the server.",
    inputSchema: z.object({ board: boardSchema }),
    outputSchema: output,
    view: { ...view, name: "show-board" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ board }) => result(validate(board)),
);
export const downloadTierList = server.tool(
  {
    name: "download-tier-list",
    description:
      "Return the final PNG as an image and embedded downloadable resource. The host should save the resource bytes as filename and attach it in chat. Defaults to including unranked options so nothing is silently omitted.",
    inputSchema: z.object({
      board: boardSchema,
      includeUnranked: z.boolean().default(true),
    }),
    outputSchema: output,
    view: { ...view, name: "download-board" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ board, includeUnranked }) =>
    result(validate(board), true, includeUnranked),
);
export default server;
