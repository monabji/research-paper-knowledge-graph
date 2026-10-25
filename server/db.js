import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";
const read = (name) =>
  readFileSync(new URL(`../database/${name}`, import.meta.url), "utf8");
export async function openDatabase({
  url = process.env.DATABASE_URL,
  path = process.env.SQLITE_PATH || resolve("data/research.db"),
} = {}) {
  if (/^postgres(?:ql)?:/.test(url || "")) {
    const { openPostgres } = await import("./postgres.js");
    return openPostgres(url);
  }
  let db;
  if (url) {
    const connection = await mysql.createConnection({
      uri: url,
      multipleStatements: true,
    });
    db = {
      dialect: "mysql",
      all: async (sql, params = []) => (await connection.query(sql, params))[0],
      run: async (sql, params = []) => {
        const [r] = await connection.query(sql, params);
        return { lastInsertRowid: r.insertId, changes: r.affectedRows };
      },
      exec: async (sql) => {
        await connection.query(sql);
      },
      close: () => connection.end(),
    };
    const tables = await db.all("SHOW TABLES LIKE 'paper'");
    if (!tables.length) {
      const schema = read("mysql-schema.sql")
        .replace(/^DELIMITER.*$/gm, "")
        .replaceAll("$$", ";");
      await db.exec(schema);
      await db.exec("START TRANSACTION");
      try {
        await db.exec(read("seed.sql"));
        await db.exec("COMMIT");
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
    }
  } else {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const connection = new DatabaseSync(path);
    connection.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    db = {
      dialect: "sqlite",
      all: async (sql, params = []) => connection.prepare(sql).all(...params),
      run: async (sql, params = []) => connection.prepare(sql).run(...params),
      exec: async (sql) => connection.exec(sql),
      close: async () => connection.close(),
    };
    if (
      !(
        await db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='paper'",
        )
      ).length
    ) {
      await db.exec("BEGIN");
      try {
        await db.exec(read("sqlite-schema.sql"));
        await db.exec(read("seed.sql"));
        await db.exec("COMMIT");
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  db.one = async (sql, params = []) => (await db.all(sql, params))[0];
  db.transaction = async (fn) => {
    await db.exec(
      db.dialect === "mysql" ? "START TRANSACTION" : "BEGIN IMMEDIATE",
    );
    try {
      const result = await fn();
      await db.exec("COMMIT");
      return result;
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  };
  return db;
}
