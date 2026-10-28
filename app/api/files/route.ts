import {canClass,canExam} from '../../lib/access';
import {db,bucket,currentUser,originCheck,reply} from '../../lib/auth';
export async function POST(req:Request){try{
originCheck(req);const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);
if(Number(req.headers.get('content-length')||0)>16000000)throw new Error('Cada arquivo pode ter até 15 MB.');
const form=await req.formData();const file=form.get('file');const examId=String(form.get('examId')||'');const classId=String(form.get('classId')||'');
if(!await canClass(user,classId)||!await canExam(user,examId))return reply({error:'Sem acesso à turma ou avaliação.'},403);
if(!(file instanceof File)||file.size>15000000||file.size===0)throw new Error('Envie um arquivo de até 15 MB.');
if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Formatos aceitos: JPG, PNG, WebP e PDF.');
const exam=await db().prepare("SELECT data FROM records WHERE id = ? AND owner = ? AND kind = 'exam'").bind(examId,user.owner).first<{data:string}>();if(!exam)throw new Error('Avaliação não encontrada.');
if(!JSON.parse(exam.data).classIds.includes(classId))throw new Error('A turma não pertence a esta avaliação.');
const count=await db().prepare("SELECT COUNT(*) AS n FROM records WHERE owner = ? AND kind = 'file'").bind(user.owner).first<{n:number}>();if((count?.n||0)>=2000)throw new Error('Limite de 2.000 arquivos por conta nesta versão.');
const bytes=new Uint8Array(await file.arrayBuffer());const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70;const jpg=bytes[0]===255&&bytes[1]===216;const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
if(!(file.type==='application/pdf'&&pdf||file.type==='image/jpeg'&&jpg||file.type==='image/png'&&png||file.type==='image/webp'&&webp))throw new Error('O conteúdo não corresponde ao formato informado.');
const id=crypto.randomUUID(),key=user.id+'/'+id;await bucket().put(key,bytes,{httpMetadata:{contentType:file.type}});
try{await db().prepare("INSERT INTO records (id,owner,kind,data,version,updated) VALUES (?,?,'file',?,1,?)").bind(id,user.owner,JSON.stringify({name:file.name.slice(0,200),type:file.type,size:file.size,key,examId,classId,uploadedBy:user.id}),Date.now()).run();}catch(e){await bucket().delete(key);throw e;}
return reply({id,name:file.name,type:file.type});
}catch(e){return reply({error:e instanceof Error?e.message:'Falha no envio.'},400);}}
export async function GET(req:Request){const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);const id=new URL(req.url).searchParams.get('id');
const record=await db().prepare("SELECT data FROM records WHERE id = ? AND owner = ? AND kind = 'file'").bind(id,user.owner).first<{data:string}>();if(!record)return reply({error:'Arquivo não encontrado.'},404);
const data=JSON.parse(record.data);if(user.role==='teacher'&&!await canClass(user,data.classId||''))return reply({error:'Sem acesso ao arquivo.'},403);const obj=await bucket().get(data.key);if(!obj)return reply({error:'Arquivo não encontrado.'},404);
return new Response(obj.body,{headers:{'Content-Type':data.type,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(data.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
