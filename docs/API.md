# API

All endpoints are under `/api`, same origin as the UI. JSON request and response bodies. Errors use `{ "error": "message" }` and HTTP 400 (invalid data), 404 (missing record), 409 (duplicate), or 500. IDs are positive integers. The service is intended for trusted local use and has no authentication.

| Method | Path                                        | Behavior                                                                     |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/health`                                   | Database status and dialect                                                  |
| GET    | `/meta`                                     | Entity field definitions and relationship columns                            |
| GET    | `/stats`                                    | Counts for all 13 tables, rankings, years, recent papers                     |
| GET    | `/catalog`                                  | All seven entity catalogs for selectors                                      |
| GET    | `/papers`                                   | Full-text search, filters, ordering, pagination                              |
| GET    | `/papers/:id`                               | Paper with ordered authors, resources, references and incoming citations     |
| GET    | `/graph?root=37&depth=3&direction=outgoing` | Recursive citation traversal; nodes grouped by shortest depth; induced edges |
| GET    | `/reports`                                  | Available report IDs and titles                                              |
| GET    | `/reports/:id`                              | SQL source, rows and execution duration                                      |
| GET    | `/records/:type`                            | Entity rows (authors include affiliations and publication counts)            |
| GET    | `/records/:type/:id`                        | Single entity row                                                            |
| POST   | `/records/:type`                            | Create a record; HTTP 201                                                    |
| PUT    | `/records/:type/:id`                        | Replace editable metadata; required fields must be provided                  |
| DELETE | `/records/:type/:id`                        | Delete entity with schema-defined cascades                                   |
| GET    | `/relations/:type`                          | Association rows                                                             |
| POST   | `/relations/:type`                          | Add a validated relationship; HTTP 201                                       |
| DELETE | `/relations/:type`                          | Remove relationship identified by JSON composite key                         |

`type` is allowlisted: paper, author, institution, venue, dataset, method, keyword. Relationship types: authorship, author_institution, paper_dataset, paper_method, paper_keyword, citation. See `/meta` for exact columns.

Paper search accepts `q`, `publication_year`, `venue_id`, `author_id`, `dataset_id`, `method_id`, `keyword_id`, `sort` (`newest`, `oldest`, `citations`, `title`), `page` (1-based) and `limit` (1–100). Filters combine with AND. Response: `{items,total,page,limit}`.

Graph depth is clamped to 10. `direction=incoming` follows papers that cite the root; the default follows its references. Cycles are bounded; each paper appears once at its minimum distance, and the root appears at depth 0. Edges retain their stored citing → cited direction, including when traversing incoming citations.

Creating or updating a paper can atomically replace supplied relationship groups:

```json
{
  "title": "A new study",
  "abstract": "A description of the study.",
  "publication_year": 2026,
  "paper_type": "conference",
  "venue_id": 1,
  "relationships": {
    "authors": [
      { "id": 10, "corresponding": true },
      { "id": 11, "corresponding": false }
    ],
    "datasets": [1],
    "methods": [2],
    "keywords": [1, 2],
    "references": [30, 34]
  }
}
```

Author array order becomes `author_order`. An omitted group retains its existing links; an empty array removes that group's links. Metadata and supplied links share a transaction. If any foreign key, duplicate, or domain constraint fails, all changes roll back.

Deleting an affiliation requires `author_id`, `institution_id`, and `start_year`; authorship requires `paper_id` and `author_id`; citations require `citing_paper_id` and `cited_paper_id`. Other relationships use their pair of entity IDs. Relationship attributes are replaced by deleting the old relationship and adding the new one.

Report IDs: `citations`, `authors`, `affiliations`, `datasets`, `methods`, `collaborations`, `keywords`, `plan`. Arbitrary SQL execution is not exposed.
