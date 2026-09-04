# Tier List MCP

Create a tier list entirely in chat: name a category, see the options, say what belongs in S/A/B/C/D, see each change, then download a PNG.

Built with [Manufact / mcp-use](https://manufact.com/) and MCP Apps. MIT licensed. Independent project; not affiliated with or connected to TierMaker.com. No TierMaker account needed.

## Run

Node 22.22.2 or newer:

```sh
npm ci
npm run build
npm start -- --port 3000
```

Connect your MCP client to `http://localhost:3000/mcp`. `npm run dev` also provides the MCP Inspector. Remote clients need a reachable HTTPS deployment.

## Deploy on Manufact

```sh
npx mcp-use login
npx mcp-use deploy --no-github
```

Use the endpoint returned by the deploy command in your MCP client. Alternatively import this repository in Manufact and use `npm run build` / `npm start -- --host 0.0.0.0`. Manufact deployment requires your own account. No paid plan or external API key is required by the application itself; hosting is subject to the platform's pricing.

## Conversation

> Make a tier list of agent frameworks.

The host agent researches or proposes candidates and calls `create-tier-list`. The card and PNG show every option unranked. Category discovery is performed by the **host agent**, using its own knowledge or search tools; this server does not contain an LLM or a hardcoded category catalog.

> LangGraph in S, CrewAI in A.

`rank-tier-list` returns the complete revised board and a fresh image. Unmentioned options stay where they were.

> Actually CrewAI in B. Put Mastra in A.

The next result shows the correction. To undo, the host passes the previous snapshot to `show-tier-list`.

> Download.

`download-tier-list` returns PNG image content and an embedded binary resource. A file-capable host saves the resource's base64 bytes under the returned filename and attaches it. The MCP App also has a Download PNG button; browser download behavior depends on the host's sandbox permissions. If blocked, ask in chat to download. Download does not require opening a website.

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `create-tier-list` | Title, candidate options, optional custom tiers | Unranked board, image, MCP App |
| `rank-tier-list` | Latest board, moves by ID or exact label, optional position | New immutable board snapshot and preview |
| `show-tier-list` | Board snapshot | Preview; use earlier snapshot for undo |
| `download-tier-list` | Board, includeUnranked (default true) | PNG preview, filename, embedded PNG resource |

Every tool returns `structuredContent.board`; retain this exact object for the next call. Tools are stateless: boards live in the conversation, so separate users never share mutable server state and server restarts do not lose a board. If a client discards the conversation's board, restore it from a saved JSON snapshot. There is no server-side account, saved-list browser, or cross-chat library.

Company cards include logos and names. Provide each option’s official `source` URL or `logoDomain`; creation fetches its favicon through Google’s fixed favicon service, normalizes it to a small PNG, and embeds it in the board. Pre-supplied PNG data URLs are also supported via `logo`. Embedded logos persist across moves and exports without further network requests. Missing or invalid icons fall back to the name. Optional descriptions and source URLs are preserved for the host. Arbitrary image URLs, browser credentials, and filesystem paths are not accepted. Limit: 80 options, 12 tiers. Inputs are validated; invalid moves fail the whole batch. Tool annotations are read-only because no server or external state is changed.

## Evaluation

```sh
npm run build
npm run typecheck
npm test
```

Tests run a real HTTP MCP server on port 3418 and check tool discovery, view resources, all-unranked creation, incremental moves, correction, exact PNG resource export, and rejected invalid moves. Additional categories verify category independence. Unit tests cover ordering, atomicity, duplicate identities, custom tiers, escaping, and rendering.

Set `EVAL_OUTPUT_DIR=/absolute/path` to save the protocol test's preview sequence and board JSON. The sample rankings are test fixtures, not recommendations.

These deterministic tests validate the tool flow. They do **not** establish that every model researches good candidates, that a specific chat client's App sandbox permits downloads, or that a hosted deployment is working. Use the acceptance test below in your target chat client:

1. Give an unanticipated category; verify relevant options appear in chat without supplying the list yourself.
2. Rank two items; verify the image and card agree.
3. Correct one item; verify the other ranking is preserved.
4. Undo; verify the previous snapshot is restored.
5. Say download; verify an actual PNG attachment opens and matches the visible ranking.

## Privacy and deployment

The application stores no board data. Logo lookup sends company domains to Google’s favicon service. MCP clients and hosting providers may retain tool-call logs; configure their retention separately. The unauthenticated endpoint exposes only pure rendering tools, but a public host should apply request limits and authentication appropriate to its audience. No TierMaker cookies or tokens belong in this project.
