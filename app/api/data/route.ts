import {canClass} from '../../lib/access';
import {env} from 'cloudflare:workers';
import {db,currentUser,originCheck,reply} from '../../lib/auth';
import {grade,type Exam,type Submission,type Row} from '../../lib/model';
const parse=(r:any):Row=>({...r,data:JSON.parse(r.data)});
async function owned(owner:string,id:string,kind?:string){const row=await db().prepare('SELECT id,kind,data,version,updated FROM records WHERE owner = ? AND id = ?').bind(owner,id).first();if(!row||kind&&row.kind!==kind)throw new Error('Registro não encontrado.');return parse(row);}
function str(x:unknown,max=500,required=true){if(typeof x!=='string'||x.length>max||required&&!x.trim())throw new Error('Campo obrigatório inválido.');return x.trim();}
export async function GET(req:Request){const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);const rows=await db().prepare('SELECT id,kind,data,version,updated FROM records WHERE owner = ? ORDER BY updated DESC').bind(user.owner).all();let visible=rows.results.map(parse);
if(user.role==='teacher'){const ids=new Set(visible.filter(r=>r.kind==='class'&&r.data.teacherIds?.includes(user.id)).map(r=>r.id));visible=visible.filter(r=>r.kind==='class'?ids.has(r.id):r.kind==='exam'?r.data.classIds.some((id:string)=>ids.has(id)):r.kind==='submission'||r.kind==='file'?ids.has(r.data.classId):false);}
return reply({rows:visible,now:Date.now(),aiEnabled:!!(env as unknown as {OPENAI_API_KEY?:string}).OPENAI_API_KEY});}
export async function POST(req:Request){try{
originCheck(req);const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);
const raw=await req.text();if(raw.length>600000)return reply({error:'Envio muito grande.'},413);
const body=JSON.parse(raw);const {kind}=body;if(user.role==='teacher'&&kind!=='submission')return reply({error:'A coordenação gerencia turmas e avaliações.'},403);if(!['class','exam','submission'].includes(kind))throw new Error('Operação inválida.');
const old=body.id?await owned(user.owner,str(body.id,100),kind):null;
if(old&&old.version!==body.version)return reply({error:'Este registro foi atualizado em outra janela. Atualize antes de salvar.'},409);
const d=body.data;let data:any;
if(kind==='class'){
const name=str(d.name,100);if(!Array.isArray(d.students)||d.students.length>500)throw new Error('Limite de 500 alunos por turma.');
const seen=new Set();const students=d.students.map((s:any)=>{const id=str(s.id,100);if(seen.has(id))throw new Error('Aluno duplicado.');seen.add(id);return {id,name:str(s.name,150),number:str(s.number||'',30,false)};});
if(old&&old.data.students.some((s:any)=>!seen.has(s.id)))throw new Error('Não remova alunos já cadastrados nesta versão.');
data={name,students,teacherIds:old?.data.teacherIds||[]};
}else if(kind==='exam'){
if(!Array.isArray(d.classIds)||!d.classIds.length||d.classIds.length>50)throw new Error('Selecione ao menos uma turma.');
for(const id of d.classIds)await owned(user.owner,str(id,100),'class');
if(!Array.isArray(d.questions)||!d.questions.length||d.questions.length>200)throw new Error('A prova deve ter de 1 a 200 questões.');
const ids=new Set();const questions=d.questions.map((q:any)=>{const id=str(q.id,100);if(ids.has(id))throw new Error('Questão duplicada.');ids.add(id);
if(!['choice','text'].includes(q.type)||typeof q.points!=='number'||!Number.isFinite(q.points)||q.points<=0||q.points>1000)throw new Error('Tipo ou valor de questão inválido.');
const key=str(q.key,10000);if(q.type==='choice'&&!/^[A-E]$/.test(key))throw new Error('Selecione a alternativa correta (A a E).');
return {id,type:q.type,key,points:q.points,rubric:str(q.rubric||'',10000,false)};});
data={title:str(d.title,150),subject:str(d.subject||'',100,false),date:str(d.date||'',20,false),classIds:[...new Set(d.classIds)],questions};
}else{
const exam=await owned(user.owner,str(d.examId,100),'exam');const cls=await owned(user.owner,str(d.classId,100),'class');
if(!await canClass(user,cls.id))return reply({error:'Você não tem acesso a esta turma.'},403);
if(!exam.data.classIds.includes(cls.id)||!cls.data.students.some((s:any)=>s.id===d.studentId))throw new Error('Aluno ou turma não pertence à avaliação.');
if(old&&(old.data.examId!==d.examId||old.data.studentId!==d.studentId||old.data.classId!==d.classId))throw new Error('Não é possível trocar o aluno de uma correção existente.');
if(d.examVersion!==exam.version)return reply({error:'O gabarito mudou. Atualize antes de salvar.'},409);
if(!old){const duplicate=await db().prepare("SELECT id FROM records WHERE owner = ? AND identity = ?").bind(user.owner,JSON.stringify([exam.id,d.studentId])).first();if(duplicate)throw new Error('Este aluno já tem uma correção. Abra a existente.');}
const answers:Record<string,string>={},marks:Record<string,number>={},feedback:Record<string,string>={};
for(const q of exam.data.questions){answers[q.id]=str(d.answers?.[q.id]||'',20000,false);if(q.type==='choice'&&!/^[A-E]?$/.test(answers[q.id]))throw new Error('Resposta objetiva inválida.');
feedback[q.id]=str(d.feedback?.[q.id]||'',5000,false);
if(d.marks?.[q.id]!==undefined&&d.marks[q.id]!==null){const mark=d.marks[q.id];if(typeof mark!=='number'||!Number.isFinite(mark)||mark<0||mark>q.points)throw new Error('Nota fora do intervalo da questão.');marks[q.id]=mark;}
}
if(!Array.isArray(d.files)||d.files.length>30)throw new Error('Limite de 30 arquivos por correção.');for(const id of d.files){const f=await owned(user.owner,str(id,100),'file');if(f.data.examId!==exam.id||f.data.classId&&f.data.classId!==cls.id)throw new Error('Arquivo pertence a outra avaliação.');}
data={examId:exam.id,classId:cls.id,studentId:d.studentId,answers,marks,feedback,files:[...new Set(d.files)],confirmed:d.confirmed===true,examVersion:exam.version,createdBy:old?.data.createdBy||user.id,updatedBy:user.id,reviewerName:user.name};
if(data.confirmed&&!grade(exam.data as Exam,data as Submission,exam.version).complete)throw new Error('Dê uma nota para todas as questões escritas antes de confirmar.');
}
const id=old?.id||crypto.randomUUID();const now=Date.now();
if(old){const result=await db().prepare('UPDATE records SET data = ?, version = version + 1, updated = ? WHERE id = ? AND owner = ? AND version = ? RETURNING id').bind(JSON.stringify(data),now,id,user.owner,old.version).first();if(!result)return reply({error:'Conflito de edição. Atualize e tente novamente.'},409);}
else await db().prepare('INSERT INTO records (id,owner,kind,identity,data,version,updated) VALUES (?,?,?,?,?,1,?)').bind(id,user.owner,kind,kind==='submission'?JSON.stringify([data.examId,data.studentId]):null,JSON.stringify(data),now).run();
return reply({id,version:(old?.version||0)+1});
}catch(e){return reply({error:e instanceof Error?e.message:'Não foi possível salvar.'},400);}}
