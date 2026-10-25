# Manage the live website and backend

The website runs on Vercel; its persistent database runs on Neon PostgreSQL in Singapore. Redeploying the website does not reset the database.

## Open the live database

1. Sign in to your Vercel account and open [the database resource](https://vercel.com/d/dashboard/integrations/neon/icfg_e7xMmtIqPr6SnX0HwxVy7hzd/resources/store_mceYspfyW34fSI2o).
2. Choose **Open in Neon** (the integration provides single sign-on). Select the database's current branch and `neondb` database.
3. Open **Tables** to browse and edit rows, or **SQL Editor** to run queries. The application's tables are in the `public` schema.

You own this resource through your Vercel workspace. Credentials are available through the resource's connection settings if you prefer a desktop PostgreSQL client such as DBeaver or pgAdmin. Use SSL and keep credentials private; never commit connection strings.

There are 13 tables:

| Main records | Relationships |
| --- | --- |
| paper, author, institution, venue, dataset, method, keyword | authorship, author_institution, paper_dataset, paper_method, paper_keyword, citation |

The `paper_citation_count` view calculates incoming citation counts. For a first look, run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

SELECT * FROM paper ORDER BY paper_id LIMIT 20;
SELECT * FROM author ORDER BY author_id LIMIT 20;
SELECT * FROM paper_citation_count ORDER BY citation_count DESC LIMIT 10;
```

To preview an edit without saving it:

```sql
BEGIN;
UPDATE paper SET title = 'My revised title' WHERE paper_id = 1;
SELECT paper_id, title FROM paper WHERE paper_id = 1;
ROLLBACK;
```

When you intend to save, use `COMMIT` instead of `ROLLBACK`. Committed edits affect the live website on its next fetch; refresh the page to see them. Foreign keys and uniqueness checks still apply. Deleting a paper also deletes its linked relationship rows. Preview deployments currently share this database: create a separate Neon branch/database before testing destructive SQL or schema changes. Do not run the seed file or integration suite against live data.

## Inspect and change backend code

- [Backend source](https://github.com/monabji/research-paper-knowledge-graph/tree/main/server): `app.js` defines API routes and queries; `model.js` defines fields and validation; `postgres.js` manages PostgreSQL connections and transactions; `vercel.js` is the hosted API entry.
- [Vercel project](https://vercel.com/manavs-projects-0b237225/research-paper-knowledge-graph): open **Logs** for runtime requests/errors, **Deployments** for builds, and **Settings → Environment Variables** for configuration.
- [API reference](API.md) lists the endpoints. The site's **Catalog** already lets you edit entity records and relationships through forms.

Change code locally, then run:

```bash
npm test
npm run build
git add <the-files-you-changed>
git commit -m "Describe your backend change"
git push origin main
npm run deploy:stage
```

The stage command prints a production deployment URL without switching the public domain. Test that URL, then promote it:

```bash
npx -y vercel@65.2.0 promote <deployment-url> --scope manavs-projects-0b237225
```

The existing release keeps serving while Vercel builds. Promotion switches the frontend and API together. Database edits do not require a redeployment; backend code edits do. Schema changes need an explicit migration and should remain compatible with the running release until promotion. Code rollback does not undo database changes.

The private GitHub repository is not yet connected to the Vercel GitHub app, so a push alone does not deploy. Use the commands above, or grant the app access under **Settings → Git** to enable deployment on push.

## Database files and local development

`database/postgres-schema.sql` documents the cloud schema; it is not automatically applied as a migration to populated databases. Local `npm run dev` uses a separate SQLite file unless you set `DATABASE_URL`. This keeps ordinary local edits away from the live database.

If needed, download production connection settings into an ignored local file:

```bash
npx -y vercel@65.2.0 env pull .env.vercel.local --environment production --yes --scope manavs-projects-0b237225
```

Use the pooled `DATABASE_URL` for application traffic and `DATABASE_URL_UNPOOLED` for migrations or administrative clients. Do not share this file. The free Neon database can sleep while idle, so the first request after inactivity may take longer.
