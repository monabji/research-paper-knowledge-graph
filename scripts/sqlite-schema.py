import re,pathlib
sql=pathlib.Path('database/mysql-schema.sql').read_text()
output=['PRAGMA foreign_keys=ON;']
indexes=[]
for table,body in re.findall(r'CREATE TABLE (\w+) \((.*?)\) ENGINE = InnoDB;',sql,re.S):
    auto=re.search(r'(\w+) BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',body)
    if auto:
        key=auto.group(1)
        body=re.sub(rf'{key} BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',f'{key} INTEGER PRIMARY KEY AUTOINCREMENT',body)
        body=re.sub(rf'PRIMARY KEY \({key}\),?','',body)
    for name,cols in re.findall(r'INDEX (\w+) \((.*?)\)',body):
        indexes.append(f'CREATE INDEX {name} ON {table} ({cols});')
    body=re.sub(r'FULLTEXT KEY \w+ \(.*?\),?','',body)
    body=re.sub(r'INDEX \w+ \(.*?\),?','',body)
    body=re.sub(r'UNIQUE KEY \w+', 'UNIQUE',body)
    body=re.sub(r'BIGINT UNSIGNED|SMALLINT UNSIGNED|BOOLEAN','INTEGER',body)
    body=body.replace('CHAR_LENGTH','LENGTH')
    body=re.sub(r',\s*$', '',body.strip())
    output.append(f'CREATE TABLE {table} ({body});')
output+=indexes
output.append('''CREATE TRIGGER citation_no_self_insert BEFORE INSERT ON citation WHEN NEW.citing_paper_id=NEW.cited_paper_id BEGIN SELECT RAISE(ABORT, 'A paper cannot cite itself'); END;
CREATE TRIGGER citation_no_self_update BEFORE UPDATE ON citation WHEN NEW.citing_paper_id=NEW.cited_paper_id BEGIN SELECT RAISE(ABORT, 'A paper cannot cite itself'); END;
CREATE VIRTUAL TABLE paper_search USING fts5(title, abstract, content='paper', content_rowid='paper_id');
CREATE TRIGGER paper_search_insert AFTER INSERT ON paper BEGIN INSERT INTO paper_search(rowid,title,abstract) VALUES(new.paper_id,new.title,new.abstract); END;
CREATE TRIGGER paper_search_delete AFTER DELETE ON paper BEGIN INSERT INTO paper_search(paper_search,rowid,title,abstract) VALUES('delete',old.paper_id,old.title,old.abstract); END;
CREATE TRIGGER paper_search_update AFTER UPDATE ON paper BEGIN INSERT INTO paper_search(paper_search,rowid,title,abstract) VALUES('delete',old.paper_id,old.title,old.abstract); INSERT INTO paper_search(rowid,title,abstract) VALUES(new.paper_id,new.title,new.abstract); END;
CREATE VIEW paper_citation_count AS SELECT p.paper_id,p.title,COUNT(c.citing_paper_id) AS citation_count FROM paper p LEFT JOIN citation c ON c.cited_paper_id=p.paper_id GROUP BY p.paper_id,p.title;''')
pathlib.Path('database/sqlite-schema.sql').write_text('\n'.join(output))
