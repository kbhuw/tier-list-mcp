import { useToolContext, useCallTool } from "mcp-use/react";
import { useState } from "react";
import type { Board } from "./board.js";
import "./board.css";
export default function TierBoard() {
  const widget = useToolContext<"create-tier-list">();
  const exporter = useCallTool("download-tier-list");
  const [error, setError] = useState("");
  if (widget.status === "error")
    return <p role="alert">{widget.error.message}</p>;
  if (widget.status === "pending")
    return (
      <div className="shell" role="status">
        Building your tier list…
      </div>
    );
  const board = widget.toolOutput.board;
  async function download() {
    try {
      setError("");
      const result = await exporter.callTool({ board, includeUnranked: true });
      const meta = result._meta as
        { png?: string; filename?: string } | undefined;
      if (!meta?.png) throw new Error("Ask in chat to download the PNG.");
      const bytes = Uint8Array.from(atob(meta.png), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.filename ?? "tier-list.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }
  return (
    <main className="shell">
      <header>
        <div>
          <h1>{board.title}</h1>
          <p>
            {board.items.filter((i) => i.tier !== null).length} of{" "}
            {board.items.length} ranked
          </p>
        </div>
        <button onClick={() => void download()}>Download PNG</button>
      </header>
      <section aria-label="Tier list">
        {board.tiers.map((t) => (
          <div className="row" key={t.name}>
            <div className="tier" style={{ background: t.color }}>
              {t.name}
            </div>
            <div className="items">
              {board.items
                .filter((i) => i.tier === t.name)
                .map((i) => (
                  <div className="item" title={i.description} key={i.id}>
                    {i.label}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>
      {board.items.some((i) => i.tier === null) && (
        <section className="unranked">
          <h2>Unranked · your options</h2>
          <div className="items">
            {board.items
              .filter((i) => i.tier === null)
              .map((i) => (
                <div className="item" key={i.id} title={i.description}>
                  {i.label}
                </div>
              ))}
          </div>
        </section>
      )}
      <footer>
        Tell me where each option belongs. For example, “{board.items[0]?.label}{" "}
        in {board.tiers[0]?.name}.”
      </footer>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
