const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../games/shift.html'),'utf8');
const context=vm.createContext({});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI state')[0]+';this.rules={moves,push,outcome,chooseCpuMove};',context);
const {moves,push,outcome,chooseCpuMove}=context.rules;
function rng(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}}
const key=m=>m.from+':'+m.to;
test('CPU always selects legal moves in both types, with or without the master, without mutating the board',()=>{
 for(const type of ['wall','free'])for(const master of [false,true]){let b=Array(25).fill(0);if(master)b[12]=3;const random=rng(8);for(let turn=0;turn<18;turn++){const p=turn%2+1,before=b.slice(),legal=moves(b,p,type),move=chooseCpuMove(b,p,type,random);if(!legal.length){assert.equal(move,null);break}assert.ok(legal.some(m=>key(m)===key(move)));assert.deepEqual(b,before);if(master)assert.notEqual(b[move.from],3);b=push(b,p,move);if(outcome(b,3-p,type))break}}
});
test('CPU takes an immediate win in both careful and imperfect branches, including shared master lines',()=>{
 for(const type of ['wall','free'])for(const master of [false,true])for(const random of [()=>0,()=>.8]){const b=Array(25).fill(0);b.splice(0,5,0,2,2,2,2);if(master)b[2]=3;const move=chooseCpuMove(b,2,type,random);assert.equal(outcome(push(b,2,move),1,type).win,2)}
});
test('CPU avoids directly completing the human line when alternatives exist',()=>{
 const b=Array(25).fill(0);b.splice(0,5,0,1,1,1,1);b[9]=1;
 for(let seed=1;seed<=25;seed++){const move=chooseCpuMove(b,2,'wall',rng(seed));assert.notEqual(outcome(push(b,2,move),1,'wall')?.win,1)}
});
test('careful CPU blocks an immediate reply while the imperfect branch can overlook it',()=>{
 const b=[0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
 const canLose=m=>{const n=push(b,2,m);return !outcome(n,1,'wall')&&moves(n,1,'wall').some(reply=>outcome(push(n,1,reply),2,'wall')?.win===1)};
 let overlooked=false;for(let seed=1;seed<=50;seed++){const r=rng(seed);let first=true;const careful=chooseCpuMove(b,2,'wall',()=>{if(first){first=false;return .9}return r()});assert.equal(canLose(careful),false);let opening=true;const loose=chooseCpuMove(b,2,'wall',()=>{if(opening){opening=false;return 0}return r()});if(canLose(loose))overlooked=true}assert.equal(overlooked,true);
});
test('equivalent openings vary and an exhausted free board has no CPU move',()=>{
 const picks=new Set();for(let seed=1;seed<=20;seed++)picks.add(key(chooseCpuMove(Array(25).fill(0),2,'wall',rng(seed))));assert.ok(picks.size>1);assert.equal(chooseCpuMove(Array(25).fill(1),2,'free',rng(1)),null);
});
function ui(){
 const nodes=new Map(),timers=new Map(),storage=new Map();let timerId=0,starter=null;
 function node(id){if(nodes.has(id))return nodes.get(id);const e={hidden:false,children:[],style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},setAttribute(){},focus(){},remove(){},append(c){this.children.push(c)},replaceChildren(){this.children=[]},querySelector(s){return node(id+' '+s)},getBoundingClientRect(){return {width:0,height:0}}};nodes.set(id,e);return e}
 const win={addEventListener(){},wgChooseStarter:async()=>starter,location:{}};
 const ctx=vm.createContext({window:win,document:{getElementById:node,querySelector:node,addEventListener(){},createElement:()=>node('new'+nodes.size)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},console});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1]+`;animateSlide=async()=>{};render=()=>{};this.api={get state(){return s},get history(){return history},get selected(){return selected},setCpu,start,play,click,undoTurn,openReset,closeReset,requestStart,scheduleCpu};`,ctx);
 return {a:ctx.api,node,timers,setStarter(v){starter=v},async tick(){const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);entry[1]();await Promise.resolve();await Promise.resolve()}},storage};
}
test('CPU can open, schedules only once and hands control to the human',async()=>{
 const g=ui(),a=g.a;a.setCpu(true);a.start(2);a.scheduleCpu();assert.equal(g.timers.size,1);await g.tick();assert.equal(a.state.p,1);assert.equal(a.state.turn,2);assert.equal(g.timers.size,0);assert.equal(a.history.length,1);
});
test('human input is locked on CPU turns and undo cancels a pending CPU move',async()=>{
 const g=ui(),a=g.a;a.setCpu(true);a.start(1);await a.play(moves(a.state.b,1)[0]);const before=JSON.stringify(a.state);a.click(0);await a.play(moves(a.state.b,2)[0]);assert.equal(JSON.stringify(a.state),before);assert.equal(a.selected,null);assert.equal(g.timers.size,1);a.undoTurn();assert.equal(a.state.turn,1);assert.equal(a.state.p,1);assert.equal(g.timers.size,0);assert.equal(a.state.b.filter(Boolean).length,0);
});
test('CPU undo restores the human decision before both moves while two-player undo remains one move',async()=>{
 for(const cpu of [false,true]){const g=ui(),a=g.a;a.setCpu(cpu);a.start(1);await a.play(moves(a.state.b,1)[0]);if(cpu)await g.tick();else await a.play(moves(a.state.b,2)[0]);a.undoTurn();assert.equal(a.state.turn,cpu?1:2);assert.equal(a.state.p,cpu?1:2);assert.equal(a.history.length,cpu?0:1)}
});
test('confirmation pauses CPU and cancellation resumes; leaving for title cancels it',()=>{
 const g=ui(),a=g.a;a.setCpu(true);a.start(2);a.openReset('title');assert.equal(g.timers.size,0);a.scheduleCpu();assert.equal(g.timers.size,0);a.closeReset();assert.equal(g.timers.size,1);a.openReset('title');g.node('resetConfirm').onclick();assert.equal(a.state,null);assert.equal(g.timers.size,0);
});
test('cancelled restart keeps the match and CPU mode persists; a winning CPU move schedules nothing further',async()=>{
 const g=ui(),a=g.a;a.setCpu(true);assert.equal(g.storage.get('waitingShift_cpu'),'true');a.start(2);const match=a.state;await a.requestStart();assert.equal(a.state,match);assert.equal(g.timers.size,1);a.state.b.splice(0,5,0,2,2,2,2);await g.tick();assert.equal(a.state.result.win,2);assert.equal(g.timers.size,0);
});
