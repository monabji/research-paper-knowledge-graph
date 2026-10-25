import pg from "pg";
import { readFileSync } from "node:fs";
import { attachDatabasePool } from "@vercel/functions";
import { entities } from "./model.js";
const { Pool, types } = pg;
// IDs and counts in this small catalog fit JS safe integers; match SQLite/MySQL JSON types.
types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new Error("database integer exceeds the supported range");
  return n;
});
const read = (name) =>
  readFileSync(new URL(`../database/${name}`, import.meta.url), "utf8");
const paramsSql = (sql) => {
  let n = 0;
  return sql.replace(/\?/g, () => "$" + ++n);
};
export async function openPostgres(url, { initialize = true } = {}) {
  const connectionUrl = new URL(url);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 20000,
    allowExitOnIdle: true,
  });
  pool.on("error", (error) =>
    console.warn(
      "Idle database connection closed:",
      error.code || "connection error",
    ),
  );
  if (process.env.VERCEL) attachDatabasePool(pool);
  let activeClient;
  const query = (sql, params = []) =>
    (activeClient || pool).query(paramsSql(sql), params);
  const db = {
    dialect: "postgres",
    all: async (sql, params = []) => (await query(sql, params)).rows,
    run: async (sql, params = []) => {
      const insert = /^\s*INSERT INTO (\w+)/i.exec(sql);
      const result = await query(insert ? sql + " RETURNING *" : sql, params);
      const id = insert && entities[insert[1]]?.id;
      return {
        lastInsertRowid: id ? result.rows[0]?.[id] : undefined,
        changes: result.rowCount,
      };
    },
    exec: async (sql) => {
      await query(sql);
    },
    close: () => pool.end(),
  };
  db.one = async (sql, params = []) => (await db.all(sql, params))[0];
  db.transaction = async (fn) => {
    const client = await pool.connect();
    activeClient = client;
    try {
      await client.query("BEGIN");
      const result = await fn();
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      activeClient = undefined;
      client.release();
    }
  };
  if (initialize) {
    try {
      await db.transaction(async () => {
        // A transaction-scoped lock prevents two first-start instances from seeding twice.
        await query("SELECT pg_advisory_xact_lock(719422031)");
        if ((await db.one("SELECT to_regclass('paper') AS existing")).existing)
          return;
        await db.exec(read("postgres-schema.sql"));
        await db.exec(read("seed.sql"));
        for (const [table, { id }] of Object.entries(entities))
          await query(
            `SELECT setval(pg_get_serial_sequence(?,?),COALESCE((SELECT MAX(${id}) FROM ${table}),1),true)`,
            [table, id],
          );
      });
    } catch (e) {
      await pool.end();
      throw e;
    }
  }
  return db;
}
