import test from "node:test";
import assert from "node:assert/strict";
import { citationLayout, drawRoutes } from "../src/graph-layout.js";
const nodes = [
  { paper_id: 37, depth: 0 },
  { paper_id: 30, depth: 1 },
  { paper_id: 34, depth: 1 },
  { paper_id: 36, depth: 1 },
];
const edges = [30, 34, 36].map((id) => ({
  citing_paper_id: 37,
  cited_paper_id: id,
}));
test("citation diagram preserves all real nodes and directs references toward their targets", () => {
  const layout = citationLayout(nodes, edges);
  assert.equal(layout.nodes.length, 4);
  assert.equal(layout.routes.length, 3);
  for (const route of layout.routes) {
    const target = layout.nodes.find(
      (n) => n.paper_id === route.edge.cited_paper_id,
    );
    assert.equal(route.arrow[1], target.y);
    assert(route.arrow[0] < target.x);
    assert.equal(route.arrow[2], "▶");
  }
  const lines = drawRoutes(layout).split("\n");
  assert.equal(lines.length, layout.height);
  assert(lines.every((l) => l.length === layout.width));
});
test("incoming and same-level cycle edges retain their stored citation direction", () => {
  const ns = [
    { paper_id: 30, depth: 0 },
    { paper_id: 37, depth: 1 },
    { paper_id: 36, depth: 1 },
  ];
  const es = [
    { citing_paper_id: 37, cited_paper_id: 30 },
    { citing_paper_id: 36, cited_paper_id: 37 },
    { citing_paper_id: 37, cited_paper_id: 36 },
  ];
  const layout = citationLayout(ns, es);
  assert.equal(layout.routes.length, 3);
  const incoming = layout.routes.find((r) => r.edge.cited_paper_id === 30);
  assert.equal(incoming.arrow[2], "◀");
  for (const r of layout.routes) {
    const target = layout.nodes.find(
      (n) => n.paper_id === r.edge.cited_paper_id,
    );
    assert.equal(r.arrow[1], target.y);
  }
  assert.doesNotThrow(() => drawRoutes(layout));
});
test("selection draws only the selected paper’s incident connections; isolated roots remain valid", () => {
  const layout = citationLayout(nodes, edges);
  const selected = drawRoutes(layout, 30);
  assert.equal([...selected].filter((c) => c === "▶" || c === "◀").length, 1);
  assert.equal(drawRoutes(layout, 999).trim(), "");
  const empty = citationLayout([{ paper_id: 1, depth: 0 }], []);
  assert.equal(empty.nodes.length, 1);
  assert.equal(drawRoutes(empty).trim(), "");
});
