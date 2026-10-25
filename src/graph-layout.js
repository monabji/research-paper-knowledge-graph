const JOINS = [
  " ",
  "│",
  "─",
  "└",
  "│",
  "│",
  "┌",
  "├",
  "─",
  "┘",
  "─",
  "┴",
  "┐",
  "┤",
  "┬",
  "┼",
];
const NODE_WIDTH = 9;
// Character-grid layout: real directed edges, shortest-distance columns, no simulated data.
export function citationLayout(nodes, edges) {
  const depth = Math.max(0, ...nodes.map((n) => n.depth));
  const groups = Array.from({ length: depth + 1 }, (_, d) =>
    nodes.filter((n) => n.depth === d),
  );
  const count = Math.max(1, ...groups.map((g) => g.length));
  const height = Math.max(9, count * 5 + 3),
    width = (depth + 1) * 23 + 2;
  const placed = groups.flatMap((group, d) =>
    group.map((node, i) => ({
      ...node,
      x: d * 23 + 2,
      y: 3 + Math.floor(((i + 0.5) * (height - 5)) / group.length),
    })),
  );
  const byId = new Map(placed.map((n) => [n.paper_id, n]));
  const routes = edges
    .map((edge, i) => {
      const source = byId.get(edge.citing_paper_id),
        target = byId.get(edge.cited_paper_id);
      if (!source || !target) return null;
      const right = target.x > source.x,
        same = target.x === source.x;
      const sx = right || same ? source.x + NODE_WIDTH : source.x - 1;
      const tx = right ? target.x - 2 : target.x + NODE_WIDTH + 1;
      const lane =
        right || same
          ? source.x + NODE_WIDTH + 3 + (i % 4)
          : source.x - 3 - (i % 4);
      return {
        edge,
        points: [
          [sx, source.y],
          [lane, source.y],
          [lane, target.y],
          [tx, target.y],
        ],
        arrow: [tx, target.y, right ? "▶" : "◀"],
      };
    })
    .filter(Boolean);
  return { nodes: placed, routes, groups, width, height };
}
export function drawRoutes(layout, selectedId = null) {
  const { width, height } = layout,
    bits = new Uint8Array(width * height),
    arrows = [];
  const add = (x, y, mask) => {
    if (x >= 0 && x < width && y >= 0 && y < height)
      bits[y * width + x] |= mask;
  };
  for (const route of layout.routes) {
    if (
      selectedId !== null &&
      route.edge.citing_paper_id !== selectedId &&
      route.edge.cited_paper_id !== selectedId
    )
      continue;
    for (let i = 1; i < route.points.length; i++) {
      let [x, y] = route.points[i - 1];
      const [ex, ey] = route.points[i];
      while (x !== ex || y !== ey) {
        const dx = Math.sign(ex - x),
          dy = Math.sign(ey - y);
        const nextX = x + dx,
          nextY = y + dy;
        add(x, y, dx > 0 ? 2 : dx < 0 ? 8 : dy > 0 ? 4 : 1);
        add(nextX, nextY, dx > 0 ? 8 : dx < 0 ? 2 : dy > 0 ? 1 : 4);
        x = nextX;
        y = nextY;
      }
    }
    arrows.push(route.arrow);
  }
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => JOINS[bits[y * width + x]]),
  );
  for (const [x, y, char] of arrows)
    if (grid[y] && x >= 0 && x < width) grid[y][x] = char;
  return grid.map((row) => row.join("")).join("\n");
}
