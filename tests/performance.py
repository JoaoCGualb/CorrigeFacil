"""Isolated SQLite benchmark; no production data/network. python tests/performance.py"""
import json, math, platform, sqlite3, statistics, tempfile, time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.sites-runtime'/'performance-results.json'
def measure(db,sql,args,repeats):
    db.execute(sql,args).fetchall() # explicit warm-up
    values=[]
    for _ in range(repeats):
        start=time.perf_counter_ns(); db.execute(sql,args).fetchall()
        values.append((time.perf_counter_ns()-start)/1e6)
    return {'median_ms':statistics.median(values),'p95_ms':sorted(values)[math.ceil(.95*len(values))-1], 'repeats':repeats}

results=[]
OUT.parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='corrigefacil-perf-',dir=OUT.parent.resolve()) as folder:
    for n in [100,1000,100000,1000000]:
        db=sqlite3.connect(str(Path(folder)/f'{n}.sqlite'))
        for file in sorted((ROOT/'drizzle').glob('*.sql')):
            if file.name.startswith('0003_'):continue
            db.executescript(file.read_text(encoding='utf-8'))
        db.execute("INSERT INTO users VALUES ('owner','synthetic@example.test','Synthetic','unused','unused',0)")
        start=time.perf_counter()
        def rows():
            for i in range(n):
                data={'examId':f'e{i//1000}','classId':f'c{i//100}', 'studentId':f's{i:010d}',
                      'answers':{'q1':'A','q2':'Synthetic answer '*40},'marks':{'q2':5},'feedback':{},'files':[], 'confirmed':True,'examVersion':1}
                yield(f'r{i:010d}','owner','submission',json.dumps([data['examId'],data['studentId']],separators=(',',':')),json.dumps(data,separators=(',',':')),1,i)
        db.executemany('INSERT INTO records (id,owner,kind,identity,data,version,updated) VALUES (?,?,?,?,?,?,?)',rows());db.commit()
        inserted=time.perf_counter()-start
        lookup="SELECT id,kind,data,version,updated FROM records WHERE owner=? AND kind='submission' AND json_extract(data, '$.studentId')=? AND id>? ORDER BY id LIMIT ?"
        args=('owner',f's{n-1:010d}','',26)
        baseline=db.execute(lookup,args).fetchall();assert len(baseline)==1
        old_plan=db.execute('EXPLAIN QUERY PLAN '+lookup,args).fetchall()
        before=measure(db,lookup,args,7)
        size_before=Path(folder,f'{n}.sqlite').stat().st_size
        start=time.perf_counter()
        db.executescript((ROOT/'drizzle'/'0003_empty_energizer.sql').read_text(encoding='utf-8'))
        index_seconds=time.perf_counter()-start
        new_plan=db.execute('EXPLAIN QUERY PLAN '+lookup,args).fetchall()
        assert any('records_student_lookup' in row[3] for row in new_plan),new_plan
        assert db.execute(lookup,args).fetchall()==baseline
        assert not db.execute(lookup,('another-owner',args[1],'',26)).fetchall()
        after=measure(db,lookup,args,101)
        # Full JSON-field aggregation: still must examine every result.
        scan=measure(db,"SELECT SUM(CASE WHEN json_extract(data,'$.confirmed')=1 THEN 1 ELSE 0 END) FROM records WHERE owner=? AND kind='submission'",('owner',),7)
        result={'records':n,'insert_seconds':inserted,'before':before,'indexed':after,'full_aggregation':scan,'index_build_seconds':index_seconds,'database_before_bytes':size_before,'database_after_bytes':Path(folder,f'{n}.sqlite').stat().st_size,'plan_before':old_plan,'plan_after':new_plan}
        results.append(result); print(json.dumps(result),flush=True);db.close()
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({'sqlite':sqlite3.sqlite_version,'python':platform.python_version(),'os':platform.platform(),'method':'Single connection, synthetic ~1KB JSON, one result/student, warm caches, no network or API; baseline includes existing production indexes.','results':results,'billion_tested':False},indent=2),encoding='utf-8')
