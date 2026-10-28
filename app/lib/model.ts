export type Question={id:string,type:'choice'|'text',key:string,points:number,rubric:string};
export type Exam={title:string,subject:string,date:string,classIds:string[],questions:Question[]};
export type Student={id:string,name:string,number:string};
export type SchoolClass={name:string,students:Student[]};
export type Submission={examId:string,classId:string,studentId:string,answers:Record<string,string>,marks:Record<string,number>,feedback:Record<string,string>,files:string[],confirmed:boolean,examVersion:number};
export type Row={id:string,kind:string,data:any,version:number,updated:number};
export function grade(exam:Exam,submission:Submission,version:number){
let points=0;let max=0;let complete=true;
const questions=exam.questions.map(q=>{
max+=q.points;const answer=String(submission.answers[q.id]||'').trim();let score:number|null=null;
if(q.type==='choice')score=answer.toUpperCase()===q.key.toUpperCase()?q.points:0;
else{const mark=submission.marks[q.id];if(typeof mark==='number'&&Number.isFinite(mark)&&mark>=0&&mark<=q.points)score=mark;else complete=false;}
points+=score||0;return {id:q.id,score,max:q.points,answer};
});
return {points,max,percent:max?points/max*100:0,confirmed:submission.confirmed&&submission.examVersion===version&&complete,complete,questions};
}
export function csvParse(text:string){const first=text.split(/\r?\n/)[0]||'';const sep=first.includes(';')?';':first.includes('\t')?'\t':',';const rows:string[][]=[];let row:string[]=[],cell='',quote=false;
for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===sep&&!quote){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
if(quote)throw new Error('CSV com aspas não fechadas.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;}
