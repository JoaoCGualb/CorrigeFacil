import {db,currentUser,originCheck,reply,cookie,random,hash,passwordHash,equal,rateLimit,endSession} from '../../lib/auth';
export async function GET(req:Request){return reply({user:await currentUser(req)});}
export async function POST(req:Request){try{
originCheck(req);if(Number(req.headers.get('content-length')||0)>10000)return reply({error:'Solicitação muito grande.'},413);
const raw=await req.text();if(raw.length>10000)return reply({error:'Solicitação muito grande.'},413);
const body=JSON.parse(raw) as Record<string,string>;
if(body.action==='logout'){await endSession(req);return reply({ok:true},200,{'Set-Cookie':cookie(req,'',0)});}
const email=String(body.email||'').trim().toLowerCase();const password=String(body.password||'');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Informe um e-mail válido.');
if(password.length<12||password.length>128)throw new Error('A senha deve ter entre 12 e 128 caracteres.');
await rateLimit(req,email);
let user=await db().prepare('SELECT * FROM users WHERE email = ?').bind(email).first<{id:string,email:string,name:string,password:string,recovery:string}>();
let recoveryCode:string|undefined;
if(body.action==='register'){
if(user)throw new Error('Não foi possível cadastrar este e-mail. Tente entrar ou recuperar sua conta.');
const name=String(body.name||'').trim();if(!name||name.length>100)throw new Error('Informe seu nome (até 100 caracteres).');
recoveryCode=random();user={id:crypto.randomUUID(),name,email,password:await passwordHash(password),recovery:await hash(recoveryCode)};
await db().prepare('INSERT INTO users (id,email,name,password,recovery,created) VALUES (?,?,?,?,?,?)').bind(user.id,email,name,user.password,user.recovery,Date.now()).run();
}else if(body.action==='recover'){
if(!user||!equal(await hash(String(body.recovery||'').trim()),user.recovery))throw new Error('E-mail ou código de recuperação inválido.');
const access=await db().prepare('SELECT active FROM memberships WHERE user_id = ?').bind(user.id).first<{active:number}>();
if(access&&!access.active)throw new Error('Seu acesso foi suspenso. Contate a equipe de suporte.');
recoveryCode=random();const next=await passwordHash(password);
const result=await db().prepare('UPDATE users SET password = ?, recovery = ? WHERE id = ? AND recovery = ? RETURNING id').bind(next,await hash(recoveryCode),user.id,user.recovery).first();
if(!result)throw new Error('Código de recuperação já utilizado.');
await db().prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
}else if(body.action==='login'){
const candidate=await passwordHash(password,user?.password.split(':')[0]||'dummy-salt-for-invalid-user');
if(!user||!equal(candidate,user.password))throw new Error('E-mail ou senha inválidos.');
}else throw new Error('Operação inválida.');
const membership=await db().prepare('SELECT owner, active FROM memberships WHERE user_id = ?').bind(user.id).first<{owner:string,active:number}>();
if(membership&&!membership.active)throw new Error('Seu acesso à equipe foi suspenso. Entre em contato com a coordenação.');
const token=random();await db().prepare('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)').bind(await hash(token),user.id,Date.now()+604800000).run();
await db().prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run();
return reply({user:{id:user.id,name:user.name,email:user.email,owner:membership?.owner||user.id,role:membership?'teacher':'coordinator'},recoveryCode},200,{'Set-Cookie':cookie(req,token)});
}catch(e){return reply({error:e instanceof Error?e.message:'Não foi possível entrar.'},400);}}
