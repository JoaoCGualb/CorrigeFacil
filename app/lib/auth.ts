import { env } from 'cloudflare:workers';
export const db=()=> (env as unknown as {DB:D1Database}).DB;
export const bucket=()=> (env as unknown as {BUCKET:R2Bucket}).BUCKET;
const enc=new TextEncoder();
export function random(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password:string,salt=random()){
const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:enc.encode(salt)},key,256);
return salt+':'+[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function equal(a:string,b:string){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;}
export function originCheck(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)throw new Error('Origem da solicitação inválida.');}
export function reply(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
export function cookie(req:Request,token:string,age=604800){const secure=new URL(req.url).protocol==='https:';return `${secure?'__Host-':''}cf_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;}
function tokenFrom(req:Request){const secure=new URL(req.url).protocol==='https:';return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${secure?'__Host-':''}cf_session=`))?.split('=')[1];}
export type AppUser={id:string,name:string,email:string,owner:string,role:'coordinator'|'teacher'};
export async function currentUser(req:Request){const token=tokenFrom(req);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return await db().prepare("SELECT users.id, users.name, users.email, COALESCE(m.owner,users.id) as owner, CASE WHEN m.user_id IS NULL THEN 'coordinator' ELSE 'teacher' END as role FROM sessions JOIN users ON users.id = sessions.user_id LEFT JOIN memberships m ON m.user_id = users.id WHERE sessions.token = ? AND sessions.expires > ? AND COALESCE(m.active,1) = 1").bind(await hash(token),Date.now()).first<AppUser>();}
export async function endSession(req:Request){const token=tokenFrom(req);if(token)await db().prepare('DELETE FROM sessions WHERE token = ?').bind(await hash(token)).run();}
export async function rateLimit(req:Request,email:string){
const now=Date.now();const ip=req.headers.get('cf-connecting-ip')||'local';
for(const value of ['ip:'+ip,'email:'+email]){
const key=await hash(value);
const r=await db().prepare('INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires < ? THEN 1 ELSE count + 1 END, expires = CASE WHEN expires < ? THEN ? ELSE expires END RETURNING count').bind(key,now+900000,now,now,now+900000).first<{count:number}>();
if((r?.count||0)>(value.startsWith('ip:')?40:10))throw new Error('Muitas tentativas. Aguarde 15 minutos.');
}}
