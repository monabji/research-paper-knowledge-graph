
-- Research Paper Knowledge Graph: demonstration queries

-- 1. Full-text paper search. Change the search expression as needed.
SELECT p.paper_id, p.title, p.publication_year,
MATCH(p.title, p.abstract) AGAINST ('+citation +analysis' IN BOOLEAN MODE) AS relevance
FROM paper AS p
WHERE MATCH(p.title, p.abstract) AGAINST ('+citation +analysis' IN BOOLEAN MODE)
ORDER BY relevance DESC, p.publication_year DESC;
-- 2. Paper details and ordered author list (replace paper_id as needed).
SELECT p.paper_id, p.title, p.publication_year, v.name AS venue,
GROUP_CONCAT(CONCAT(a.full_name, IF(ax.is_corresponding, ' (corresponding)', ''))
ORDER BY ax.author_order SEPARATOR ', ') AS authors
FROM paper AS p
LEFT JOIN venue AS v ON v.venue_id = p.venue_id
LEFT JOIN authorship AS ax ON ax.paper_id = p.paper_id
LEFT JOIN author AS a ON a.author_id = ax.author_id
WHERE p.paper_id = 10
GROUP BY p.paper_id, p.title, p.publication_year, v.name;
-- 3. Most cited papers. Citation count is derived, not stored on paper.
SELECT p.paper_id, p.title, COUNT(c.citing_paper_id) AS citation_count
FROM paper AS p
LEFT JOIN citation AS c ON c.cited_paper_id = p.paper_id
GROUP BY p.paper_id, p.title
ORDER BY citation_count DESC, p.paper_id
LIMIT 10;
-- 4. Most prolific authors.
SELECT a.author_id, a.full_name, COUNT(ax.paper_id) AS paper_count
FROM author AS a
LEFT JOIN authorship AS ax ON ax.author_id = a.author_id
GROUP BY a.author_id, a.full_name
ORDER BY paper_count DESC, a.full_name
LIMIT 10;
-- 5. Author affiliations.
SELECT a.full_name, i.name AS institution, i.country, ai.start_year, ai.end_year
FROM author_institution AS ai
JOIN author AS a ON a.author_id = ai.author_id
JOIN institution AS i ON i.institution_id = ai.institution_id
ORDER BY a.full_name, ai.start_year;
-- 6. Most reused datasets and most used methods.
SELECT d.name, COUNT(*) AS paper_count
FROM paper_dataset AS pd JOIN dataset AS d ON d.dataset_id = pd.dataset_id
GROUP BY d.dataset_id, d.name ORDER BY paper_count DESC, d.name;
SELECT m.name, COUNT(*) AS paper_count
FROM paper_method AS pm JOIN method AS m ON m.method_id = pm.method_id
GROUP BY m.method_id, m.name ORDER BY paper_count DESC, m.name;
-- 7. Filter by keyword (edit the keyword string).
SELECT p.paper_id, p.title, p.publication_year
FROM paper AS p
JOIN paper_keyword AS pk ON pk.paper_id = p.paper_id
JOIN keyword AS k ON k.keyword_id = pk.keyword_id
WHERE k.keyword = 'citation analysis'
ORDER BY p.publication_year DESC, p.title;
-- 8. Papers that use a specified dataset and method (edit both names).
SELECT p.paper_id, p.title
FROM paper AS p
JOIN paper_dataset AS pd ON pd.paper_id = p.paper_id
JOIN dataset AS d ON d.dataset_id = pd.dataset_id
JOIN paper_method AS pm ON pm.paper_id = p.paper_id
JOIN method AS m ON m.method_id = pm.method_id
WHERE d.name = 'OpenScholar Sample Corpus'
AND m.name = 'Entity Linking'
ORDER BY p.paper_id;
-- 9. Author collaboration pairs and number of shared papers.
SELECT a1.full_name AS author_1, a2.full_name AS author_2,
COUNT(DISTINCT x.paper_id) AS shared_papers
FROM authorship AS x
JOIN authorship AS y ON y.paper_id = x.paper_id AND x.author_id < y.author_id
JOIN author AS a1 ON a1.author_id = x.author_id
JOIN author AS a2 ON a2.author_id = y.author_id
GROUP BY a1.author_id, a1.full_name, a2.author_id, a2.full_name
ORDER BY shared_papers DESC, author_1, author_2;
-- 10. Recursive traversal: follow references cited by the starting paper.
-- The seed is acyclic; depth is bounded to make this safe on arbitrary data.
WITH RECURSIVE citation_paths (paper_id, depth) AS (
SELECT c.cited_paper_id, 1
FROM citation AS c
WHERE c.citing_paper_id = 37
UNION DISTINCT
SELECT c.cited_paper_id, cp.depth + 1
FROM citation AS c
JOIN citation_paths AS cp ON c.citing_paper_id = cp.paper_id
WHERE cp.depth < 10
)
SELECT DISTINCT p.paper_id, p.title, cp.depth
FROM citation_paths AS cp
JOIN paper AS p ON p.paper_id = cp.paper_id
ORDER BY cp.depth, p.paper_id;
-- 11. Find papers that cite the selected paper directly.
SELECT citing.paper_id, citing.title, citing.publication_year
FROM citation AS c
JOIN paper AS citing ON citing.paper_id = c.citing_paper_id
WHERE c.cited_paper_id = 20
ORDER BY citing.publication_year DESC;
-- 12. Reusable view for citation rankings.
CREATE OR REPLACE VIEW paper_citation_count AS
SELECT p.paper_id, p.title, COUNT(c.citing_paper_id) AS citation_count
FROM paper AS p
LEFT JOIN citation AS c ON c.cited_paper_id = p.paper_id
GROUP BY p.paper_id, p.title;
SELECT * FROM paper_citation_count ORDER BY citation_count DESC, paper_id LIMIT 10;
-- 13. Inspect an index-assisted query plan (MySQL 8.0.18+).
EXPLAIN ANALYZE
SELECT c.citing_paper_id
FROM citation AS c
WHERE c.cited_paper_id = 20;