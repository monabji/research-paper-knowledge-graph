import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
let db, server, base;
before(async () => {
  db = await openDatabase({
    url: process.env.TEST_DATABASE_URL || null,
    path: ":memory:",
  });
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});
async function request(path, { method = "GET", body, status = 200 } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  assert.equal(res.status, status, JSON.stringify(data));
  return data;
}
const paper = (extra = {}) => ({
  title: "Transactional discovery test",
  abstract: "A searchable test of atomic scholarly relationships.",
  publication_year: 2026,
  paper_type: "conference",
  ...extra,
});

test("exact source dataset and all 13 relational table counts", async () => {
  const { counts } = await request("/stats");
  assert.deepEqual(counts, {
    paper: 50,
    author: 30,
    institution: 6,
    venue: 4,
    dataset: 5,
    method: 6,
    keyword: 10,
    authorship: 116,
    author_institution: 30,
    paper_dataset: 75,
    paper_method: 75,
    paper_keyword: 75,
    citation: 100,
  });
});
test("seed rankings reproduce the PDF and retain zero-citation papers", async () => {
  const citations = await request("/reports/citations");
  assert.equal(citations.rows.length, 50);
  assert.deepEqual(
    citations.rows
      .slice(0, 5)
      .map((r) => [r.paper_id, Number(r.citation_count)]),
    [
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
      [5, 3],
    ],
  );
  assert.equal(Number(citations.rows.at(-1).citation_count), 0);
  const authors = await request("/reports/authors");
  assert.deepEqual(
    authors.rows.slice(0, 4).map((r) => r.author_id),
    [10, 13, 16, 19],
  );
  for (const r of (await request("/reports/datasets")).rows)
    assert.equal(Number(r.paper_count), 15);
});
test("full-text search, combined resource filters, pagination and keyword lookup", async () => {
  const search = await request("/papers?q=citation");
  assert(search.total > 0);
  assert(search.items.some((p) => /Citation/i.test(p.title)));
  const filtered = await request("/papers?dataset_id=1&method_id=1");
  assert(filtered.total > 0);
  for (const p of filtered.items) {
    const details = await request("/papers/" + p.paper_id);
    assert(details.datasets.some((d) => d.dataset_id === 1));
    assert(details.methods.some((m) => m.method_id === 1));
  }
  const page = await request("/papers?limit=7&page=2");
  assert.equal(page.items.length, 7);
  assert.equal(page.total, 50);
  assert((await request("/papers?keyword_id=2")).total > 0);
  assert((await request("/papers?q=%22%20OR%201%3D1%20--")).total < 50);
  assert.equal((await request("/papers?q=%22%22%22")).total, 0);
});
test("ordered authors, corresponding status and reference direction", async () => {
  const p = await request("/papers/10");
  assert.deepEqual(
    p.authors.map((a) => a.author_id),
    [10, 11],
  );
  assert.equal(p.authors[0].is_corresponding, 1);
  const p37 = await request("/papers/37");
  assert.deepEqual(
    p37.references.map((p) => p.paper_id),
    [30, 34, 36],
  );
  const p30 = await request("/papers/30");
  assert(p30.citedBy.some((p) => p.paper_id === 37));
});
test("bounded traversal finds shortest depth and incoming citations", async () => {
  const graph = await request("/graph?root=37&depth=1");
  assert.deepEqual(
    graph.nodes.map((n) => n.paper_id),
    [37, 30, 34, 36],
  );
  const deep = await request("/graph?root=37&depth=10");
  assert(deep.nodes.length > 20);
  assert(deep.nodes.every((n) => n.depth <= 10));
  assert.equal(
    new Set(deep.nodes.map((n) => n.paper_id)).size,
    deep.nodes.length,
  );
  const incoming = await request("/graph?root=30&direction=incoming&depth=1");
  assert(incoming.nodes.some((n) => n.paper_id === 37));
});
test("paper creation and update atomically save ordered relationships; search index follows changes", async () => {
  const p = await request("/records/paper", {
    method: "POST",
    status: 201,
    body: paper({
      relationships: {
        authors: [
          { id: 2, corresponding: true },
          { id: 1, corresponding: false },
        ],
        datasets: [1],
        methods: [1],
        keywords: [2],
        references: [30],
      },
    }),
  });
  let detail = await request("/papers/" + p.paper_id);
  assert.deepEqual(
    detail.authors.map((a) => a.author_id),
    [2, 1],
  );
  assert.equal(detail.authors[0].is_corresponding, 1);
  assert.equal(detail.references[0].paper_id, 30);
  assert(
    (await request("/papers?q=transactional")).items.some(
      (p) => p.paper_id === detail.paper_id,
    ),
  );
  await request("/records/paper/" + p.paper_id, {
    method: "PUT",
    body: paper({
      title: "Uniqueheliograph study",
      relationships: {
        authors: [{ id: 1, corresponding: true }],
        datasets: [],
        methods: [2],
        keywords: [],
        references: [],
      },
    }),
  });
  detail = await request("/papers/" + p.paper_id);
  assert.deepEqual(
    detail.authors.map((a) => a.author_id),
    [1],
  );
  assert.equal(detail.references.length, 0);
  assert.equal(detail.datasets.length, 0);
  assert((await request("/papers?q=Uniqueheliograph")).total === 1);
  await request("/records/paper/" + p.paper_id, { method: "DELETE" });
  assert.equal((await request("/papers?q=Uniqueheliograph")).total, 0);
  assert.equal(
    (
      await db.one("SELECT COUNT(*) AS n FROM authorship WHERE paper_id=?", [
        p.paper_id,
      ])
    ).n,
    0,
  );
});
test("invalid nested relationship rolls back new metadata and prior relationship changes", async () => {
  await request("/records/paper", {
    method: "POST",
    status: 400,
    body: paper({
      title: "Rollback-only title",
      relationships: { datasets: [1, 99999] },
    }),
  });
  assert.equal((await request("/papers?q=Rollback")).total, 0);
  const before = await request("/papers/10");
  await request("/records/paper/10", {
    method: "PUT",
    status: 400,
    body: paper({
      title: "Must never persist",
      relationships: { authors: [{ id: 1 }], datasets: [999999] },
    }),
  });
  const after = await request("/papers/10");
  assert.equal(after.title, before.title);
  assert.deepEqual(after.authors, before.authors);
});
test("unique DOI and ORCID reject duplicates while NULL identifiers are reusable", async () => {
  const p = await request("/records/paper", {
    method: "POST",
    status: 201,
    body: paper({ doi: "10.0000/test-identity" }),
  });
  await request("/records/paper", {
    method: "POST",
    status: 409,
    body: paper({ doi: "10.0000/test-identity" }),
  });
  await request("/records/paper/" + p.paper_id, { method: "DELETE" });
  const a = await request("/records/author", {
    method: "POST",
    status: 201,
    body: { full_name: "Identity Test", orcid: "0000-0000-0000-0001" },
  });
  await request("/records/author", {
    method: "POST",
    status: 409,
    body: { full_name: "Identity Duplicate", orcid: a.orcid },
  });
  await request("/records/author/" + a.author_id, { method: "DELETE" });
});
test("citations reject self-links and duplicates, permit bounded cyclic traversal", async () => {
  await request("/relations/citation", {
    method: "POST",
    status: 400,
    body: { citing_paper_id: 1, cited_paper_id: 1 },
  });
  await request("/relations/citation", {
    method: "POST",
    status: 409,
    body: { citing_paper_id: 37, cited_paper_id: 30 },
  });
  await request("/relations/citation", {
    method: "POST",
    status: 201,
    body: { citing_paper_id: 30, cited_paper_id: 37 },
  });
  const cyclic = await request("/graph?root=37&depth=10");
  assert(cyclic.nodes.length <= 50);
  assert(cyclic.nodes.every((n) => n.depth <= 10));
  await request("/relations/citation", {
    method: "DELETE",
    body: { citing_paper_id: 30, cited_paper_id: 37 },
  });
});
test("invalid years, empty labels, dangerous URLs and missing records return useful errors", async () => {
  await request("/records/paper", {
    method: "POST",
    status: 400,
    body: paper({ publication_year: 999 }),
  });
  await request("/records/paper", {
    method: "POST",
    status: 400,
    body: paper({ title: "   " }),
  });
  await request("/records/dataset", {
    method: "POST",
    status: 400,
    body: { name: "Test", source_url: "javascript:alert(1)" },
  });
  await request("/papers/nope", { status: 400 });
  await request("/papers/999999", { status: 404 });
  await request("/graph?root=999999", { status: 404 });
  await request("/records/not_a_table", { status: 404 });
  await request("/reports/not_a_query", { status: 404 });
});
test("affiliation checks enforce date order, and author deletion cascades affiliations", async () => {
  const a = await request("/records/author", {
    method: "POST",
    status: 201,
    body: { full_name: "Affiliation Test" },
  });
  await request("/relations/author_institution", {
    method: "POST",
    status: 400,
    body: {
      author_id: a.author_id,
      institution_id: 1,
      start_year: 2024,
      end_year: 2020,
    },
  });
  await request("/relations/author_institution", {
    method: "POST",
    status: 201,
    body: {
      author_id: a.author_id,
      institution_id: 1,
      start_year: 2024,
      end_year: null,
    },
  });
  await request("/relations/authorship", {
    method: "POST",
    status: 201,
    body: {
      paper_id: 1,
      author_id: a.author_id,
      author_order: 4,
      is_corresponding: false,
    },
  });
  await request("/records/author/" + a.author_id, { method: "DELETE" });
  assert.equal(
    (
      await db.one(
        "SELECT COUNT(*) AS n FROM author_institution WHERE author_id=?",
        [a.author_id],
      )
    ).n,
    0,
  );
  assert.equal(
    (
      await db.one("SELECT COUNT(*) AS n FROM authorship WHERE author_id=?", [
        a.author_id,
      ])
    ).n,
    0,
  );
});
test("deleting a venue retains its papers with a null venue", async () => {
  const v = await request("/records/venue", {
    method: "POST",
    status: 201,
    body: { name: "Temporary venue", venue_type: "workshop" },
  });
  const p = await request("/records/paper", {
    method: "POST",
    status: 201,
    body: paper({ venue_id: v.venue_id }),
  });
  await request("/records/venue/" + v.venue_id, { method: "DELETE" });
  assert.equal((await request("/papers/" + p.paper_id)).venue_id, null);
  await request("/records/paper/" + p.paper_id, { method: "DELETE" });
});
test("all entity catalogs support create, update, delete, and duplicate keywords fail", async () => {
  for (const type of ["institution", "dataset", "method", "keyword"]) {
    const body =
      type === "keyword"
        ? { keyword: "test keyword" }
        : { name: "Test " + type };
    const r = await request("/records/" + type, {
      method: "POST",
      status: 201,
      body,
    });
    const id = r[type + "_id"];
    const next =
      type === "keyword"
        ? { keyword: "updated test keyword" }
        : { name: "Updated " + type };
    await request("/records/" + type + "/" + id, { method: "PUT", body: next });
    assert.equal(
      (await request("/records/" + type + "/" + id))[
        type === "keyword" ? "keyword" : "name"
      ],
      Object.values(next)[0],
    );
    await request("/records/" + type + "/" + id, { method: "DELETE" });
  }
  await request("/records/keyword", {
    method: "POST",
    status: 409,
    body: { keyword: "citation analysis" },
  });
});
test("all report queries execute and an indexed citation query plan is available", async () => {
  for (const r of await request("/reports")) {
    const result = await request("/reports/" + r.id);
    assert(Array.isArray(result.rows));
    assert(result.rows.length > 0);
    assert(result.sql.length > 10);
  }
  const plan = await request("/reports/plan");
  assert(JSON.stringify(plan.rows).includes("idx_citation_cited_paper"));
});
test("database-level checks protect direct SQL writes too", async () => {
  await assert.rejects(
    () => db.run("INSERT INTO citation VALUES(1,1)"),
    /cannot cite itself/,
  );
  await assert.rejects(
    () =>
      db.run(
        "UPDATE citation SET cited_paper_id=citing_paper_id WHERE citing_paper_id=37",
      ),
    /cannot cite itself/,
  );
  await assert.rejects(
    () => db.run("INSERT INTO authorship VALUES(1,30,1,0)"),
    /UNIQUE|Duplicate/,
  );
  await assert.rejects(
    () =>
      db.run(
        "INSERT INTO paper(title,abstract,publication_year,paper_type) VALUES('invalid','test',999,'conference')",
      ),
    /CHECK|check constraint/,
  );
});

test("concurrent writes preserve transaction boundaries and failed requests release the queue", async () => {
  const before = Number((await db.one("SELECT COUNT(*) AS n FROM paper")).n);
  const [good] = await Promise.all([
    request("/records/paper", {
      method: "POST",
      status: 201,
      body: paper({
        title: "Concurrent valid paper",
        relationships: { authors: [{ id: 1 }] },
      }),
    }),
    request("/records/paper", {
      method: "POST",
      status: 400,
      body: paper({
        title: "Concurrent invalid paper",
        relationships: { datasets: [999999] },
      }),
    }),
    request("/unknown-endpoint", { status: 404 }),
    request("/health"),
  ]);
  assert.equal(
    Number((await db.one("SELECT COUNT(*) AS n FROM paper")).n),
    before + 1,
  );
  assert.equal((await request("/papers?q=Concurrent")).total, 1);
  await request("/records/paper/" + good.paper_id, { method: "DELETE" });
  await request("/records/paper", {
    method: "POST",
    status: 400,
    body: paper({ relationships: { authors: [null] } }),
  });
  await request("/records/paper", {
    method: "POST",
    status: 400,
    body: paper({
      relationships: { authors: [{ id: 1, corresponding: "false" }] },
    }),
  });
});
