"""Extract Appendix C from pdftotext -layout output, preserving wrapped SQL lines."""
import re, pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text()
text = text[text.index(' 1 -- ASSESSMENT 10 COMPLETE RUNNABLE SQL'):]
lines=[]
for line in text.splitlines():
    if re.match(r'^\s*\d+\s*$',line): continue
    match=re.match(r'^\s*(\d+)\s(.*)$',line)
    if match: lines.append(match.group(2).strip())
    elif line.strip(): lines.append(line.strip())
sql='\n'.join(lines).replace('’',"'").replace('‘',"'")
# Wrapped strings in the printed listing represent spaces, not embedded newlines.
sql=re.sub(r"'[^']*'",lambda m: re.sub(r'\s+', ' ', m.group()),sql)
schema,rest=sql.split('-- ==================== SAMPLE DATA ====================')
seed,queries=rest.split('-- ==================== DEMONSTRATION QUERIES ====================')
schema=re.sub(r'CREATE DATABASE IF NOT EXISTS.*?;', '',schema,flags=re.S)
schema=re.sub(r'USE \w+;', '',schema)
seed=re.sub(r'USE \w+;', '',seed)
queries=re.sub(r'USE \w+;', '',queries)
schema=schema.replace('-- MySQL 26.10 disallows CHECK constraints on columns used by cascading foreign keys.', '-- Use triggers for the self-citation rule alongside cascading foreign keys.')
schema+='\nCREATE VIEW paper_citation_count AS\nSELECT p.paper_id, p.title, COUNT(c.citing_paper_id) AS citation_count\nFROM paper p LEFT JOIN citation c ON c.cited_paper_id=p.paper_id\nGROUP BY p.paper_id,p.title;\n'
pathlib.Path('database/mysql-schema.sql').write_text(schema)
pathlib.Path('database/seed.sql').write_text(seed)
pathlib.Path('database/queries.sql').write_text(queries)
