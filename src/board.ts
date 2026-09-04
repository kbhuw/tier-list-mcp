import { z } from "zod";

export const tierSchema = z.object({
  name: z.string().trim().min(1).max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const itemSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(60),
  description: z.string().max(240).optional(),
  source: z.url().optional(),
  logoDomain: z
    .string()
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
    )
    .optional()
    .describe(
      "Official company domain for its logo; defaults to source hostname",
    ),
  logo: z
    .string()
    .max(30000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional()
    .describe("Embedded PNG logo, retained unchanged from the returned board"),
  tier: z.string().nullable(),
});
export const boardSchema = z.object({
  title: z.string().trim().min(1).max(100),
  revision: z.number().int().min(0),
  tiers: z.array(tierSchema).min(1).max(12),
  items: z.array(itemSchema).min(1).max(80),
});
export type Board = z.infer<typeof boardSchema>;
export const optionSchema = itemSchema.omit({ id: true, tier: true });
export const defaults = ["S", "A", "B", "C", "D"].map((name, i) => ({
  name,
  color: ["#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f"][i]!,
}));
export function validate(board: Board): Board {
  boardSchema.parse(board);
  for (const values of [
    board.tiers.map((t) => t.name.toLowerCase()),
    board.items.map((i) => i.id),
    board.items.map((i) => i.label.toLowerCase()),
  ]) {
    if (new Set(values).size !== values.length)
      throw new Error(
        "Tier names, option IDs, and option labels must be unique.",
      );
  }
  if (
    board.items.some(
      (i) => i.tier !== null && !board.tiers.some((t) => t.name === i.tier),
    )
  )
    throw new Error("An option references an unknown tier.");
  return board;
}
export function createBoard(
  title: string,
  options: z.infer<typeof optionSchema>[],
  tiers = defaults,
): Board {
  return validate({
    title,
    revision: 0,
    tiers,
    items: options.map((item, i) => ({
      ...item,
      id: `item-${i + 1}`,
      tier: null,
    })),
  });
}
export const moveSchema = z.object({
  item: z.string().describe("Exact option ID or label"),
  tier: z
    .string()
    .nullable()
    .describe("Exact tier name; null returns it to Unranked"),
  position: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Zero-based position within the destination tier; omitted appends",
    ),
});
export function rankBoard(
  input: Board,
  moves: z.infer<typeof moveSchema>[],
): Board {
  const board = structuredClone(validate(input));
  const seen = new Set<string>();
  for (const move of moves) {
    const matches = board.items.filter(
      (i) =>
        i.id === move.item || i.label.toLowerCase() === move.item.toLowerCase(),
    );
    if (matches.length !== 1)
      throw new Error(`Unknown or ambiguous option: ${move.item}`);
    const item = matches[0]!;
    if (seen.has(item.id))
      throw new Error(`Option assigned twice: ${item.label}`);
    seen.add(item.id);
    if (move.tier !== null && !board.tiers.some((t) => t.name === move.tier))
      throw new Error(`Unknown tier: ${move.tier}`);
    board.items = board.items.filter((i) => i.id !== item.id);
    item.tier = move.tier;
    const peers = board.items.filter((i) => i.tier === move.tier);
    if (move.position !== undefined && move.position > peers.length)
      throw new Error("Position is outside destination tier.");
    const before = peers[move.position ?? peers.length];
    const after = peers.at(-1);
    const index = before
      ? board.items.indexOf(before)
      : after
        ? board.items.indexOf(after) + 1
        : board.items.length;
    board.items.splice(index, 0, item);
  }
  board.revision++;
  return validate(board);
}
export function summary(board: Board) {
  return (
    `${board.title} · revision ${board.revision}\n` +
    [...board.tiers.map((t) => t.name), null]
      .map(
        (t) =>
          `${t ?? "Unranked"}: ${
            board.items
              .filter((i) => i.tier === t)
              .map((i) => i.label)
              .join(", ") || "—"
          }`,
      )
      .join("\n")
  );
}
