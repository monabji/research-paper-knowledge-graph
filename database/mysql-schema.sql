-- ASSESSMENT 10 COMPLETE RUNNABLE SQL
-- MySQL 8.0.18+ recommended. Run once on a fresh database.
-- Demo records are synthetic.
-- Research Paper Knowledge Graph
-- MySQL 8.0+


-- Core entities
CREATE TABLE venue (
venue_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
name VARCHAR(255) NOT NULL,
venue_type VARCHAR(50) NOT NULL,
publisher VARCHAR(255) NULL,
PRIMARY KEY (venue_id),
CONSTRAINT chk_venue_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
CONSTRAINT chk_venue_type_not_blank CHECK (CHAR_LENGTH(TRIM(venue_type)) > 0),
INDEX idx_venue_name (name)
) ENGINE = InnoDB;
CREATE TABLE institution (
institution_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
name VARCHAR(255) NOT NULL,
country VARCHAR(100) NULL,
website VARCHAR(2048) NULL,
PRIMARY KEY (institution_id),
CONSTRAINT chk_institution_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
INDEX idx_institution_name (name),
INDEX idx_institution_country (country)
) ENGINE = InnoDB;
CREATE TABLE author (
author_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
full_name VARCHAR(255) NOT NULL,
orcid VARCHAR(19) NULL,
email VARCHAR(320) NULL,
PRIMARY KEY (author_id),
UNIQUE KEY uq_author_orcid (orcid),
CONSTRAINT chk_author_name_not_blank CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
INDEX idx_author_name (full_name)
) ENGINE = InnoDB;
CREATE TABLE dataset (
dataset_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
name VARCHAR(255) NOT NULL,
description TEXT NULL,
source_url VARCHAR(2048) NULL,
PRIMARY KEY (dataset_id),
CONSTRAINT chk_dataset_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
INDEX idx_dataset_name (name)
) ENGINE = InnoDB;
CREATE TABLE method (
method_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
name VARCHAR(255) NOT NULL,
description TEXT NULL,
PRIMARY KEY (method_id),
CONSTRAINT chk_method_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
INDEX idx_method_name (name)
) ENGINE = InnoDB;
CREATE TABLE keyword (
keyword_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
keyword VARCHAR(255) NOT NULL,
PRIMARY KEY (keyword_id),
UNIQUE KEY uq_keyword (keyword),
FULLTEXT KEY ft_keyword_search (keyword)
) ENGINE = InnoDB;
CREATE TABLE paper (
paper_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
title VARCHAR(1000) NOT NULL,
abstract TEXT NOT NULL,
doi VARCHAR(255) NULL,
publication_year SMALLINT UNSIGNED NOT NULL,
paper_type VARCHAR(50) NOT NULL,
url VARCHAR(2048) NULL,
venue_id BIGINT UNSIGNED NULL,
PRIMARY KEY (paper_id),
UNIQUE KEY uq_paper_doi (doi),
CONSTRAINT fk_paper_venue
FOREIGN KEY (venue_id) REFERENCES venue (venue_id)
ON UPDATE CASCADE
ON DELETE SET NULL,
CONSTRAINT chk_paper_title_not_blank CHECK (CHAR_LENGTH(TRIM(title)) > 0),
CONSTRAINT chk_paper_year CHECK (publication_year BETWEEN 1000 AND 2100),
CONSTRAINT chk_paper_type_not_blank CHECK (CHAR_LENGTH(TRIM(paper_type)) > 0),
INDEX idx_paper_venue (venue_id),
INDEX idx_paper_publication_year (publication_year),
FULLTEXT KEY ft_paper_search (title, abstract)
) ENGINE = InnoDB;
-- Relationship tables
CREATE TABLE authorship (
paper_id BIGINT UNSIGNED NOT NULL,
author_id BIGINT UNSIGNED NOT NULL,
author_order SMALLINT UNSIGNED NOT NULL,
is_corresponding BOOLEAN NOT NULL DEFAULT FALSE,
PRIMARY KEY (paper_id, author_id),
UNIQUE KEY uq_authorship_order (paper_id, author_order),
CONSTRAINT fk_authorship_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_authorship_author
FOREIGN KEY (author_id) REFERENCES author (author_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT chk_authorship_order CHECK (author_order >= 1),
INDEX idx_authorship_author (author_id)
) ENGINE = InnoDB;
CREATE TABLE author_institution (
author_id BIGINT UNSIGNED NOT NULL,
institution_id BIGINT UNSIGNED NOT NULL,
start_year SMALLINT UNSIGNED NOT NULL,
end_year SMALLINT UNSIGNED NULL,
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
),
INDEX idx_author_institution_institution (institution_id)
) ENGINE = InnoDB;
CREATE TABLE paper_dataset (
paper_id BIGINT UNSIGNED NOT NULL,
dataset_id BIGINT UNSIGNED NOT NULL,
PRIMARY KEY (paper_id, dataset_id),
CONSTRAINT fk_paper_dataset_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_dataset_dataset
FOREIGN KEY (dataset_id) REFERENCES dataset (dataset_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
INDEX idx_paper_dataset_dataset (dataset_id)
) ENGINE = InnoDB;
CREATE TABLE paper_method (
paper_id BIGINT UNSIGNED NOT NULL,
method_id BIGINT UNSIGNED NOT NULL,
PRIMARY KEY (paper_id, method_id),
CONSTRAINT fk_paper_method_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_method_method
FOREIGN KEY (method_id) REFERENCES method (method_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
INDEX idx_paper_method_method (method_id)
) ENGINE = InnoDB;
CREATE TABLE paper_keyword (
paper_id BIGINT UNSIGNED NOT NULL,
keyword_id BIGINT UNSIGNED NOT NULL,
PRIMARY KEY (paper_id, keyword_id),
CONSTRAINT fk_paper_keyword_paper
FOREIGN KEY (paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_paper_keyword_keyword
FOREIGN KEY (keyword_id) REFERENCES keyword (keyword_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
INDEX idx_paper_keyword_keyword (keyword_id)
) ENGINE = InnoDB;
CREATE TABLE citation (
citing_paper_id BIGINT UNSIGNED NOT NULL,
cited_paper_id BIGINT UNSIGNED NOT NULL,
PRIMARY KEY (citing_paper_id, cited_paper_id),
CONSTRAINT fk_citation_citing_paper
FOREIGN KEY (citing_paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT fk_citation_cited_paper
FOREIGN KEY (cited_paper_id) REFERENCES paper (paper_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
INDEX idx_citation_cited_paper (cited_paper_id)
) ENGINE = InnoDB;
-- Use triggers for the self-citation rule alongside cascading foreign keys.
-- Triggers preserve the self-citation rule while retaining cascade behavior.
DELIMITER $$
CREATE TRIGGER trg_citation_no_self_before_insert
BEFORE INSERT ON citation
FOR EACH ROW
BEGIN
IF NEW.citing_paper_id = NEW.cited_paper_id THEN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A paper cannot cite itself';
END IF;
END$$
CREATE TRIGGER trg_citation_no_self_before_update
BEFORE UPDATE ON citation
FOR EACH ROW
BEGIN
IF NEW.citing_paper_id = NEW.cited_paper_id THEN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A paper cannot cite itself';
END IF;
END$$
DELIMITER ;

CREATE VIEW paper_citation_count AS
SELECT p.paper_id, p.title, COUNT(c.citing_paper_id) AS citation_count
FROM paper p LEFT JOIN citation c ON c.cited_paper_id=p.paper_id
GROUP BY p.paper_id,p.title;
