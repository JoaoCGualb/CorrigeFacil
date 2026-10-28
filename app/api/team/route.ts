import {db,currentUser,originCheck,reply,random,hash} from '../../lib/auth';
export async function GET(req:Request){const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);if(user.role!=='coordinator')return reply({error:'Somente a coordenação pode gerenciar a equipe.'},403);
const members=await db().prepare('SELECT users.id, users.name, users.email, memberships.active FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.owner = ?').bind(user.owner).all();
const invites=await db().prepare('SELECT id,email,expires,used FROM invitations WHERE owner = ? ORDER BY expires DESC').bind(user.owner).all();
return reply({members:members.results,invites:invites.results});}
export async function POST(req:Request){try{
originCheck(req);const user=await currentUser(req);if(!user)return reply({error:'Entre novamente.'},401);
const raw=await req.text();if(raw.length>20000)throw new Error('Solicitação muito grande.');const body=JSON.parse(raw);
if(body.action==='join'){
const code=String(body.code||'');if(!/^[a-f0-9]{64}$/.test(code))throw new Error('Convite inválido.');
const invite=await db().prepare('SELECT id,owner,email FROM invitations WHERE token = ? AND used = 0 AND expires > ?').bind(await hash(code),Date.now()).first<{id:string,owner:string,email:string}>();
if(!invite||invite.email!==user.email)throw new Error('Convite inválido, expirado ou destinado a outro e-mail.');
const membership=await db().prepare('SELECT owner FROM memberships WHERE user_id = ?').bind(user.id).first();
if(membership)throw new Error('Sua conta já faz parte de uma equipe.');
if(invite.owner===user.id)throw new Error('Você já coordena esta equipe.');
const existing=await db().prepare('SELECT id FROM records WHERE owner = ? LIMIT 1').bind(user.id).first();
const staff=await db().prepare('SELECT user_id FROM memberships WHERE owner = ? LIMIT 1').bind(user.id).first();
if(existing||staff)throw new Error('Esta conta já possui um espaço com dados. Utilize um e-mail de professor sem espaço próprio.');
const result=await db().batch([
db().prepare("INSERT INTO memberships (user_id,owner,active) SELECT ?,owner,1 FROM invitations WHERE id = ? AND used = 0 AND expires > ?").bind(user.id,invite.id,Date.now()),
db().prepare('UPDATE invitations SET used = 1 WHERE id = ? AND used = 0').bind(invite.id)]);
if(!result[0].meta.changes)throw new Error('Convite já utilizado.');return reply({ok:true});
}
if(user.role!=='coordinator')return reply({error:'Somente a coordenação pode gerenciar a equipe.'},403);
if(body.action==='invite'){
const email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===user.email)throw new Error('Informe o e-mail do professor.');
const pending=await db().prepare('SELECT COUNT(*) as n FROM invitations WHERE owner = ? AND used = 0 AND expires > ?').bind(user.owner,Date.now()).first<{n:number}>();if((pending?.n||0)>=100)throw new Error('Limite de 100 convites pendentes.');
const code=random(),id=crypto.randomUUID(),expires=Date.now()+604800000;
await db().prepare('INSERT INTO invitations (id,owner,email,token,expires,used) VALUES (?,?,?,?,?,0)').bind(id,user.owner,email,await hash(code),expires).run();
return reply({url:new URL('/?invite='+code,req.url).href,expires});
}
if(body.action==='revoke'){await db().prepare('UPDATE invitations SET used = 2 WHERE id = ? AND owner = ? AND used = 0').bind(body.id,user.owner).run();return reply({ok:true});}
const member=await db().prepare('SELECT user_id FROM memberships WHERE user_id = ? AND owner = ?').bind(body.userId,user.owner).first();if(!member)throw new Error('Professor não encontrado nesta equipe.');
if(body.action==='status'){
if(typeof body.active!=='boolean')throw new Error('Situação inválida.');
const changes=[db().prepare('UPDATE memberships SET active = ? WHERE user_id = ? AND owner = ?').bind(body.active?1:0,body.userId,user.owner)];
if(!body.active)changes.push(db().prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.userId));
await db().batch(changes);return reply({ok:true});
}
if(body.action==='assign'){
if(!Array.isArray(body.classIds)||body.classIds.length>100)throw new Error('Turmas inválidas.');
const all=await db().prepare("SELECT id,data,version FROM records WHERE owner = ? AND kind = 'class'").bind(user.owner).all<{id:string,data:string,version:number}>();
if(body.classIds.some((id:string)=>!all.results.some(r=>r.id===id)))throw new Error('Turma não pertence à sua equipe.');
const stmts=all.results.map(r=>{const data=JSON.parse(r.data);const ids=(data.teacherIds||[]).filter((id:string)=>id!==body.userId);if(body.classIds.includes(r.id))ids.push(body.userId);return db().prepare("UPDATE records SET data = json_set(data, '$.teacherIds', json(?)), version = version + 1, updated = ? WHERE id = ? AND owner = ?").bind(JSON.stringify(ids),Date.now(),r.id,user.owner);});
if(stmts.length)await db().batch(stmts);return reply({ok:true});
}
throw new Error('Operação inválida.');
}catch(e){return reply({error:e instanceof Error?e.message:'Não foi possível atualizar a equipe.'},400);}}
