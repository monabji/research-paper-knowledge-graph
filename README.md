# Research Paper Knowledge Graph

A complete local web application for the relational database project in the supplied paper. React and Express provide a Terminal ASCII interface for the original seven entities and six association tables. The schema and **exact synthetic seed records** were extracted from Appendix C; this is demonstration data, not real scholarship.

## Run locally

Use Node.js **22.16+** (Node 24 LTS recommended). No separate database server is needed for the default SQLite mode.

```bash
npm ci
npm run dev
```

Open **http://localhost:5173**. The first startup creates and seeds `data/research.db`; later startups preserve your changes. Fonts, ASCII banners, and all application assets are bundled locally, so runtime requires no CDN access. The development server uses nodemon polling for backend changes and Vite updates frontend changes. Polling is limited to `server/` to avoid the native Node watch-mode crash seen on Node 26.7.0; frontend edits do not restart the backend.

Optional settings live in `.env` (copy `.env.example`). `PORT` defaults to `5173`; `SQLITE_PATH` selects another SQLite file. Stop the app before backing up or replacing the database file. To start a fresh demonstration, move the entire `data` directory aside and restart.

## MySQL

The app also supports MySQL **8.0.18+**, with InnoDB, native full-text indexes, citation triggers, and recursive CTEs. An empty database must already exist. Set `DATABASE_URL` to a MySQL connection URL; the app automatically creates its tables and seeds it once.

```bash
# With Docker available:
docker compose up --build
```

Compose starts MySQL 8.4 and the application at port 5173. Data persists in the `research_mysql` volume. The included credentials are for local development; override `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in `.env` before shared use. URL-encode special characters when constructing `DATABASE_URL` manually.

To connect to an existing server, create an empty `utf8mb4` database, grant a user schema creation and DML rights, and set:

```dotenv
DATABASE_URL=mysql://research:research_local@localhost:3306/research_knowledge_graph
```

```bash
npm run db:init
npm run dev
```

`database/mysql-schema.sql`, `database/seed.sql`, and `database/queries.sql` can also be run in that order in a MySQL client after selecting an empty database. The schema includes a citation-count view; the demonstration query file recreates that view as well. Never run fixed-ID seed inserts against a populated database. MySQL DDL commits implicitly; if initial schema creation is interrupted, recreate the empty database before retrying. The app initializes fresh databases; it does not migrate arbitrary pre-existing schemas.

The complete integration suite can run on a **disposable fresh MySQL database**:

```bash
TEST_DATABASE_URL=mysql://research:research_local@localhost:3306/research_test npm test
```

This suite mutates the database and expects the original seed. Use a dedicated test database, never a database containing work you need to retain.

## What works

- **Overview:** current table counts, citation rankings, author activity, publication years, recent records.
- **Papers:** full-text title/abstract search; combined year, venue, author, dataset, method, keyword filters; sorting; pagination; CSV export of all matching records.
- **Paper editor:** create/update/delete metadata; assign ordered authors and correspondence; link datasets, methods, keywords, references. A single transaction saves paper metadata and all selected relationships, rolling back everything if a link is invalid.
- **Authors:** searchable directory, publication list, editable identity details, affiliation history with start/end dates.
- **Citations:** outgoing references and incoming citations, 1–10 hop recursive SQL traversal, shortest-distance grouping, node inspection, table view, CSV export. Cycles terminate at the depth bound.
- **Queries:** citation rankings (including zero-citation papers), prolific authors, affiliations, dataset/method reuse, keywords, coauthor pairs, index query plans, SQL source and CSV exports.
- **Catalog:** CRUD for all seven entities, plus add/remove operations for all six relationship types. Change a relationship by removing it and adding its replacement; paper authors can also be reordered in the paper editor.
- **Keyboard:** `1`–`6` switches sections; `/` opens paper search; native form and button keyboard navigation. Animations respect reduced motion. Destructive buttons require a second press in place.

## Database design

| Entity tables                     | Association tables                                   |
| --------------------------------- | ---------------------------------------------------- |
| paper, author, institution, venue | authorship, author_institution                       |
| dataset, method, keyword          | paper_dataset, paper_method, paper_keyword, citation |

Primary and composite keys enforce identity and unique links. Authors have unique optional ORCIDs; papers have unique optional DOIs; author positions are unique per paper. Year/domain checks, foreign keys and self-citation triggers protect integrity. Deleting a venue sets the paper's venue to null; deleting other records cascades to their association rows. Citation counts are derived using joins/a view, never stored on paper rows.

The initial dataset contains **50 papers, 30 authors, 116 authorship rows, 100 citation edges, 6 institutions, 4 venues, 5 datasets, 6 methods, and 10 keywords**. Each dataset appears in 15 papers; papers 1–5 have 3 incoming citations each; paper 37 references 30, 34, and 36.

SQLite uses FTS5 with triggers that keep the full-text index synchronized after inserts, updates and deletes. MySQL uses `MATCH … AGAINST`. Search terms are treated as required token prefixes. Server-specific tokenization/stopwords can produce different results between engines. MySQL's default Unicode collation is case-insensitive; SQLite's default identity comparisons are case-sensitive. The supplied seed and example queries behave consistently, but these are not interchangeable collations for arbitrary imported data.

`docs/schema.mmd` contains the editable ER diagram. `docs/DESIGN.md` is the supplied frontend design reference. `docs/API.md` documents endpoints. `scripts/extract-reference.py` and `scripts/sqlite-schema.py` reproduce the source extraction and SQLite adaptation; `pdftotext -layout` is needed only to re-extract the PDF, not to run the app.

## Build and verify

```bash
npm test
npm run build
npm start
```

`npm test` uses a separate in-memory SQLite database by default and verifies the seed, all reports, recursive traversal, cyclic graphs, constraints, atomic rollback, full-text updates, CRUD and cascading deletes. `npm run build` writes the production frontend to `dist`; `npm start` serves it and the API on the same port.

SQLite is the locally verified runtime. A live MySQL/Docker run was not possible in the build environment because access to the Docker socket was denied. The MySQL adapter, schema, Compose setup, and optional integration test path are included, but live MySQL compatibility must be verified on a host with a running MySQL server.

## Project layout

```text
src/           React views, shared terminal components, CSS, API client
server/        Express API, validation, SQLite/MySQL adapter
public/        bundled JetBrains Mono fonts and favicon
database/      MySQL schema, SQLite schema, exact seed, demo queries
tests/         HTTP/database integration tests
scripts/       initialization and source extraction tools
docs/          design guide, schema diagram, API documentation
```

This is a trusted local coursework application. As in the original project, authentication, permissions, ingestion pipelines, audit history, and public multi-user hosting are outside its scope. The server uses one serialized connection to keep transactions isolated; the complete catalog is loaded for relation pickers, so this implementation targets the small demonstration collection.

## Credits

Terminal ASCII system: supplied `DESIGN.md`. Pixel banners: [ascii.rest](https://ascii.rest), MIT license (bundled npm package). Font: [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), SIL Open Font License (see `public/fonts/OFL.txt`).
