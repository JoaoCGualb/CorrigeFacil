import {db,type AppUser} from './auth';
export async function canClass(user:AppUser,classId:string){
const row=await db().prepare("SELECT data FROM records WHERE owner = ? AND id = ? AND kind = 'class'").bind(user.owner,classId).first<{data:string}>();
return !!row&&(user.role==='coordinator'||JSON.parse(row.data).teacherIds?.includes(user.id));
}
export async function canExam(user:AppUser,examId:string){
const row=await db().prepare("SELECT data FROM records WHERE owner = ? AND id = ? AND kind = 'exam'").bind(user.owner,examId).first<{data:string}>();if(!row)return false;
if(user.role==='coordinator')return true;
for(const id of JSON.parse(row.data).classIds)if(await canClass(user,id))return true;return false;
}
