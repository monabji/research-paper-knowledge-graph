import express from "express";
import {
  entities,
  relations,
  validateEntity,
  positiveInt,
  HttpError,
} from "./model.js";
export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));
  // One connection is shared. Serialize API requests so transactions cannot interleave.
  let tail = Promise.resolve();
  app.use("/api", async (req, res, next) => {
    const previous = tail;
    let unlock;
    tail = new Promise((r) => (unlock = r));
    await previous;
    let done = false;
    const release = () => {
      if (!done) {
        done = true;
        unlock();
      }
    };
    if (res.destroyed || req.aborted) {
      release();
      return;
    }
    req.releaseApi = release;
    next();
  });
  const route = (method, path, fn) =>
    app[method](path, async (req, res, next) => {
      try {
        res.json(await fn(req, res));
      } catch (e) {
        next(e);
      } finally {
        req.releaseApi?.();
      }
    });
  const getEntity = (t) => {
    if (!Object.hasOwn(entities, t))
      throw new HttpError(404, "record type not found");
    return entities[t];
  };
  const mustExist = async (type, id) => {
    const config = getEntity(type);
    const row = await db.one(`SELECT * FROM ${type} WHERE ${config.id}=?`, [
      positiveInt(id),
    ]);
    if (!row) throw new HttpError(404, "record not found");
    return row;
  };
  const paperSelect = `SELECT p.*,v.name AS venue,(SELECT COUNT(*) FROM citation c WHERE c.cited_paper_id=p.paper_id) AS citation_count FROM paper p LEFT JOIN venue v ON v.venue_id=p.venue_id`;
  async function enrich(papers) {
    for (const p of papers) {
      p.authors = await db.all(
        "SELECT a.*,x.author_order,x.is_corresponding FROM authorship x JOIN author a ON a.author_id=x.author_id WHERE x.paper_id=? ORDER BY x.author_order",
        [p.paper_id],
      );
      p.keywords = await db.all(
        "SELECT k.* FROM keyword k JOIN paper_keyword x ON x.keyword_id=k.keyword_id WHERE x.paper_id=? ORDER BY k.keyword",
        [p.paper_id],
      );
    }
    return papers;
  }
  route("get", "/api/health", async () => ({
    status: "online",
    database: db.dialect,
  }));
  route("get", "/api/meta", async () => ({
    entities,
    relations,
    database: db.dialect,
  }));
  route("get", "/api/stats", async () => {
    const counts = {};
    for (const t of [...Object.keys(entities), ...Object.keys(relations)])
      counts[t] = Number((await db.one(`SELECT COUNT(*) AS n FROM ${t}`)).n);
    const previewRoot = await db.one(
      "SELECT paper_id FROM paper ORDER BY CASE WHEN paper_id=37 THEN 0 ELSE 1 END,paper_id LIMIT 1",
    );
    const preview = previewRoot
      ? {
          root: previewRoot.paper_id,
          references: await db.all(
            "SELECT cited_paper_id AS paper_id FROM citation WHERE citing_paper_id=? ORDER BY cited_paper_id",
            [previewRoot.paper_id],
          ),
        }
      : null;
    return {
      counts,
      preview,
      database: db.dialect,
      years: await db.all(
        "SELECT publication_year AS year,COUNT(*) AS count FROM paper GROUP BY publication_year ORDER BY publication_year",
      ),
      topPapers: await db.all(
        "SELECT * FROM paper_citation_count ORDER BY citation_count DESC,paper_id LIMIT 5",
      ),
      topAuthors: await db.all(
        "SELECT a.author_id,a.full_name,COUNT(x.paper_id) AS paper_count FROM author a LEFT JOIN authorship x ON x.author_id=a.author_id GROUP BY a.author_id,a.full_name ORDER BY paper_count DESC,a.full_name LIMIT 5",
      ),
      recent: await enrich(
        await db.all(`${paperSelect} ORDER BY p.paper_id DESC LIMIT 4`),
      ),
    };
  });
  route("get", "/api/catalog", async () => {
    const result = {};
    for (const [t, c] of Object.entries(entities))
      result[t] = await db.all(`SELECT * FROM ${t} ORDER BY ${c.id}`);
    return result;
  });
  route("get", "/api/papers", async (req) => {
    const where = [],
      params = [];
    let query = String(req.query.q || "")
      .trim()
      .slice(0, 300);
    if (query) {
      const tokens = query.match(/[\p{L}\p{N}]+/gu) || [];
      if (!tokens.length) where.push("1=0");
      else if (db.dialect === "mysql") {
        where.push("MATCH(p.title,p.abstract) AGAINST (? IN BOOLEAN MODE)");
        params.push(tokens.map((t) => "+" + t + "*").join(" "));
      } else {
        where.push(
          "p.paper_id IN (SELECT rowid FROM paper_search WHERE paper_search MATCH ?)",
        );
        params.push(tokens.map((t) => `"${t}"*`).join(" AND "));
      }
    }
    for (const key of ["venue_id", "publication_year"])
      if (req.query[key]) {
        where.push(`p.${key}=?`);
        params.push(positiveInt(req.query[key], key));
      }
    for (const [key, table] of [
      ["author_id", "authorship"],
      ["dataset_id", "paper_dataset"],
      ["method_id", "paper_method"],
      ["keyword_id", "paper_keyword"],
    ])
      if (req.query[key]) {
        where.push(
          `EXISTS (SELECT 1 FROM ${table} x WHERE x.paper_id=p.paper_id AND x.${key}=?)`,
        );
        params.push(positiveInt(req.query[key], key));
      }
    const clause = where.length ? " WHERE " + where.join(" AND ") : "";
    const total = Number(
      (await db.one(`SELECT COUNT(*) AS n FROM paper p${clause}`, params)).n,
    );
    const page = positiveInt(req.query.page || 1, "page");
    const limit = Math.min(100, positiveInt(req.query.limit || 10, "limit"));
    const sort =
      {
        newest: "p.publication_year DESC,p.paper_id DESC",
        oldest: "p.publication_year,p.paper_id",
        citations: "citation_count DESC,p.paper_id",
        title: "p.title,p.paper_id",
      }[req.query.sort] || "p.publication_year DESC,p.paper_id DESC";
    return {
      items: await enrich(
        await db.all(
          `${paperSelect}${clause} ORDER BY ${sort} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
          params,
        ),
      ),
      total,
      page,
      limit,
    };
  });
  route("get", "/api/papers/:id", async (req) => {
    const id = positiveInt(req.params.id);
    await mustExist("paper", id);
    const [paper] = await enrich(
      await db.all(`${paperSelect} WHERE p.paper_id=?`, [id]),
    );
    for (const t of ["dataset", "method"])
      paper[t + "s"] = await db.all(
        `SELECT e.* FROM ${t} e JOIN paper_${t} x ON x.${t}_id=e.${t}_id WHERE x.paper_id=?`,
        [id],
      );
    paper.references = await db.all(
      `${paperSelect} JOIN citation x ON x.cited_paper_id=p.paper_id WHERE x.citing_paper_id=? ORDER BY p.paper_id`,
      [id],
    );
    paper.citedBy = await db.all(
      `${paperSelect} JOIN citation x ON x.citing_paper_id=p.paper_id WHERE x.cited_paper_id=? ORDER BY p.paper_id`,
      [id],
    );
    return paper;
  });
  route("get", "/api/graph", async (req) => {
    const root = positiveInt(req.query.root || 37),
      depth = Math.min(10, positiveInt(req.query.depth || 3));
    await mustExist("paper", root);
    const reverse = req.query.direction === "incoming";
    const src = reverse ? "cited_paper_id" : "citing_paper_id",
      dst = reverse ? "citing_paper_id" : "cited_paper_id";
    const union = db.dialect === "mysql" ? "UNION DISTINCT" : "UNION";
    const sql = `WITH RECURSIVE paths(paper_id,depth) AS (SELECT ${dst},1 FROM citation WHERE ${src}=? ${union} SELECT c.${dst},x.depth+1 FROM citation c JOIN paths x ON c.${src}=x.paper_id WHERE x.depth<?) SELECT p.paper_id,p.title,p.publication_year,MIN(x.depth) AS depth FROM paths x JOIN paper p ON p.paper_id=x.paper_id WHERE p.paper_id<>? GROUP BY p.paper_id,p.title,p.publication_year ORDER BY depth,p.paper_id`;
    const nodes = await db.all(sql, [root, depth, root]);
    nodes.unshift({ ...(await mustExist("paper", root)), depth: 0 });
    const ids = nodes.map((n) => n.paper_id),
      marks = ids.map(() => "?").join(",");
    const edges = await db.all(
      `SELECT * FROM citation WHERE citing_paper_id IN (${marks}) AND cited_paper_id IN (${marks})`,
      [...ids, ...ids],
    );
    return {
      root,
      depth,
      direction: reverse ? "incoming" : "outgoing",
      nodes,
      edges,
      sql,
    };
  });
  const reports = {
    citations: {
      title: "most cited papers",
      sql: "SELECT * FROM paper_citation_count ORDER BY citation_count DESC,paper_id",
    },
    authors: {
      title: "most prolific authors",
      sql: "SELECT a.author_id,a.full_name,COUNT(x.paper_id) AS paper_count FROM author a LEFT JOIN authorship x ON a.author_id=x.author_id GROUP BY a.author_id,a.full_name ORDER BY paper_count DESC,a.full_name",
    },
    affiliations: {
      title: "author affiliations",
      sql: "SELECT a.author_id,a.full_name,i.name AS institution,i.country,x.start_year,x.end_year FROM author_institution x JOIN author a ON a.author_id=x.author_id JOIN institution i ON i.institution_id=x.institution_id ORDER BY a.full_name,x.start_year",
    },
    datasets: {
      title: "dataset reuse",
      sql: "SELECT d.dataset_id,d.name,COUNT(x.paper_id) AS paper_count FROM dataset d LEFT JOIN paper_dataset x ON d.dataset_id=x.dataset_id GROUP BY d.dataset_id,d.name ORDER BY paper_count DESC,d.name",
    },
    methods: {
      title: "method usage",
      sql: "SELECT m.method_id,m.name,COUNT(x.paper_id) AS paper_count FROM method m LEFT JOIN paper_method x ON m.method_id=x.method_id GROUP BY m.method_id,m.name ORDER BY paper_count DESC,m.name",
    },
    collaborations: {
      title: "author collaborations",
      sql: "SELECT a.full_name AS author_1,b.full_name AS author_2,COUNT(DISTINCT x.paper_id) AS shared_papers FROM authorship x JOIN authorship y ON x.paper_id=y.paper_id AND x.author_id<y.author_id JOIN author a ON a.author_id=x.author_id JOIN author b ON b.author_id=y.author_id GROUP BY a.author_id,a.full_name,b.author_id,b.full_name ORDER BY shared_papers DESC,author_1,author_2",
    },
    keywords: {
      title: "keyword frequency",
      sql: "SELECT k.keyword_id,k.keyword,COUNT(x.paper_id) AS paper_count FROM keyword k LEFT JOIN paper_keyword x ON x.keyword_id=k.keyword_id GROUP BY k.keyword_id,k.keyword ORDER BY paper_count DESC,k.keyword",
    },
    plan: {
      title: "citation index query plan",
      sql:
        db.dialect === "mysql"
          ? "EXPLAIN SELECT citing_paper_id FROM citation WHERE cited_paper_id=20"
          : "EXPLAIN QUERY PLAN SELECT citing_paper_id FROM citation WHERE cited_paper_id=20",
    },
  };
  route("get", "/api/reports", async () =>
    Object.entries(reports).map(([id, r]) => ({ id, title: r.title })),
  );
  route("get", "/api/reports/:id", async (req) => {
    const report = reports[req.params.id];
    if (!Object.hasOwn(reports, req.params.id))
      throw new HttpError(404, "query not found");
    const start = performance.now();
    return {
      ...report,
      rows: await db.all(report.sql),
      duration: Math.round((performance.now() - start) * 100) / 100,
    };
  });
  route("get", "/api/records/:type", async (req) => {
    const t = req.params.type,
      c = getEntity(t);
    let rows = await db.all(`SELECT * FROM ${t} ORDER BY ${c.id}`);
    if (t === "author")
      for (const r of rows) {
        r.paper_count = Number(
          (
            await db.one(
              "SELECT COUNT(*) AS n FROM authorship WHERE author_id=?",
              [r.author_id],
            )
          ).n,
        );
        r.affiliations = await db.all(
          "SELECT i.*,x.start_year,x.end_year FROM author_institution x JOIN institution i ON i.institution_id=x.institution_id WHERE x.author_id=? ORDER BY x.start_year",
          [r.author_id],
        );
      }
    return rows;
  });
  route("get", "/api/records/:type/:id", async (req) =>
    mustExist(req.params.type, req.params.id),
  );
  async function savePaperLinks(id, links) {
    if (!links) return;
    if (typeof links !== "object" || Array.isArray(links))
      throw new HttpError(400, "relationships must be an object");
    for (const [key, t, column] of [
      ["authors", "authorship", "author_id"],
      ["datasets", "paper_dataset", "dataset_id"],
      ["methods", "paper_method", "method_id"],
      ["keywords", "paper_keyword", "keyword_id"],
      ["references", "citation", "cited_paper_id"],
    ]) {
      if (links[key] === undefined) continue;
      if (!Array.isArray(links[key]) || links[key].length > 500)
        throw new HttpError(400, `${key} must be a list of up to 500 entries`);
      const paperColumn = t === "citation" ? "citing_paper_id" : "paper_id";
      await db.run(`DELETE FROM ${t} WHERE ${paperColumn}=?`, [id]);
      for (const [index, item] of links[key].entries()) {
        if (item == null)
          throw new HttpError(400, `${key} contains an invalid entry`);
        if (
          t === "authorship" &&
          (typeof item !== "object" ||
            Array.isArray(item) ||
            (item.corresponding !== undefined &&
              typeof item.corresponding !== "boolean"))
        )
          throw new HttpError(
            400,
            "authors must contain an id and optional boolean corresponding flag",
          );
        const target = positiveInt(
          typeof item === "object" ? item.id : item,
          key,
        );
        if (t === "authorship")
          await db.run(
            "INSERT INTO authorship (paper_id,author_id,author_order,is_corresponding) VALUES(?,?,?,?)",
            [id, target, index + 1, item.corresponding ? 1 : 0],
          );
        else
          await db.run(
            `INSERT INTO ${t} (${paperColumn},${column}) VALUES(?,?)`,
            [id, target],
          );
      }
    }
  }
  route("post", "/api/records/:type", async (req, res) => {
    const t = req.params.type;
    getEntity(t);
    const values = validateEntity(t, req.body);
    const id = await db.transaction(async () => {
      const r = await db.run(
        `INSERT INTO ${t} (${Object.keys(values).join(",")}) VALUES(${Object.keys(
          values,
        )
          .map(() => "?")
          .join(",")})`,
        Object.values(values),
      );
      const id = Number(r.lastInsertRowid);
      if (t === "paper") await savePaperLinks(id, req.body.relationships);
      return id;
    });
    res.status(201);
    return mustExist(t, id);
  });
  route("put", "/api/records/:type/:id", async (req) => {
    const t = req.params.type,
      c = getEntity(t),
      id = positiveInt(req.params.id);
    await mustExist(t, id);
    const values = validateEntity(t, req.body);
    await db.transaction(async () => {
      await db.run(
        `UPDATE ${t} SET ${Object.keys(values)
          .map((k) => `${k}=?`)
          .join(",")} WHERE ${c.id}=?`,
        [...Object.values(values), id],
      );
      if (t === "paper") await savePaperLinks(id, req.body.relationships);
    });
    return mustExist(t, id);
  });
  route("delete", "/api/records/:type/:id", async (req) => {
    const t = req.params.type,
      c = getEntity(t),
      id = positiveInt(req.params.id);
    await mustExist(t, id);
    await db.run(`DELETE FROM ${t} WHERE ${c.id}=?`, [id]);
    return { deleted: true };
  });
  route("get", "/api/relations/:type", async (req) => {
    const t = req.params.type;
    if (!Object.hasOwn(relations, t))
      throw new HttpError(404, "relationship type not found");
    return db.all(`SELECT * FROM ${t}`);
  });
  route("post", "/api/relations/:type", async (req, res) => {
    const t = req.params.type,
      fields = relations[t];
    if (!Object.hasOwn(relations, t))
      throw new HttpError(404, "relationship type not found");
    const values = fields.map((f) => {
      if (f === "end_year" && (req.body[f] === "" || req.body[f] == null))
        return null;
      if (f === "is_corresponding") {
        if (![0, 1, true, false].includes(req.body[f]))
          throw new HttpError(400, "corresponding must be true or false");
        return req.body[f] ? 1 : 0;
      }
      const v = positiveInt(req.body[f], f);
      if (f.endsWith("year") && (v < 1000 || v > 2100))
        throw new HttpError(400, "year must be between 1000 and 2100");
      return v;
    });
    await db.run(
      `INSERT INTO ${t} (${fields.join(",")}) VALUES(${fields.map(() => "?")})`,
      values,
    );
    res.status(201);
    return Object.fromEntries(fields.map((f, i) => [f, values[i]]));
  });
  route("delete", "/api/relations/:type", async (req) => {
    const t = req.params.type,
      fields = relations[t];
    if (!Object.hasOwn(relations, t))
      throw new HttpError(404, "relationship type not found");
    const keys = fields.filter((f) => f.endsWith("_id") || f === "start_year");
    const values = keys.map((k) => positiveInt(req.body[k], k));
    const r = await db.run(
      `DELETE FROM ${t} WHERE ${keys.map((k) => `${k}=?`).join(" AND ")}`,
      values,
    );
    if (!r.changes) throw new HttpError(404, "relationship not found");
    return { deleted: true };
  });
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "endpoint not found" });
    req.releaseApi?.();
  });
  app.use((err, req, res, next) => {
    req.releaseApi?.();
    let status = err.status || 500,
      message = err.message;
    if (/UNIQUE constraint|Duplicate entry/i.test(message)) {
      status = 409;
      message = "this identifier or relationship already exists";
    } else if (/FOREIGN KEY constraint|foreign key constraint/i.test(message)) {
      status = 400;
      message = "a linked record no longer exists; refresh and try again";
    } else if (
      /CHECK constraint|check constraint|cannot cite itself/i.test(message)
    ) {
      status = 400;
    } else if (status >= 500) {
      console.error(err);
      message = "the database request failed; try again";
    }
    res.status(status).json({ error: message });
  });
  return app;
}
