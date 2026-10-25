import React, { useMemo } from "react";
import { Ascii } from "ascii.rest/react";
import * as barChart from "ascii.rest/pieces/bar-chart";
import { citationLayout, drawRoutes } from "./graph-layout.js";
import { code, Empty } from "./components.jsx";

export function PublicationChart({ years, onYear }) {
  // The library has a 60-column plot. Page long year ranges to keep every label legible.
  const groups = [];
  for (let i = 0; i < years.length; i += 9) groups.push(years.slice(i, i + 9));
  if (!years.length) return <Empty>no publication years yet.</Empty>;
  return (
    <div className="publication-chart">
      {groups.map((group, i) => (
        <div key={i}>
          <div className="publication-plot" aria-hidden="true">
            <Ascii
              piece={barChart}
              options={{
                title: "",
                labels: group.map((y) => String(y.year)),
                datasets: [
                  { name: "papers", values: group.map((y) => y.count) },
                ],
                fps: 0,
              }}
            />
          </div>
          <div
            className="year-values"
            aria-label="paper counts by publication year"
          >
            {group.map((y) => (
              <button
                key={y.year}
                onClick={() => onYear(y.year)}
                aria-label={`${y.year}: ${y.count} papers; filter papers by this year`}
              >
                <span className="dim">{y.year}</span>
                <b>{y.count}</b>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function CitationDiagram({ nodes, edges, selected, onSelect }) {
  const layout = useMemo(() => citationLayout(nodes, edges), [nodes, edges]);
  const drawing = useMemo(() => drawRoutes(layout), [layout]);
  const highlighted = useMemo(
    () => (selected ? drawRoutes(layout, selected.paper_id) : ""),
    [layout, selected],
  );
  return (
    <>
      <div
        className="citation-diagram-scroll scroll-x"
        tabIndex={0}
        role="region"
        aria-label="citation network; scroll to explore connections"
      >
        <div
          className="citation-diagram"
          style={{
            width: layout.width + "ch",
            height: layout.height * 1.5 + "em",
          }}
        >
          <pre className="citation-wires" aria-hidden="true">
            {drawing}
          </pre>
          {selected && (
            <pre className="citation-wires highlighted" aria-hidden="true">
              {highlighted}
            </pre>
          )}
          {layout.groups.map((_, depth) => (
            <span
              key={depth}
              className="diagram-depth dim"
              style={{ left: depth * 23 + 2 + "ch" }}
            >
              {depth ? "depth " + depth : "root"}
            </span>
          ))}
          {layout.nodes.map((node) => (
            <button
              key={node.paper_id}
              className={
                "diagram-node " +
                (node.depth === 0 ? "diagram-root " : "") +
                (selected?.paper_id === node.paper_id ? "selected" : "")
              }
              style={{ left: node.x + "ch", top: node.y * 1.5 + "em" }}
              aria-label={`${code(node.paper_id)}: ${node.title}, ${node.publication_year}, depth ${node.depth}`}
              aria-pressed={selected?.paper_id === node.paper_id}
              onClick={() => onSelect(node)}
            >
              <span>[ {code(node.paper_id)} ]</span>
              <span className="diagram-year">{node.publication_year}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="diagram-legend">
        <span className="dim">▶ citation direction</span>
        <span className="dim">select a paper to highlight its connections</span>
      </div>
      <ul className="sr-only" aria-label="citation connections">
        {edges.map((e) => (
          <li key={e.citing_paper_id + "-" + e.cited_paper_id}>
            {code(e.citing_paper_id)} cites {code(e.cited_paper_id)}
          </li>
        ))}
      </ul>
    </>
  );
}
