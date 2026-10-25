import { openDatabase } from "../server/db.js";
const db = await openDatabase({
  url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
console.log(
  `Database ready (${db.dialect}):`,
  await db.one("SELECT COUNT(*) AS papers FROM paper"),
);
await db.close();
