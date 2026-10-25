# Verification

Verified locally on 25 October 2026, Node 26.7.0 and SQLite.

- `npm test`: 17 passing integration tests. These cover the exact seed counts and reported rankings, full-text search and index synchronization, combined filters, ordered authorship, direct and recursive citation queries, cycles, entity CRUD, foreign keys, uniqueness, self-citation triggers, cascading deletes, affiliation years, atomic rollback, concurrent requests and disk persistence across reopen.
- `npm run build`: passes. ascii.rest emits a harmless notice that its React `use client` directive is ignored by the Vite bundler.
- Production server: started using `npm start`; `/api/health` returned online; the built React application rendered the expected counts and its bundled banner in the browser.
- Browser workflow: created a temporary paper, linked an author, method and venue, saved it, edited the title and corresponding-author flag, verified the detail view, then deleted it with the in-place confirmation. Original seed counts were restored.
- Search: `citation` returned 5 matching papers. CSV export downloaded the result set.
- Citation explorer: paper 37 at depth 1 rendered 37, 30, 34 and 36, preserving edge direction.
- Responsive checks: overview, papers, authors, citations, queries, catalog, paper editor and author details inspected at 375, 768 and 1280 pixels. No horizontal page overflow or visible API error messages. Wide query tables and graph levels scroll within their panels.
- Source validation: `git diff --check` passes.

Not verified live: MySQL and Docker Compose. The host denied access to `/var/run/docker.sock`, and no MySQL server/client was available. The MySQL adapter, original MySQL schema/seed, Compose setup and `TEST_DATABASE_URL` integration path are included. See the README for instructions.

## Focused graph update

The experimental hero/scene/ticker redesign was fully reverted at the user’s request. Only data displays changed: the publication-year chart now uses ascii.rest’s real-data bar-chart piece with axes and stationary values, and the citation network renders stored directed connections with selectable highlights. The original header, counters, panels and navigation remain.

- `npm test`: 20 tests pass, including graph direction, reverse/cyclic edges, selected-edge filtering and isolated roots.
- `npm run build`: passes.
- Browser: selected paper 37 and verified references 30, 34, 36; keyboard Enter selected the node; clicking 2019 filtered to 6 papers.
- 375 px: document width 360 px, diagram overflow contained in its own scroller, no visible API errors. Console error log empty.
- No new looping animation or synthetic telemetry was added. The chart renders one static frame from live database counts.
- T3 preview snapshots timed out; verification completed in a separate Brave tab through the browser tool.
