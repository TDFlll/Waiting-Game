const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(abilities=[16,2]){
 const nodes=new Map(),timers=[];
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set();
  const e={innerHTML:'',textContent:'',style:{},children:[],disabled:false,
   classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},toggle(c){classes.has(c)?classes.delete(c):classes.add(c)}},
   appendChild(c){this.children.push(c)},querySelectorAll(){return []}};
  nodes.set(id,e);return e;
 }
 const window={};
 const context=vm.createContext({window,document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('new'+nodes.size)},localStorage:{getItem(){return null}},setTimeout(fn){timers.push(fn)},clearTimeout(){},console});
 let code=fs.readFileSync(path.join(__dirname,'../games/robots.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 code=code.replace(/\}\)\(\);\s*$/, `
 window.api={get players(){return players},get abilities(){return AB},get step(){return step},setRound(n){round=n},commandLimit,commandCount,programSteps,addCmd,startActionInput,chooseActionDir,cancelPendingAction,finishInput,executeActions,runStep,renderProgram,
 init(abs){N=2;phase='input';current=0;gridSize=6;currentMap=null;colorRoad=false;treasures=[];round=1;step=0;
 players=[abs,[]].map(function(a,i){return {abilities:a,cmds:[],r:2,c:i?4:1,startR:2,startC:i?4:1,score:5,roundScore:0,used:{},reverse:false,droneDue:null}});
 renderBoard=renderScores=renderAbilityRoster=renderPeek=flashAction=fxActionName=fxBeamPlayers=fxBeamCells=fxReverseHit=fxLabelAtPlayer=fxRingAtPlayer=fxHammer=fxBurstAtPlayer=fxDroneLaunch=function(){};
 centerForPlayer=function(){return null};
 animateMoves=function(intents,blocked,done){for(var i=0;i<N;i++)if(intents[i]&&!blocked[i]){players[i].r=intents[i].r;players[i].c=intents[i].c}done()};
 }};})();`);
 vm.runInContext(code,context);window.api.init(abilities);
 return {api:window.api,node,flush(){while(timers.length){const fn=timers.shift();if(fn.name!=='runStep')fn()}}};
}

test('Double AI is selectable and adds two commands, stacking with battery and round growth',()=>{
 const {api}=game();const p=api.players[0];
 assert.equal(api.abilities.find(a=>a.id===16).n,'ダブルAI');
 assert.equal(api.commandLimit(p),10);p.abilities.push(12);assert.equal(api.commandLimit(p),14);
 api.setRound(3);assert.equal(api.commandLimit(p),16);
});

test('reserved actions cost no command and are bundled before the next move',()=>{
 const {api,node}=game();const p=api.players[0];
 api.startActionInput(api.abilities.find(a=>a.id===2));api.chooseActionDir('R');
 assert.equal(api.commandCount(p),0);assert.equal(node('done').disabled,true);
 api.addCmd('D');assert.equal(api.commandCount(p),1);
 const turns=api.programSteps(p);assert.equal(turns.length,1);assert.equal(turns[0].actions[0].id,2);assert.equal(turns[0].move.dir,'D');
 for(let i=1;i<10;i++)api.addCmd('U');
 assert.equal(node('done').disabled,false);assert.equal(node('counter').textContent,'10 / 10 ・ アクション無料');
 api.startActionInput(api.abilities.find(a=>a.id===2));assert.equal(p.cmds.length,11);
});

test('normal actions still consume a command and execute after movement',()=>{
 const {api,flush}=game([2]);const p=api.players[0],other=api.players[1];
 p.cmds=[{type:'action',id:2,dirs:['R']}];other.cmds=[{type:'move',dir:'D'}];
 assert.equal(api.commandCount(p),1);api.runStep();flush();
 assert.equal(other.r,3);assert.equal(other.reverse,false);assert.equal(p.used[2],1);
});

test('Double AI beam hits before the target moves and reverses that same move',()=>{
 const {api,flush}=game();const p=api.players[0],other=api.players[1];
 p.cmds=[{type:'action',id:2,dirs:['R']},{type:'move',dir:'D'}];other.cmds=[{type:'move',dir:'D'}];
 api.runStep();flush();
 assert.equal(other.reverse,true);assert.equal(other.r,1);assert.equal(p.r,3);assert.equal(p.used[2],1);assert.equal(api.step,1);
});

test('several free actions run in reservation order before one move, respecting use limits',()=>{
 const {api,flush}=game([16,2,11]);const p=api.players[0];
 api.startActionInput(api.abilities.find(a=>a.id===2));api.chooseActionDir('R');
 api.startActionInput(api.abilities.find(a=>a.id===2));assert.equal(p.cmds.length,1);
 api.startActionInput(api.abilities.find(a=>a.id===11));api.addCmd('D');
 assert.equal(api.programSteps(p)[0].actions.length,2);assert.equal(api.commandCount(p),1);
 p.r=p.startR;p.c=p.startC;
 api.runStep();flush();assert.equal(p.used[2],1);assert.equal(p.used[11],1);assert.equal(p.droneDue,1);assert.equal(p.r,3);
});

test('dash changes the starting position of the paired normal move',()=>{
 const {api,flush}=game([16,1]);const p=api.players[0];
 p.cmds=[{type:'action',id:1,dirs:['R']},{type:'move',dir:'D'}];
 api.runStep();flush();assert.equal(p.c,3);assert.equal(p.r,3);assert.equal(p.used[1],1);
});

test('two-direction action reservation can be cancelled without consuming a command',()=>{
 const {api,node}=game([16,8]);const p=api.players[0];
 api.startActionInput(api.abilities.find(a=>a.id===8));api.chooseActionDir('R');
 assert.equal(p.cmds.length,0);assert.equal(node('done').disabled,true);
 api.cancelPendingAction();assert.equal(api.commandCount(p),0);
 api.startActionInput(api.abilities.find(a=>a.id===8));api.chooseActionDir('R');api.chooseActionDir('D');api.addCmd('L');
 assert.equal(api.programSteps(p)[0].actions[0].dirs.join(','),'R,D');assert.equal(api.commandCount(p),1);
});
