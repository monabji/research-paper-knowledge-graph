import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
import express from "express";
import { resolve } from "node:path";
const db = await openDatabase();
const app = createApp(db);
const port = Number(process.env.PORT || 5173);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, "0.0.0.0", () =>
  console.log(
    `Research Knowledge Graph · http://localhost:${port} · ${db.dialect}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
