import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.js";
test("SQLite changes and full-text index survive closing and reopening the database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "research-db-"));
  let db;
  try {
    const options = { url: null, path: join(dir, "persistent.db") };
    db = await openDatabase(options);
    await db.run(
      "INSERT INTO paper (title,abstract,publication_year,paper_type) VALUES(?,?,?,?)",
      ["Persistenceheliograph", "A permanent test record", 2026, "journal"],
    );
    await db.close();
    db = await openDatabase(options);
    assert.equal(
      Number((await db.one("SELECT COUNT(*) AS n FROM paper")).n),
      51,
    );
    const match = await db.all(
      "SELECT rowid FROM paper_search WHERE paper_search MATCH ?",
      ["Persistenceheliograph"],
    );
    assert.equal(match.length, 1);
  } finally {
    if (db) await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
