import express from "express";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

// Vercel imports this entry point at build time. Connect only on the first request.
const app = express();
let ready;
app.use(async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL must point to persistent cloud storage");
    ready ??= openDatabase()
      .then((db) => createApp(db))
      .catch((error) => {
        ready = undefined;
        throw error;
      });
    const api = await ready;
    api(req, res, next);
  } catch (error) {
    console.error("API initialization failed:", error.message);
    res
      .status(503)
      .json({
        error: "the database is temporarily unavailable; please try again",
      });
  }
});
export default app;
