import {currentUser,db,reply} from '../../lib/auth';

// Bounded student lookup. Class authorization is applied before pagination.
export async function GET(req:Request){
  const user=await currentUser(req);
  if(!user)return reply({error:'Entre novamente.'},401);
  const params=new URL(req.url).searchParams;
  const studentId=params.get('studentId')||'', after=params.get('after')||'';
  const limit=Number(params.get('limit')||25);
  if(!studentId.trim()||studentId.length>100||after.length>100||!Number.isInteger(limit)||limit<1||limit>100)
    return reply({error:'Informe o aluno e um limite entre 1 e 100.'},400);
  const access=user.role==='teacher'?` AND EXISTS (
    SELECT 1 FROM records c, json_each(c.data, '$.teacherIds') teacher
    WHERE c.owner=r.owner AND c.kind='class'
    AND c.id=json_extract(r.data, '$.classId') AND teacher.value=?
  )`:'';
  const values:(string|number)[]=[user.owner,studentId,after];
  if(user.role==='teacher')values.push(user.id);
  values.push(limit+1);
  const result=await db().prepare(`SELECT r.id,r.kind,r.data,r.version,r.updated FROM records r
    WHERE r.owner=? AND r.kind='submission' AND json_extract(r.data, '$.studentId')=?
    AND r.id>? ${access} ORDER BY r.id LIMIT ?`).bind(...values).all<{id:string,kind:string,data:string,version:number,updated:number}>();
  const rows=result.results.slice(0,limit).map(r=>({...r,data:JSON.parse(r.data)}));
  return reply({rows,nextCursor:result.results.length>limit?rows[rows.length-1].id:null});
}
