import { openDatabase } from "../server/db.js";
const db = await openDatabase();
console.log(
  `Database ready (${db.dialect}):`,
  await db.one("SELECT COUNT(*) AS papers FROM paper"),
);
await db.close();
