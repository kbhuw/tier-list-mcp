import sharp from "sharp";
import { validate, type Board } from "./board.js";
const esc = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function lines(s: string, n = 17): string[] {
  const words = s
    .split(/\s+/)
    .flatMap((w) =>
      w.length > n ? w.match(new RegExp(`.{1,${n}}`, "gu"))! : w,
    );
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > n) {
      out.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out;
}
export function svg(board: Board, includeUnranked = true): string {
  validate(board);
  let y = 94;
  const rows = [
    ...board.tiers.map((t) => ({ ...t, key: t.name as string | null })),
    ...(includeUnranked && board.items.some((i) => i.tier === null)
      ? [{ name: "Unranked", color: "#cbd5e1", key: null }]
      : []),
  ];
  const content = rows
    .map((row) => {
      const items = board.items.filter((i) => i.tier === row.key);
      const h = Math.max(
        items.length ? 124 : 80,
        Math.ceil(items.length / 6) * 124,
      );
      let out = `<rect x="24" y="${y}" width="1056" height="${h}" fill="#20232b"/><rect x="24" y="${y}" width="126" height="${h}" fill="${row.color}"/>`;
      const labels = lines(row.name, 10);
      out += labels
        .map(
          (l, i) =>
            `<text x="87" y="${y + h / 2 + (i - (labels.length - 1) / 2) * 23 + 7}" text-anchor="middle" fill="#101318" font-size="22" font-weight="700">${esc(l)}</text>`,
        )
        .join("");
      out += items
        .map((item, i) => {
          const x = 160 + (i % 6) * 151,
            cy = y + 8 + Math.floor(i / 6) * 124;
          const text = lines(item.label, 15);
          return (
            `<rect x="${x}" y="${cy}" width="140" height="108" rx="8" fill="#343944"/>` +
            (item.logo
              ? `<rect x="${x + 46}" y="${cy + 8}" width="48" height="48" rx="7" fill="#ffffff"/><image x="${x + 50}" y="${cy + 12}" width="40" height="40" href="${item.logo}"/>`
              : "") +
            text
              .map(
                (l, j) =>
                  `<text x="${x + 70}" y="${cy + (item.logo ? 80 : 56) + (j - (text.length - 1) / 2) * 16}" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="600">${esc(l)}</text>`,
              )
              .join("")
          );
        })
        .join("");
      y += h + 4;
      return out;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1104" height="${y + 42}"><rect width="100%" height="100%" fill="#12151b"/><g font-family="DejaVu Sans,Arial,sans-serif"><text x="24" y="38" fill="#fff" font-size="${board.title.length > 60 ? 19 : 26}" font-weight="700">${esc(board.title)}</text><text x="24" y="67" fill="#a9b2c2" font-size="14">${board.items.filter((i) => i.tier !== null).length} / ${board.items.length} ranked</text>${content}<text x="24" y="${y + 24}" fill="#929dad" font-size="12">Tier List MCP · revision ${board.revision}</text></g></svg>`;
}
export async function png(board: Board, includeUnranked = true) {
  return sharp(Buffer.from(svg(board, includeUnranked)))
    .png()
    .toBuffer();
}
