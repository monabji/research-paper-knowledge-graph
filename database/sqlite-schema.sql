PRAGMA foreign_keys=ON;
CREATE TABLE venue (venue_id INTEGER PRIMARY KEY AUTOINCREMENT,
name VARCHAR(255) NOT NULL,
venue_type VARCHAR(50) NOT NULL,
publisher VARCHAR(255) NULL,

CONSTRAINT chk_venue_name_not_blank CHECK (LENGTH(TRIM(name)) > 0),
CONSTRAINT chk_venue_type_not_blank CHECK (LENGTH(TRIM(venue_type)) > 0));
CREATE TABLE institution (institution_id INTEGER PRIMARY KEY AUTOINCREMENT,
name VARCHAR(255) NOT NULL,
country VARCHAR(100) NULL,
website VARCHAR(2048) NULL,

CONSTRAINT chk_institution_name_not_blank CHECK (LENGTH(TRIM(name)) > 0));
CREATE TABLE author (author_id INTEGER PRIMARY KEY AUTOINCREMENT,
full_name VARCHAR(255) NOT NULL,
orcid VARCHAR(19) NULL,
email VARCHAR(320) NULL,

UNIQUE (orcid),
CONSTRAINT chk_author_name_not_blank CHECK (LENGTH(TRIM(full_name)) > 0));
CREATE TABLE dataset (dataset_id INTEGER PRIMARY KEY AUTOINCREMENT,
name VARCHAR(255) NOT NULL,
description TEXT NULL,
source_url VARCHAR(2048) NULL,

CONSTRAINT chk_dataset_name_not_blank CHECK (LENGTH(TRIM(name)) > 0));
CREATE TABLE method (method_id INTEGER PRIMARY KEY AUTOINCREMENT,
name VARCHAR(255) NOT NULL,
description TEXT NULL,

CONSTRAINT chk_method_name_not_blank CHECK (LENGTH(TRIM(name)) > 0));
CREATE TABLE keyword (keyword_id INTEGER PRIMARY KEY AUTOINCREMENT,
keyword VARCHAR(255) NOT NULL,

UNIQUE (keyword));
CREATE TABLE paper (paper_id INTEGER PRIMARY KEY AUTOINCREMENT,
title VARCHAR(1000) NOT NULL,
abstract TEXT NOT NULL,
doi VARCHAR(255) NULL,
publication_year INTEGER NOT NULL,
paper_type VARCHAR(50) NOT NULL,
url VARCHAR(2048) NULL,
venue_id INTEGER NULL,

UNIQUE (doi),
CONSTRAINT fk_paper_venue
FOREIGN KEY (venue_id) REFERENCES venue (venue_id)
ON UPDATE CASCADE
ON DELETE SET NULL,
CONSTRAINT chk_paper_title_not_blank CHECK (LENGTH(TRIM(title)) > 0),
CONSTRAINT chk_paper_year CHECK (publication_year BETWEEN 1000 AND 2100),
CONSTRAINT chk_paper_type_not_blank CHECK (LENGTH(TRIM(paper_type)) > 0));
CREATE TABLE authorship (paper_id INTEGER NOT NULL,
author_id INTEGER NOT NULL,
author_order INTEGER NOT NULL,
is_corresponding INTEGER NOT NULL DEFAULT FALSE,
PRIMARY KEY (paper_id, author_id),
UNIQUE (paper_id, author_order),
CONSTRAINT fk_authorship_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_authorship_author
FOREIGN KEY (author_id) REFERENCES author (author_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT chk_authorship_order CHECK (author_order >= 1));
CREATE TABLE author_institution (author_id INTEGER NOT NULL,
institution_id INTEGER NOT NULL,
start_year INTEGER NOT NULL,
end_year INTEGER NULL,
PRIMARY KEY (author_id, institution_id, start_year),
CONSTRAINT fk_author_institution_author
FOREIGN KEY (author_id) REFERENCES author (author_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_author_institution_institution
FOREIGN KEY (institution_id) REFERENCES institution (institution_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT chk_affiliation_start_year CHECK (start_year BETWEEN 1000 AND 2100),
CONSTRAINT chk_affiliation_end_year CHECK (
end_year IS NULL OR (end_year BETWEEN 1000 AND 2100 AND end_year >= start_year)
));
CREATE TABLE paper_dataset (paper_id INTEGER NOT NULL,
dataset_id INTEGER NOT NULL,
PRIMARY KEY (paper_id, dataset_id),
CONSTRAINT fk_paper_dataset_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_dataset_dataset
FOREIGN KEY (dataset_id) REFERENCES dataset (dataset_id)
ON UPDATE CASCADE
ON DELETE CASCADE);
CREATE TABLE paper_method (paper_id INTEGER NOT NULL,
method_id INTEGER NOT NULL,
PRIMARY KEY (paper_id, method_id),
CONSTRAINT fk_paper_method_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_method_method
FOREIGN KEY (method_id) REFERENCES method (method_id)
ON UPDATE CASCADE
ON DELETE CASCADE);
CREATE TABLE paper_keyword (paper_id INTEGER NOT NULL,
keyword_id INTEGER NOT NULL,
PRIMARY KEY (paper_id, keyword_id),
CONSTRAINT fk_paper_keyword_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_keyword_keyword
FOREIGN KEY (keyword_id) REFERENCES keyword (keyword_id)
ON UPDATE CASCADE
ON DELETE CASCADE);
CREATE TABLE citation (citing_paper_id INTEGER NOT NULL,
cited_paper_id INTEGER NOT NULL,
PRIMARY KEY (citing_paper_id, cited_paper_id),
CONSTRAINT fk_citation_citing_paper
FOREIGN KEY (citing_paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_citation_cited_paper
FOREIGN KEY (cited_paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE);
CREATE INDEX idx_venue_name ON venue (name);
CREATE INDEX idx_institution_name ON institution (name);
CREATE INDEX idx_institution_country ON institution (country);
CREATE INDEX idx_author_name ON author (full_name);
CREATE INDEX idx_dataset_name ON dataset (name);
CREATE INDEX idx_method_name ON method (name);
CREATE INDEX idx_paper_venue ON paper (venue_id);
CREATE INDEX idx_paper_publication_year ON paper (publication_year);
CREATE INDEX idx_authorship_author ON authorship (author_id);
CREATE INDEX idx_author_institution_institution ON author_institution (institution_id);
CREATE INDEX idx_paper_dataset_dataset ON paper_dataset (dataset_id);
CREATE INDEX idx_paper_method_method ON paper_method (method_id);
CREATE INDEX idx_paper_keyword_keyword ON paper_keyword (keyword_id);
CREATE INDEX idx_citation_cited_paper ON citation (cited_paper_id);
CREATE TRIGGER citation_no_self_insert BEFORE INSERT ON citation WHEN NEW.citing_paper_id=NEW.cited_paper_id BEGIN SELECT RAISE(ABORT, 'A paper cannot cite itself'); END;
CREATE TRIGGER citation_no_self_update BEFORE UPDATE ON citation WHEN NEW.citing_paper_id=NEW.cited_paper_id BEGIN SELECT RAISE(ABORT, 'A paper cannot cite itself'); END;
CREATE VIRTUAL TABLE paper_search USING fts5(title, abstract, content='paper', content_rowid='paper_id');
CREATE TRIGGER paper_search_insert AFTER INSERT ON paper BEGIN INSERT INTO paper_search(rowid,title,abstract) VALUES(new.paper_id,new.title,new.abstract); END;
CREATE TRIGGER paper_search_delete AFTER DELETE ON paper BEGIN INSERT INTO paper_search(paper_search,rowid,title,abstract) VALUES('delete',old.paper_id,old.title,old.abstract); END;
CREATE TRIGGER paper_search_update AFTER UPDATE ON paper BEGIN INSERT INTO paper_search(paper_search,rowid,title,abstract) VALUES('delete',old.paper_id,old.title,old.abstract); INSERT INTO paper_search(rowid,title,abstract) VALUES(new.paper_id,new.title,new.abstract); END;
CREATE VIEW paper_citation_count AS SELECT p.paper_id,p.title,COUNT(c.citing_paper_id) AS citation_count FROM paper p LEFT JOIN citation c ON c.cited_paper_id=p.paper_id GROUP BY p.paper_id,p.title;