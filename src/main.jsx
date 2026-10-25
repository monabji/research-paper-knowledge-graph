import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { api, send, downloadCSV } from "./api.js";
import {
  Btn,
  Panel,
  Rule,
  Heading,
  Field,
  Select,
  Check,
  ErrorLine,
  Loading,
  Empty,
  ConfirmDelete,
  Table,
  Meter,
  fmt,
  label,
  code,
} from "./components.jsx";
import "./style.css";
import { PublicationChart, CitationDiagram } from "./data-visuals.jsx";
const tabs = [
  "overview",
  "papers",
  "authors",
  "citations",
  "queries",
  "catalog",
];
const go = (path) => {
  location.hash = path;
};
function useLoad(path, revision = 0) {
  const [state, set] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let active = true;
    set((s) => ({ ...s, loading: true, error: "" }));
    api(path)
      .then((data) => active && set({ loading: false, data, error: "" }))
      .catch(
        (e) => active && set({ loading: false, data: null, error: e.message }),
      );
    return () => {
      active = false;
    };
  }, [path, revision]);
  return state;
}
function PaperLink({ paper, compact = false }) {
  return (
    <button
      className={"paper-link " + (compact ? "compact" : "")}
      onClick={() => go("papers/" + paper.paper_id)}
    >
      <span className="accent">{code(paper.paper_id)}</span>
      <span>{paper.title}</span>
      <span className="dim">↗</span>
    </button>
  );
}
function MiniNetwork({ preview }) {
  if (!preview)
    return <Empty>no papers yet. add a paper to explore citations.</Empty>;
  const refs = preview.references.slice(0, 3),
    n = refs.length,
    width = Math.max(13, n * 9 + (n - 1) * 2),
    center = Math.floor(width / 2);
  const positions = refs.map((_, i) => (n === 1 ? center : i * 11 + 4));
  const branch = Array(width).fill(" "),
    down = Array(width).fill(" "),
    arrows = Array(width).fill(" ");
  if (n > 1) {
    for (let i = positions[0]; i <= positions[n - 1]; i++) branch[i] = "─";
    positions.forEach(
      (x, i) => (branch[x] = i === 0 ? "┌" : i === n - 1 ? "┐" : "┬"),
    );
    branch[center] = "┴";
  } else if (n) branch[center] = "│";
  positions.forEach((x) => {
    down[x] = "│";
    arrows[x] = "▼";
  });
  return (
    <div className="ascii-network">
      <pre className="network-root">
        <span aria-hidden="true">{"╭───────────╮\n│   "}</span>
        <button onClick={() => go("papers/" + preview.root)}>
          {code(preview.root)}
        </button>
        <span aria-hidden="true">
          {"   │\n╰─────" + (n ? "┬" : "─") + "─────╯"}
        </span>
      </pre>
      {n > 0 ? (
        <>
          <pre aria-hidden="true">
            {" ".repeat(center) +
              "│\n" +
              branch.join("") +
              "\n" +
              down.join("") +
              "\n" +
              arrows.join("")}
          </pre>
          <div className="network-leaves">
            {refs.map((r) => (
              <button
                key={r.paper_id}
                onClick={() => go("papers/" + r.paper_id)}
              >
                [ {code(r.paper_id)} ]
              </button>
            ))}
          </div>
          {preview.references.length > 3 && (
            <p className="dim small">
              + {preview.references.length - 3} more references
            </p>
          )}
        </>
      ) : (
        <p className="dim small">no references linked</p>
      )}
    </div>
  );
}
function Overview({ revision }) {
  const { data, loading, error } = useLoad("/stats", revision);
  if (loading) return <Loading />;
  if (error) return <ErrorLine error={error} />;
  const counts = data.counts;
  return (
    <>
      <Heading text="RESEARCH" subtitle="research paper knowledge graph">
        <span className="good">● database online</span>
        <span className="dim">{data.database} · 13 relational tables</span>
        <span className="dim">synthetic demonstration data</span>
      </Heading>
      <Rule>01 · collection overview</Rule>
      <div className="stats-grid">
        {[
          ["paper", "papers", "01"],
          ["author", "authors", "02"],
          ["citation", "citation edges", "03"],
          ["dataset", "datasets", "04"],
        ].map(([key, name, index]) => (
          <Panel
            key={key}
            title={name}
            foot={
              key === "citation"
                ? "directed · no self-citations"
                : key === "paper"
                  ? `${data.years[0]?.year || "—"}–${data.years.at(-1)?.year || "—"} · publication years`
                  : key === "author"
                    ? "ordered authorship"
                    : "reusable research resources"
            }
          >
            <div className="stat-top">
              <span className="dim">{index} /</span>
              <span className="dim">{key === "citation" ? "↗" : "■"}</span>
            </div>
            <button
              className="stat-number"
              onClick={() =>
                go(
                  key === "paper"
                    ? "papers"
                    : key === "author"
                      ? "authors"
                      : key === "citation"
                        ? "citations"
                        : "catalog/dataset",
                )
              }
            >
              {fmt(counts[key])}
              <span className="stat-unit">{name}</span>
            </button>
          </Panel>
        ))}
      </div>
      <div className="overview-grid">
        <Panel
          title="citation explorer"
          foot="references point from citing → cited paper"
          className="explorer-preview"
        >
          <div className="panel-toolbar">
            <span className="dim">
              root{" "}
              <span className="accent">
                {data.preview ? code(data.preview.root) : "none"}
              </span>{" "}
              · 1 hop
            </span>
            <Btn
              onClick={() => go("citations?root=" + (data.preview?.root || 37))}
              primary
            >
              open explorer ↗
            </Btn>
          </div>
          <MiniNetwork preview={data.preview} />
          <p className="dim small">
            follow references, inspect incoming citations, and traverse up to 10
            levels.
          </p>
        </Panel>
        <Panel
          title="most cited papers"
          foot="incoming citations · calculated from relationships"
        >
          <div className="rank-list">
            {data.topPapers.map((p, i) => (
              <div className="rank-row" key={p.paper_id}>
                <span className="dim">0{i + 1}</span>
                <div>
                  <button
                    className="rank-title"
                    onClick={() => go("papers/" + p.paper_id)}
                  >
                    {p.title}
                  </button>
                  <span className="dim small">{code(p.paper_id)}</span>
                </div>
                <b className="accent">
                  {p.citation_count}
                  <span className="dim small"> cites</span>
                </b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Rule>02 · research activity</Rule>
      <div className="overview-grid">
        <Panel
          title="papers by publication year"
          foot={`${counts.paper} papers · counts from current collection`}
        >
          <PublicationChart
            years={data.years}
            onYear={(year) => go(`papers?publication_year=${year}`)}
          />
        </Panel>
        <Panel
          title="author activity"
          foot={`${counts.authorship} authorship records · author order preserved`}
        >
          <div className="author-ranks">
            {data.topAuthors.map((a, i) => (
              <div className="author-rank" key={a.author_id}>
                <span className="dim">{String(i + 1).padStart(2, "0")}</span>
                <button onClick={() => go("authors/" + a.author_id)}>
                  {a.full_name}
                </button>
                <Meter
                  value={a.paper_count}
                  max={data.topAuthors[0].paper_count}
                  width={10}
                />
                <b>{a.paper_count}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Rule>03 · recently added records</Rule>
      <Panel
        title="latest papers"
        foot="newest record identifiers · select a paper to inspect its relationships"
      >
        {data.recent.map((p) => (
          <div className="recent-row" key={p.paper_id}>
            <PaperLink paper={p} />
            <span className="dim">{p.publication_year}</span>
            <span>
              {p.citation_count} <span className="dim">cites</span>
            </span>
          </div>
        ))}
      </Panel>
    </>
  );
}
function Papers({ catalog, query, revision }) {
  const initial = Object.fromEntries(new URLSearchParams(query));
  const [filters, setFilters] = useState(initial),
    [search, setSearch] = useState(initial.q || "");
  useEffect(() => {
    const f = Object.fromEntries(new URLSearchParams(query));
    setFilters(f);
    setSearch(f.q || "");
  }, [query]);
  const [page, setPage] = useState(1),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const params = new URLSearchParams({ ...filters, page: String(page) });
  const { data, loading, error } = useLoad("/papers?" + params, revision);
  const update = (key, value) => {
    setPage(1);
    const f = { ...filters, [key]: value };
    if (!value) delete f[key];
    setFilters(f);
    go("papers?" + new URLSearchParams(f));
  };
  async function exportRows() {
    setExporting(true);
    setExportError("");
    try {
      const rows = [];
      let current = 1,
        total;
      do {
        const r = await api(
          "/papers?" +
            new URLSearchParams({ ...filters, page: current, limit: 100 }),
        );
        rows.push(...r.items);
        total = r.total;
        current++;
      } while (rows.length < total);
      downloadCSV(
        rows.map((p) => ({
          ...p,
          authors: p.authors.map((a) => a.full_name).join("; "),
          keywords: p.keywords.map((k) => k.keyword).join("; "),
        })),
        "papers.csv",
      );
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <Heading text="PAPERS" subtitle="search & explore the collection">
        <Btn onClick={() => go("edit/paper/new")} primary>
          + new paper
        </Btn>
        <span className="dim">
          {data ? fmt(data.total) : "…"} matching records
        </span>
      </Heading>
      <Panel
        title="find papers"
        foot="full-text title & abstract · combine filters"
        className="hot"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update("q", search);
          }}
          className="search-line"
        >
          <span className="accent">&gt;</span>
          <label className="sr-only" htmlFor="paper-search">
            search papers
          </label>
          <span className="field grow">
            <input
              id="paper-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search titles and abstracts…"
            />
          </span>
          <Btn primary type="submit">
            search ↵
          </Btn>
        </form>
        <div className="filter-grid">
          {[
            [
              "publication_year",
              "year",
              Array.from(new Set(catalog.paper.map((p) => p.publication_year)))
                .sort((a, b) => b - a)
                .map((y) => ({ id: y, name: y })),
            ],
            ...["venue", "author", "dataset", "method", "keyword"].map((t) => [
              t + "_id",
              t,
              catalog[t].map((r) => ({
                id: r[t + "_id"],
                name: r.name || r.full_name || r.keyword,
              })),
            ]),
          ].map(([key, name, options]) => (
            <label className="filter" key={key}>
              <span className="dim">{name}</span>
              <Select
                label={"filter by " + name}
                value={filters[key] || ""}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">
                  all {name === "year" ? "years" : name + "s"}
                </option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
        <div className="split">
          <span className="dim small">
            {Object.keys(filters).filter((k) => k !== "sort").length} active
            filters
          </span>
          <Btn
            onClick={() => {
              setPage(1);
              go("papers");
              setFilters({});
              setSearch("");
            }}
          >
            clear filters
          </Btn>
        </div>
      </Panel>
      <Rule>01 · search results</Rule>
      <div className="list-toolbar">
        <span className="dim">
          {data
            ? `${data.total} papers · page ${page} of ${Math.max(1, Math.ceil(data.total / 10))}`
            : "loading…"}
        </span>
        <div className="actions">
          <Select
            label="sort papers"
            value={filters.sort || "newest"}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="newest">newest first</option>
            <option value="oldest">oldest first</option>
            <option value="citations">most cited</option>
            <option value="title">title a–z</option>
          </Select>
          <Btn disabled={exporting || !data?.total} onClick={exportRows}>
            {exporting ? "exporting…" : "export csv ↓"}
          </Btn>
        </div>
      </div>
      <ErrorLine error={exportError || error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="paper-cards">
          {data.items.map((p) => (
            <Panel
              key={p.paper_id}
              title={`${code(p.paper_id)} · ${p.paper_type}`}
              foot={p.venue || "no venue assigned"}
              className="paper-card pick"
            >
              <div className="paper-card-main">
                <div className="paper-title-line">
                  <button
                    className="paper-title"
                    onClick={() => go("papers/" + p.paper_id)}
                  >
                    {p.title}
                  </button>
                  <span className="paper-year">{p.publication_year}</span>
                </div>
                <div className="paper-authors">
                  {p.authors.map((a, i) => (
                    <React.Fragment key={a.author_id}>
                      {i > 0 && <span className="faint"> · </span>}
                      <button onClick={() => go("authors/" + a.author_id)}>
                        {a.full_name}
                        {a.is_corresponding ? " *" : ""}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div className="paper-bottom">
                  <div className="tags">
                    {p.keywords.map((k) => (
                      <button
                        key={k.keyword_id}
                        onClick={() => update("keyword_id", k.keyword_id)}
                      >
                        <span className="faint">#</span>
                        {k.keyword}
                      </button>
                    ))}
                  </div>
                  <span className="dim">
                    <b className="accent">{p.citation_count}</b> citations{" "}
                    <button
                      className="text-link"
                      aria-label={"open " + p.title}
                      onClick={() => go("papers/" + p.paper_id)}
                    >
                      ↗
                    </button>
                  </span>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>
          no papers match these filters. clear filters or add a new paper.
        </Empty>
      )}
      {data && (
        <div className="pagination">
          <Btn
            disabled={page === 1}
            onClick={() => {
              setPage((p) => p - 1);
              scrollTo(0, 0);
            }}
          >
            ← previous
          </Btn>
          <span className="dim">
            {page} / {Math.max(1, Math.ceil(data.total / 10))}
          </span>
          <Btn
            disabled={page * 10 >= data.total}
            onClick={() => {
              setPage((p) => p + 1);
              scrollTo(0, 0);
            }}
          >
            next →
          </Btn>
        </div>
      )}
    </>
  );
}
function PaperDetail({ id, revision, onChange }) {
  const { data: p, loading, error } = useLoad("/papers/" + id, revision),
    [mutationError, setError] = useState("");
  if (loading) return <Loading />;
  if (error) return <ErrorLine error={error} />;
  return (
    <>
      <div className="breadcrumb">
        <button onClick={() => go("papers")}>papers</button>
        <span className="dim"> / </span>
        {code(id)}
      </div>
      <Heading text="PAPER" subtitle={code(id) + " · record details"}>
        <Btn primary onClick={() => go("edit/paper/" + id)}>
          edit paper
        </Btn>
        <Btn onClick={() => go("citations?root=" + id)}>
          explore citations ↗
        </Btn>
      </Heading>
      <Panel title="paper metadata" foot="* corresponding author">
        <h1 className="record-title">{p.title}</h1>
        <div className="metadata">
          <span className="accent">{p.publication_year}</span>
          <span>{p.paper_type}</span>
          <span className="dim">{p.venue || "no venue"}</span>
        </div>
        <div className="detail-authors">
          {p.authors.map((a) => (
            <button
              key={a.author_id}
              onClick={() => go("authors/" + a.author_id)}
            >
              {a.author_order}. {a.full_name}
              {a.is_corresponding ? " *" : ""}
            </button>
          ))}
        </div>
        <Rule>abstract</Rule>
        <p className="abstract">{p.abstract}</p>
        <div className="facts">
          <span className="dim">doi</span>
          <span>{p.doi || "not supplied"}</span>
          <span className="dim">source</span>
          <span>
            {p.url ? (
              <a
                className="accent"
                href={p.url}
                target="_blank"
                rel="noreferrer"
              >
                open source ↗
              </a>
            ) : (
              "not supplied"
            )}
          </span>
        </div>
      </Panel>
      <div className="grid g-3 detail-resources">
        {[
          ["datasets", p.datasets],
          ["methods", p.methods],
          ["keywords", p.keywords],
        ].map(([name, items]) => (
          <Panel
            key={name}
            title={name}
            foot={`${items.length} linked records`}
          >
            {items.length ? (
              items.map((item) => (
                <p key={item.name || item.keyword}>
                  <span className="accent">
                    {name === "keywords" ? "#" : "→"}
                  </span>{" "}
                  {item.name || item.keyword}
                </p>
              ))
            ) : (
              <Empty>no {name} linked. edit paper to add links.</Empty>
            )}
          </Panel>
        ))}
      </div>
      <div className="grid g-2">
        <Panel
          title={`references · ${p.references.length}`}
          foot="this paper cites →"
        >
          {p.references.length ? (
            p.references.map((r) => <PaperLink key={r.paper_id} paper={r} />)
          ) : (
            <Empty>this paper has no references.</Empty>
          )}
        </Panel>
        <Panel
          title={`cited by · ${p.citedBy.length}`}
          foot="← these papers cite this paper"
        >
          {p.citedBy.length ? (
            p.citedBy.map((r) => <PaperLink key={r.paper_id} paper={r} />)
          ) : (
            <Empty>no incoming citations.</Empty>
          )}
        </Panel>
      </div>
      <Panel
        title="record actions"
        foot="deleting a paper also removes its relationship rows"
      >
        <ConfirmDelete
          onDelete={async () => {
            try {
              await send("/records/paper/" + id, "DELETE");
              onChange();
              go("papers");
            } catch (e) {
              setError(e.message);
            }
          }}
        />
        <ErrorLine error={mutationError} />
      </Panel>
    </>
  );
}
function Authors({ revision }) {
  const { data, loading, error } = useLoad("/records/author", revision),
    [search, setSearch] = useState("");
  const rows =
    data?.filter((a) =>
      (
        a.full_name +
        " " +
        (a.orcid || "") +
        " " +
        a.affiliations.map((i) => i.name).join(" ")
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <Heading
        text="AUTHORS"
        subtitle="researchers & institutional affiliations"
      >
        <Btn primary onClick={() => go("edit/author/new")}>
          + new author
        </Btn>
      </Heading>
      <Panel title="find authors" foot="search by name, ORCID or institution">
        <div className="search-line">
          <span className="accent">&gt;</span>
          <span className="field grow">
            <input
              aria-label="search authors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search researchers…"
            />
          </span>
          <span className="dim">{rows.length} authors</span>
        </div>
      </Panel>
      <Rule>01 · researcher directory</Rule>
      <ErrorLine error={error} />
      {loading ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>no authors match this search.</Empty>
      ) : (
        <div className="grid g-3 author-cards">
          {rows.map((a) => (
            <Panel
              title={"A-" + String(a.author_id).padStart(3, "0")}
              foot={a.orcid || "ORCID not supplied"}
              className="pick"
              key={a.author_id}
            >
              <div className="author-code" aria-hidden="true">
                {"[ " + String(a.author_id).padStart(2, "0") + " ]"}
              </div>
              <button
                className="author-name"
                onClick={() => go("authors/" + a.author_id)}
              >
                {a.full_name}
              </button>
              <p className="dim institution-name">
                {a.affiliations.map((i) => i.name).join(" · ") ||
                  "no affiliation"}
              </p>
              <div className="split">
                <span>
                  <b className="accent">{a.paper_count}</b>{" "}
                  <span className="dim">papers</span>
                </span>
                <Btn onClick={() => go("authors/" + a.author_id)}>view ↗</Btn>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
function AuthorDetail({ id, catalog, revision, onChange }) {
  const {
    data: authors,
    loading,
    error,
  } = useLoad("/records/author", revision);
  const { data: papers } = useLoad(
    "/papers?author_id=" + id + "&limit=100",
    revision,
  );
  const [institution, setInstitution] = useState(""),
    [start, setStart] = useState(new Date().getFullYear()),
    [end, setEnd] = useState(""),
    [err, setErr] = useState("");
  if (loading) return <Loading />;
  if (error) return <ErrorLine error={error} />;
  const a = authors.find((a) => a.author_id === Number(id));
  if (!a) return <ErrorLine error="author not found" />;
  return (
    <>
      <div className="breadcrumb">
        <button onClick={() => go("authors")}>authors</button>
        <span className="dim"> / </span>
        {a.full_name}
      </div>
      <Heading text="AUTHOR" subtitle={"A-" + String(id).padStart(3, "0")}>
        <Btn primary onClick={() => go("edit/author/" + id)}>
          edit author
        </Btn>
      </Heading>
      <Panel title="author profile">
        <h1 className="record-title">{a.full_name}</h1>
        <div className="facts">
          <span className="dim">orcid</span>
          <span>{a.orcid || "not supplied"}</span>
          <span className="dim">email</span>
          <span>{a.email || "not supplied"}</span>
          <span className="dim">papers</span>
          <b className="accent">{a.paper_count}</b>
        </div>
      </Panel>
      <Rule>01 · affiliations</Rule>
      <Panel
        title="affiliation history"
        foot="dates belong to the author–institution relationship"
      >
        {a.affiliations.length ? (
          a.affiliations.map((i) => (
            <div
              className="affiliation-row"
              key={i.institution_id + "-" + i.start_year}
            >
              <div>
                <b>{i.name}</b>
                <p className="dim">
                  {i.country} · {i.start_year}–{i.end_year || "present"}
                </p>
              </div>
              <ConfirmDelete
                onDelete={async () => {
                  try {
                    await send("/relations/author_institution", "DELETE", {
                      author_id: Number(id),
                      institution_id: i.institution_id,
                      start_year: i.start_year,
                    });
                    onChange();
                  } catch (e) {
                    setErr(e.message);
                  }
                }}
              />
            </div>
          ))
        ) : (
          <Empty>no affiliations yet. add one below.</Empty>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            try {
              await send("/relations/author_institution", "POST", {
                author_id: Number(id),
                institution_id: Number(institution),
                start_year: Number(start),
                end_year: end ? Number(end) : null,
              });
              onChange();
              setInstitution("");
            } catch (e) {
              setErr(e.message);
            }
          }}
        >
          <Field title="institution" id="aff-inst">
            <select
              id="aff-inst"
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            >
              <option value="">select institution</option>
              {catalog.institution.map((i) => (
                <option key={i.institution_id} value={i.institution_id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field title="start year" id="aff-start">
            <input
              id="aff-start"
              type="number"
              min="1000"
              max="2100"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field title="end year" id="aff-end">
            <input
              id="aff-end"
              type="number"
              min={start}
              max="2100"
              value={end}
              placeholder="present"
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <div className="actions">
            <Btn primary type="submit">
              + add affiliation
            </Btn>
          </div>
        </form>
        <ErrorLine error={err} />
      </Panel>
      <Rule>02 · publications</Rule>
      <Panel title="authored papers" foot={`${a.paper_count} papers`}>
        {papers?.items.map((p) => (
          <PaperLink key={p.paper_id} paper={p} />
        ))}
      </Panel>
      <Panel
        title="record actions"
        foot="deleting an author removes authorship and affiliation rows"
      >
        <ConfirmDelete
          onDelete={async () => {
            try {
              await send("/records/author/" + id, "DELETE");
              onChange();
              go("authors");
            } catch (e) {
              setErr(e.message);
            }
          }}
        />
      </Panel>
    </>
  );
}
function Citations({ query, revision, catalog }) {
  const params = new URLSearchParams(query);
  const [root, setRoot] = useState(params.get("root") || "37"),
    [depth, setDepth] = useState(params.get("depth") || "3"),
    [direction, setDirection] = useState(params.get("direction") || "outgoing"),
    [request, setRequest] = useState(query || "root=37&depth=3"),
    [view, setView] = useState("network"),
    [selected, setSelected] = useState(null);
  const { data, loading, error } = useLoad("/graph?" + request, revision);
  useEffect(() => {
    if (query) {
      const p = new URLSearchParams(query);
      setRoot(p.get("root") || "37");
      setDepth(p.get("depth") || "3");
      setDirection(p.get("direction") || "outgoing");
      setRequest(query);
      setSelected(null);
    }
  }, [query]);
  return (
    <>
      <Heading
        text="CITATIONS"
        subtitle="directed relationships & recursive traversal"
      >
        <span className="dim">citing paper → cited paper</span>
      </Heading>
      <Panel
        title="traversal settings"
        foot="bounded recursive CTE · maximum 10 hops"
        className="hot"
      >
        <form
          className="graph-form"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new URLSearchParams({
              root,
              depth,
              direction,
            }).toString();
            setRequest(q);
            setSelected(null);
            go("citations?" + q);
          }}
        >
          <label>
            <span className="dim">starting paper</span>
            <Select
              label="starting paper"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
            >
              {catalog.paper.map((p) => (
                <option key={p.paper_id} value={p.paper_id}>
                  {code(p.paper_id)} · {p.title}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="dim">direction</span>
            <Select
              label="citation direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="outgoing">references →</option>
              <option value="incoming">← cited by</option>
            </Select>
          </label>
          <label>
            <span className="dim">depth</span>
            <Select
              label="traversal depth"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} {i ? "hops" : "hop"}
                </option>
              ))}
            </Select>
          </label>
          <Btn primary type="submit">
            traverse ↵
          </Btn>
        </form>
      </Panel>
      <Rule>01 · citation network</Rule>
      <ErrorLine error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="list-toolbar">
              <span>
                <b className="accent">{data.nodes.length}</b>{" "}
                <span className="dim">nodes ·</span> {data.edges.length}{" "}
                <span className="dim">edges · root</span> {code(data.root)}
              </span>
              <div className="actions">
                <Btn
                  primary={view === "network"}
                  onClick={() => setView("network")}
                >
                  network
                </Btn>
                <Btn
                  primary={view === "table"}
                  onClick={() => setView("table")}
                >
                  table
                </Btn>
                <Btn
                  onClick={() =>
                    downloadCSV(data.nodes, "citation-traversal.csv")
                  }
                >
                  csv ↓
                </Btn>
              </div>
            </div>
            <Panel
              title={
                view === "network" ? "citation levels" : "traversal results"
              }
              foot="shortest-distance columns · arrows show stored citation direction"
              className="graph-panel"
            >
              {view === "network" ? (
                <CitationDiagram
                  nodes={data.nodes}
                  edges={data.edges}
                  selected={selected}
                  onSelect={setSelected}
                />
              ) : (
                <Table
                  rows={data.nodes.map(
                    ({ paper_id, title, publication_year, depth }) => ({
                      paper_id,
                      title,
                      publication_year,
                      depth,
                    }),
                  )}
                  onPaper={(id) => go("papers/" + id)}
                />
              )}
            </Panel>
            {data.nodes.length === 1 && (
              <Empty>
                no{" "}
                {data.direction === "incoming"
                  ? "incoming citations"
                  : "references"}{" "}
                for this paper.
              </Empty>
            )}
            <Panel
              title={
                selected
                  ? code(selected.paper_id) + " · selected node"
                  : "inspect a node"
              }
              foot="each edge is stored once · citation counts are derived"
            >
              {selected ? (
                <>
                  <p>{selected.title}</p>
                  <div className="split">
                    <span className="dim">
                      {selected.publication_year} · depth {selected.depth}
                    </span>
                    <Btn
                      primary
                      onClick={() => go("papers/" + selected.paper_id)}
                    >
                      view paper ↗
                    </Btn>
                  </div>
                  <p className="dim small">
                    {data.edges
                      .filter((e) => e.citing_paper_id === selected.paper_id)
                      .map(
                        (e) =>
                          code(e.citing_paper_id) +
                          " → " +
                          code(e.cited_paper_id),
                      )
                      .join(" · ") || "no outgoing edges within this traversal"}
                  </p>
                </>
              ) : (
                <p className="dim">
                  select a paper in the network to see its details.
                </p>
              )}
            </Panel>
            <details className="sql-details">
              <summary>view recursive SQL</summary>
              <pre>{data.sql}</pre>
            </details>
          </>
        )
      )}
    </>
  );
}
function Queries({ revision }) {
  const { data: reports } = useLoad("/reports"),
    [choice, setChoice] = useState("citations"),
    [run, setRun] = useState("citations"),
    [counter, setCounter] = useState(0);
  const { data, loading, error } = useLoad(
    "/reports/" + run,
    revision + counter,
  );
  return (
    <>
      <Heading text="QUERIES" subtitle="rankings, relationships & query plans">
        <span className="dim">live SQL · current database</span>
      </Heading>
      <Panel
        title="query library"
        foot="predefined read-only queries · results reflect current records"
        className="hot"
      >
        <div className="search-line">
          <span className="accent">&gt;</span>
          <Select
            label="demonstration query"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {reports?.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </Select>
          <Btn
            primary
            onClick={() => {
              setRun(choice);
              setCounter((n) => n + 1);
            }}
          >
            run query ↵
          </Btn>
        </div>
      </Panel>
      <Rule>01 · SQL</Rule>
      <Panel title="query source" foot="joins · grouped counts · indexes">
        <pre className="sql">
          {data?.sql.replace(
            / (FROM|LEFT JOIN|JOIN|WHERE|GROUP BY|ORDER BY|LIMIT) /g,
            "\n$1 ",
          ) || "loading SQL…"}
        </pre>
      </Panel>
      <Rule>02 · result set</Rule>
      <div className="list-toolbar">
        <span className="dim">
          {data ? `${data.rows.length} rows · ${data.duration} ms` : "loading…"}
        </span>
        <Btn
          disabled={!data?.rows.length || loading}
          onClick={() => downloadCSV(data.rows, run + ".csv")}
        >
          export csv ↓
        </Btn>
      </div>
      <ErrorLine error={error} />
      <Panel
        title={data?.title || "query results"}
        foot="results are calculated, never stored as counters"
      >
        {loading ? (
          <Loading />
        ) : (
          data && (
            <Table rows={data.rows} onPaper={(id) => go("papers/" + id)} />
          )
        )}
      </Panel>
      <Panel
        title="demonstration notes"
        foot="synthetic data · no claims about actual research impact"
      >
        <div className="facts">
          <span className="dim">citation ranks</span>
          <span>
            papers 1–5 each have 3 incoming citations in the original seed.
          </span>
          <span className="dim">dataset reuse</span>
          <span>
            each of 5 datasets is linked to 15 papers in the original seed.
          </span>
          <span className="dim">traversal</span>
          <span>paper 37 directly cites papers 30, 34 and 36.</span>
        </div>
        <p className="dim small">
          these checks describe the initial data. editing records changes the
          results.
        </p>
      </Panel>
    </>
  );
}
function Catalog({ type = "dataset", meta, catalog, revision, onChange }) {
  const chosen = Object.hasOwn(meta.entities, type) ? type : "dataset";
  const {
      data: rows,
      loading,
      error,
    } = useLoad("/records/" + chosen, revision),
    [search, setSearch] = useState(""),
    [relation, setRelation] = useState("citation");
  const filtered =
    rows?.filter((r) =>
      Object.values(r).some(
        (v) =>
          typeof v === "string" &&
          v.toLowerCase().includes(search.toLowerCase()),
      ),
    ) || [];
  return (
    <>
      <Heading
        text="CATALOG"
        subtitle="entity records & relationship management"
      >
        <Btn primary onClick={() => go("edit/" + chosen + "/new")}>
          + new {chosen}
        </Btn>
      </Heading>
      <Panel
        title="entity catalog"
        foot="seven core entities · normalized relational storage"
      >
        <div className="entity-tabs">
          {Object.entries(meta.entities).map(([t, c]) => (
            <Btn
              key={t}
              primary={chosen === t}
              onClick={() => {
                setSearch("");
                go("catalog/" + t);
              }}
            >
              {c.label} <span className="dim">{catalog[t].length}</span>
            </Btn>
          ))}
        </div>
        <div className="search-line">
          <span className="accent">&gt;</span>
          <span className="field grow">
            <input
              aria-label="search catalog"
              placeholder={"search " + meta.entities[chosen].label + "…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
      </Panel>
      <Rule>01 · {meta.entities[chosen].label}</Rule>
      <ErrorLine error={error} />
      {loading ? (
        <Loading />
      ) : (
        <Panel
          title={meta.entities[chosen].label}
          foot={`${filtered.length} records · select edit to update details`}
        >
          <div className="catalog-list">
            {filtered.length ? (
              filtered.map((r) => (
                <div className="catalog-row" key={r[meta.entities[chosen].id]}>
                  <span className="dim">
                    {String(r[meta.entities[chosen].id]).padStart(2, "0")}
                  </span>
                  <div>
                    <b>{r.name || r.full_name || r.title || r.keyword}</b>
                    <p className="dim">
                      {r.description ||
                        r.country ||
                        r.publisher ||
                        r.orcid ||
                        r.paper_type ||
                        "catalog entry"}
                    </p>
                  </div>
                  <Btn
                    onClick={() =>
                      go("edit/" + chosen + "/" + r[meta.entities[chosen].id])
                    }
                  >
                    edit
                  </Btn>
                </div>
              ))
            ) : (
              <Empty>no records match. add a new {chosen}.</Empty>
            )}
          </div>
        </Panel>
      )}
      <Rule>02 · relationship tables</Rule>
      <Panel
        title="select relationship"
        foot="composite primary keys prevent duplicate links"
      >
        <Select
          label="relationship table"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        >
          {Object.keys(meta.relations).map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </Select>
      </Panel>
      <RelationManager
        key={relation}
        type={relation}
        meta={meta}
        catalog={catalog}
        revision={revision}
        onChange={onChange}
      />
    </>
  );
}
function RelationManager({ type, meta, catalog, revision, onChange }) {
  const fields = meta.relations[type];
  const { data, loading, error } = useLoad("/relations/" + type, revision);
  const initial = Object.fromEntries(
    fields.map((f) => [f, f === "is_corresponding" ? false : ""]),
  );
  const [values, setValues] = useState(initial),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const refFor = (f) =>
    f === "citing_paper_id" || f === "cited_paper_id"
      ? "paper"
      : f.endsWith("_id")
        ? f.slice(0, -3)
        : null;
  return (
    <>
      <Panel
        title={"add " + label(type)}
        foot="foreign keys and domain checks are enforced"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            setBusy(true);
            try {
              await send(
                "/relations/" + type,
                "POST",
                Object.fromEntries(
                  Object.entries(values).map(([k, v]) => [
                    k,
                    k === "is_corresponding" ? v : v === "" ? null : Number(v),
                  ]),
                ),
              );
              setValues(initial);
              onChange();
            } catch (e) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {fields.map((f) => {
            const ref = refFor(f);
            return (
              <Field key={f} title={label(f)} id={"rel-" + f}>
                {f === "is_corresponding" ? (
                  <Check
                    checked={values[f]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f]: e.target.checked }))
                    }
                  >
                    corresponding author
                  </Check>
                ) : ref ? (
                  <select
                    id={"rel-" + f}
                    value={values[f]}
                    required
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f]: e.target.value }))
                    }
                  >
                    <option value="">select {ref}</option>
                    {catalog[ref].map((r) => (
                      <option key={r[ref + "_id"]} value={r[ref + "_id"]}>
                        {r[ref + "_id"]} ·{" "}
                        {r.name || r.full_name || r.title || r.keyword}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={"rel-" + f}
                    type="number"
                    min={f.endsWith("year") ? 1000 : 1}
                    max={f.endsWith("year") ? 2100 : undefined}
                    required={f !== "end_year"}
                    value={values[f]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f]: e.target.value }))
                    }
                  />
                )}
              </Field>
            );
          })}
          <ErrorLine error={err} />
          <div className="actions">
            <Btn primary type="submit" disabled={busy}>
              {busy ? "saving…" : "+ add relationship"}
            </Btn>
          </div>
        </form>
      </Panel>
      <Panel
        title={label(type) + " records"}
        foot={`${data?.length || 0} relationships`}
      >
        <ErrorLine error={error} />
        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    {fields.map((f) => (
                      <th key={f}>{label(f)}</th>
                    ))}
                    <th>action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.slice((page - 1) * 15, page * 15).map((r, i) => (
                    <tr key={i}>
                      {fields.map((f) => (
                        <td key={f}>{r[f] ?? "present"}</td>
                      ))}
                      <td>
                        <ConfirmDelete
                          onDelete={async () => {
                            try {
                              await send("/relations/" + type, "DELETE", r);
                              onChange();
                            } catch (e) {
                              setErr(e.message);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data?.length && (
              <Empty>no relationships yet. add one above.</Empty>
            )}
            <div className="pagination">
              <Btn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                ← previous
              </Btn>
              <span className="dim">page {page}</span>
              <Btn
                disabled={page * 15 >= data?.length}
                onClick={() => setPage((p) => p + 1)}
              >
                next →
              </Btn>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
function RecordEditor({ type, id, meta, catalog, onChange }) {
  const config = Object.hasOwn(meta.entities, type)
      ? meta.entities[type]
      : null,
    isNew = id === "new";
  const [values, setValues] = useState(null),
    [links, setLinks] = useState({
      authors: [],
      datasets: [],
      methods: [],
      keywords: [],
      references: [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [linkSearch, setLinkSearch] = useState("");
  useEffect(() => {
    let active = true;
    setValues(null);
    setError("");
    if (!config) return;
    const init = async () => {
      try {
        let row = isNew
          ? Object.fromEntries(
              Object.keys(config.fields).map((k) => [
                k,
                k === "publication_year"
                  ? 2026
                  : k === "paper_type"
                    ? "conference"
                    : "",
              ]),
            )
          : await api(
              type === "paper"
                ? "/papers/" + id
                : "/records/" + type + "/" + id,
            );
        if (active) {
          setValues(row);
          if (type === "paper" && !isNew)
            setLinks({
              authors: row.authors.map((a) => ({
                id: a.author_id,
                corresponding: !!a.is_corresponding,
              })),
              datasets: row.datasets.map((r) => r.dataset_id),
              methods: row.methods.map((r) => r.method_id),
              keywords: row.keywords.map((r) => r.keyword_id),
              references: row.references.map((r) => r.paper_id),
            });
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    init();
    return () => (active = false);
  }, [type, id]);
  if (!config) return <ErrorLine error="record type not found" />;
  const back = () =>
    go(
      type === "paper"
        ? isNew
          ? "papers"
          : "papers/" + id
        : type === "author"
          ? isNew
            ? "authors"
            : "authors/" + id
          : "catalog/" + type,
    );
  if (!values) return error ? <ErrorLine error={error} /> : <Loading />;
  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const row = await send(
        "/records/" + type + (isNew ? "" : "/" + id),
        isNew ? "POST" : "PUT",
        { ...values, ...(type === "paper" ? { relationships: links } : {}) },
      );
      onChange();
      go(
        type === "paper"
          ? "papers/" + row.paper_id
          : type === "author"
            ? "authors/" + row.author_id
            : "catalog/" + type,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function toggleLink(key, target, checked) {
    setLinks((l) => ({
      ...l,
      [key]: checked
        ? [
            ...l[key],
            key === "authors" ? { id: target, corresponding: false } : target,
          ]
        : l[key].filter((v) => (key === "authors" ? v.id : v) !== target),
    }));
  }
  return (
    <>
      <div className="breadcrumb">
        <button onClick={back}>← back</button>
      </div>
      <Heading
        text={isNew ? "NEW RECORD" : "EDIT RECORD"}
        subtitle={`${isNew ? "create" : "update"} ${type}`}
      >
        <span className="dim">
          {isNew ? "generated identifier" : type.toUpperCase() + "-" + id}
        </span>
      </Heading>
      <form onSubmit={save}>
        <Panel
          title={type + " details"}
          foot="required fields marked * · enter to save"
          className="hot"
        >
          {Object.entries(config.fields).map(([key, c]) => (
            <Field
              key={key}
              title={label(key) + (c.required ? " *" : "")}
              id={"edit-" + key}
            >
              {c.ref ? (
                <select
                  id={"edit-" + key}
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                >
                  <option value="">no {c.ref}</option>
                  {catalog[c.ref].map((r) => (
                    <option key={r[c.ref + "_id"]} value={r[c.ref + "_id"]}>
                      {r.name || r.full_name}
                    </option>
                  ))}
                </select>
              ) : c.type === "text" ? (
                <textarea
                  id={"edit-" + key}
                  rows={key === "abstract" ? 6 : 3}
                  required={c.required}
                  value={values[key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              ) : (
                <input
                  id={"edit-" + key}
                  type={
                    c.type === "year"
                      ? "number"
                      : c.type === "email"
                        ? "email"
                        : c.type === "url"
                          ? "url"
                          : "text"
                  }
                  min={c.type === "year" ? 1000 : undefined}
                  max={c.type === "year" ? 2100 : undefined}
                  maxLength={c.max}
                  required={c.required}
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
        </Panel>
        {type === "paper" && (
          <>
            <Rule>01 · paper relationships</Rule>
            <Panel
              title="link records"
              foot="select existing entities · create new entities in catalog"
            >
              <div className="search-line">
                <span className="field grow">
                  <input
                    aria-label="filter relationship choices"
                    placeholder="filter relationship choices…"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                  />
                </span>
              </div>
              <div className="grid g-2 link-groups">
                {[
                  ["authors", "author"],
                  ["datasets", "dataset"],
                  ["methods", "method"],
                  ["keywords", "keyword"],
                  ["references", "paper"],
                ].map(([key, t]) => (
                  <div key={key}>
                    <div className="link-group-title">
                      {key}{" "}
                      <span className="dim">{links[key].length} selected</span>
                    </div>
                    <div className="link-choices">
                      {catalog[t]
                        .filter(
                          (r) =>
                            (t !== "paper" || r.paper_id !== Number(id)) &&
                            (r.name || r.full_name || r.title || r.keyword)
                              .toLowerCase()
                              .includes(linkSearch.toLowerCase()),
                        )
                        .map((r) => {
                          const target = r[t + "_id"];
                          return (
                            <Check
                              key={target}
                              checked={links[key].some(
                                (v) =>
                                  (key === "authors" ? v.id : v) === target,
                              )}
                              onChange={(e) =>
                                toggleLink(key, target, e.target.checked)
                              }
                            >
                              {t === "paper" ? code(target) + " · " : ""}
                              {r.name || r.full_name || r.title || r.keyword}
                            </Check>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            {!!links.authors.length && (
              <Panel
                title="author order & correspondence"
                foot="order is saved with each authorship relationship"
              >
                {links.authors.map((a, i) => (
                  <div className="ordered-author" key={a.id}>
                    <span className="accent">{i + 1}.</span>
                    <span>
                      {
                        catalog.author.find((r) => r.author_id === a.id)
                          ?.full_name
                      }
                    </span>
                    <Check
                      checked={a.corresponding}
                      onChange={(e) =>
                        setLinks((l) => ({
                          ...l,
                          authors: l.authors.map((v) =>
                            v.id === a.id
                              ? { ...v, corresponding: e.target.checked }
                              : v,
                          ),
                        }))
                      }
                    >
                      corresponding
                    </Check>
                    <Btn
                      type="button"
                      disabled={!i}
                      onClick={() =>
                        setLinks((l) => {
                          const authors = [...l.authors];
                          [authors[i - 1], authors[i]] = [
                            authors[i],
                            authors[i - 1],
                          ];
                          return { ...l, authors };
                        })
                      }
                    >
                      ↑
                    </Btn>
                    <Btn
                      type="button"
                      disabled={i === links.authors.length - 1}
                      onClick={() =>
                        setLinks((l) => {
                          const authors = [...l.authors];
                          [authors[i + 1], authors[i]] = [
                            authors[i],
                            authors[i + 1],
                          ];
                          return { ...l, authors };
                        })
                      }
                    >
                      ↓
                    </Btn>
                  </div>
                ))}
              </Panel>
            )}
          </>
        )}
        <Panel
          title="save record"
          foot={
            type === "paper"
              ? "metadata and relationships are saved in one transaction"
              : "changes persist in the database"
          }
        >
          <ErrorLine error={error} />
          <div className="actions">
            <Btn type="button" onClick={back}>
              cancel
            </Btn>
            <Btn primary type="submit" disabled={busy}>
              {busy ? "saving…" : isNew ? "create " + type : "save changes"}
            </Btn>
          </div>
        </Panel>
      </form>
      {!isNew && type !== "paper" && type !== "author" && (
        <Panel
          title="record actions"
          foot={
            type === "venue"
              ? "deleting a venue leaves its papers intact"
              : "deleting this record also removes its relationship rows"
          }
        >
          <ConfirmDelete
            onDelete={async () => {
              try {
                await send("/records/" + type + "/" + id, "DELETE");
                onChange();
                go("catalog/" + type);
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </Panel>
      )}
    </>
  );
}
function App() {
  const [hash, setHash] = useState(location.hash.slice(1) || "overview"),
    [revision, setRevision] = useState(0);
  const { data: meta, error: metaError } = useLoad("/meta");
  const { data: catalog, error: catalogError } = useLoad("/catalog", revision);
  const onChange = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    const handler = () => {
      setHash(location.hash.slice(1) || "overview");
      scrollTo(0, 0);
    };
    addEventListener("hashchange", handler);
    const keyboard = (e) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)
      )
        return;
      const tab = tabs[Number(e.key) - 1];
      if (tab) go(tab);
      if (e.key === "/") {
        e.preventDefault();
        go("papers");
        requestAnimationFrame(() =>
          document.getElementById("paper-search")?.focus(),
        );
      }
    };
    addEventListener("keydown", keyboard);
    return () => {
      removeEventListener("hashchange", handler);
      removeEventListener("keydown", keyboard);
    };
  }, []);
  const [route, query = ""] = hash.split("?"),
    [page, id, editId] = route.split("/");
  const active =
    page === "edit"
      ? id === "paper"
        ? "papers"
        : id === "author"
          ? "authors"
          : "catalog"
      : page;
  let content;
  if (metaError || catalogError)
    content = (
      <Panel title="connection failed">
        <ErrorLine error={metaError || catalogError} />
        <Btn onClick={() => location.reload()}>retry</Btn>
      </Panel>
    );
  else if (!meta || !catalog) content = <Loading />;
  else if (page === "overview") content = <Overview revision={revision} />;
  else if (page === "papers")
    content = id ? (
      <PaperDetail id={id} revision={revision} onChange={onChange} />
    ) : (
      <Papers catalog={catalog} query={query} revision={revision} />
    );
  else if (page === "authors")
    content = id ? (
      <AuthorDetail
        id={id}
        catalog={catalog}
        revision={revision}
        onChange={onChange}
      />
    ) : (
      <Authors revision={revision} />
    );
  else if (page === "citations")
    content = <Citations query={query} catalog={catalog} revision={revision} />;
  else if (page === "queries") content = <Queries revision={revision} />;
  else if (page === "catalog")
    content = (
      <Catalog
        type={id}
        meta={meta}
        catalog={catalog}
        revision={revision}
        onChange={onChange}
      />
    );
  else if (page === "edit")
    content = (
      <RecordEditor
        key={route}
        type={id}
        id={editId}
        meta={meta}
        catalog={catalog}
        onChange={onChange}
      />
    );
  else
    content = (
      <Panel title="404 · section not found">
        <p>this section does not exist.</p>
        <Btn onClick={() => go("overview")}>return to overview</Btn>
      </Panel>
    );
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="#overview">
          <span aria-hidden="true">[</span> rkg{" "}
          <span aria-hidden="true">]</span>
        </a>
        <nav className="tabs" aria-label="main sections">
          {tabs.map((t, i) => (
            <a
              className={active === t ? "on" : ""}
              key={t}
              href={"#" + t}
              aria-current={active === t ? "page" : undefined}
            >
              <kbd>{i + 1}</kbd>
              {t}
            </a>
          ))}
        </nav>
      </header>
      <div className="top-rule" aria-hidden="true">
        {"─".repeat(200)}
      </div>
      <main key={page === "edit" ? route : page}>{content}</main>
      <div className="system-line">
        <span>
          <span className={meta ? "good" : "dim"}>●</span>{" "}
          <span className="dim">
            {meta ? "connected · " + meta.database : "connecting…"}
          </span>
        </span>
        <span className="dim">1–6 switch section · / search</span>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
