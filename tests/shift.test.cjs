const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../games/shift.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI state')[0];
const context=vm.createContext({});vm.runInContext(source+';this.rules={moves,push,winningLines,outcome};',context);
const {moves,push,winningLines,outcome}=context.rules;
test('wall allows perimeter neutral/own pieces; corners have two and other edges three directions',()=>{
 const b=Array(25).fill(0);const all=moves(b,1,'wall');
 assert.equal(new Set(all.map(m=>m.from)).size,16);
 assert.equal(all.filter(m=>m.from===0).length,2);assert.equal(all.filter(m=>m.from===2).length,3);
 b[0]=2;b[1]=1;assert.equal(moves(b,1).some(m=>m.from===0),false);assert.equal(moves(b,1).some(m=>m.from===1),true);
});
test('free allows interior neutral pieces but no colored or master pieces',()=>{
 const b=Array(25).fill(0);assert.equal(moves(b,1,'free').filter(m=>m.from===12).length,4);
 for(const value of [1,2,3]){b[12]=value;assert.equal(moves(b,1,'free').some(m=>m.from===12),false);}
});
test('a push shifts the complete segment by one and leaves the source board intact',()=>{
 const b=Array(25).fill(0);b.splice(0,5,0,2,1,2,0);const m=moves(b,1).find(m=>m.from===0&&m.to===4);
 const n=push(b,1,m);assert.deepEqual(Array.from(n.slice(0,5)),[2,1,2,0,1]);assert.deepEqual(b.slice(0,5),[0,2,1,2,0]);
 assert.equal(moves(b,1).some(m=>m.from===m.to),false);
});
test('master cannot be removed but moves with a pushed column, retaining its identity',()=>{
 const b=Array(25).fill(0);b[12]=3;
 for(const type of ['wall','free']){
  assert.equal(moves(b,1,type).some(m=>m.from===12),false);
  const m=moves(b,1,type).find(m=>m.from===2&&m.to===22),n=push(b,1,m);
  assert.equal(n[7],3);assert.equal(n.filter(v=>v===3).length,1);
 }
});
test('a single master supports either color and all horizontal/vertical/diagonal wins',()=>{
 for(const p of [1,2])for(const line of [[0,1,2,3,4],[0,5,10,15,20],[0,6,12,18,24],[4,8,12,16,20]]){
  const b=Array(25).fill(0);line.forEach(i=>b[i]=p);b[line[2]]=3;assert.equal(outcome(b,3-p).win,p);assert.equal(winningLines(b,p).length,1);
 }
});
test('completing the opponent line awards that opponent and simultaneous lines draw',()=>{
 const b=Array(25).fill(0);for(let i=0;i<5;i++)b[i]=2;assert.equal(outcome(b,2).win,2);
 for(let i=20;i<25;i++)b[i]=1;assert.equal(outcome(b,2).win,0);
});
test('no selectable neutral piece in free type is a draw without a completed line',()=>{
 const b=Array.from({length:25},(_,i)=>(Math.floor(i/5)+2*(i%5))%4<2?1:2);
 assert.equal(winningLines(b,1).length,0);assert.equal(winningLines(b,2).length,0);
 assert.equal(outcome(b,1,'free').win,0);
});
