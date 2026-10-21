// Run with: node --test tests/line-cpu.test.cjs (no dependencies).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const path=require('node:path');

function game(seed=1){
 const nodes=new Map(),timers=new Map();let timerId=0,elementId=0;
 function node(key){
  if(nodes.has(key))return nodes.get(key);
  const classes=new Set(),listeners={};let value='',html='';
  const e={style:{},dataset:{},children:[],disabled:false,checked:true,textContent:'',
   get value(){return value},set value(v){value=String(v)},
   get innerHTML(){return html},set innerHTML(v){html=v;e.children=[];for(const k of nodes.keys())if(k.startsWith(key+' '))nodes.delete(k)},
   classList:{add(...c){c.forEach(x=>classes.add(x))},remove(...c){c.forEach(x=>classes.delete(x))},contains(c){return classes.has(c)},toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c)}},
   setAttribute(){},addEventListener(type,fn){listeners[type]=fn},click(){if(!e.disabled)listeners.click?.()},appendChild(c){e.children.push(c)},
   querySelector(s){return node(key+' '+s)},querySelectorAll(){return []},
   get parentElement(){return node(key+' parent')},remove(){}};
  nodes.set(key,e);return e;
 }
 const document={querySelector:node,getElementById:id=>node('#'+id),querySelectorAll:()=>[],createElement:tag=>node('new-'+tag+'-'+elementId++)};
 const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const context=vm.createContext({Math:math,document,window:{scrollTo(){}},localStorage:{getItem(){return null},setItem(){}},crypto:webcrypto,confirm:()=>true,
  setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},console});
 let code=fs.readFileSync(path.join(__dirname,'../games/line.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 code=code.replace(/\}\)\(\);\s*$/,`window.api={get state(){return state},initGame,cpuObservation,cpuPlan,cpuGoalOrder,cpuDistances,rotateMask,validPlacements,tileMask,selectTile,place,skip,rotate,undoTurn,beginTurn,currentPlayer,finishRound,nextRound,checkGoals,showScreen,stopCpu,get busy(){return cpuBusy},get snapshots(){return humanSnapshots}};})();`);
 node('#optionGoalMode').value='corners';
 vm.runInContext(code,context);
 const api=context.window.api;
 api.showScreen('gameScreen');api.initGame('cpu');
 return {api,node,timers,tick(){const first=timers.entries().next().value;if(first){timers.delete(first[0]);first[1]()}},plain:v=>JSON.parse(JSON.stringify(v))};
}

test('hidden multipliers are never read by CPU planning',()=>{
 const {api}=game();api.state.publicRates=false;
 Object.defineProperty(api.state.secrets,0,{get(){throw Error('private multiplier read')}});
 const view=api.cpuObservation();
 assert.equal(view.opponent.red,1.125);
 assert.ok(api.cpuPlan(view));
});

test('public multipliers affect the preferred simultaneous goal order',()=>{
 const {api,plain}=game();const v=api.cpuObservation();
 v.own={red:2,blue:1.5,green:1,yellow:0};v.opponent={red:0,blue:1,green:1.5,yellow:2};
 const all=api.cpuGoalOrder(['red','blue','green','yellow'],v,0);
 assert.deepEqual(plain(all.order),['green','blue','red','yellow']);
 assert.equal(all.value,16.5);
 for(const colors of [['red','blue'],['red','blue','green']]){
  const order=api.cpuGoalOrder(colors,v,4-colors.length).order;
  assert.equal(order.length,colors.length);assert.equal(new Set(order).size,colors.length);
 }
});

test('plans are legal, affordable, deterministic and leave the observation intact in both modes',()=>{
 const {api,plain,node}=game();
 for(const mode of ['corners','walls'])for(const points of [0,1,3]){
  node('#optionGoalMode').value=mode;api.initGame('cpu');api.state.players[1].rot=points;
  api.state.draft=[{type:'A',rot:0,bonus:0},{type:'B',rot:1,bonus:1},{type:'C',rot:2,bonus:0},{type:'D',rot:3,bonus:0},{type:'E',rot:0,bonus:0}];
  const view=api.cpuObservation(),before=JSON.stringify(view),plan=api.cpuPlan(view);
  assert.equal(JSON.stringify(view),before);assert.deepEqual(plain(api.cpuPlan(view)),plain(plan));
  assert.equal(plan.kind,'place');
  const tile=view.draft[plan.index],cost=Math.min(plan.steps,4-plan.steps);
  assert.ok(cost<=points+tile.bonus);
  const mask=api.rotateMask(api.tileMask(tile),plan.steps);
  assert.ok(api.validPlacements(mask).some(([r,c])=>r===plan.r&&c===plan.c));
 }
});

test('CPU makes its own move, locks human controls and undo cancels pending work',()=>{
 const {api,tick,timers,node}=game();
 api.selectTile(0);const [r,c]=api.validPlacements(api.tileMask(api.state.selected))[0];api.place(r,c);
 assert.equal(api.currentPlayer(),1);assert.equal(api.busy,true);
 tick(); // Select and preview.
 assert.equal(node('#draft').children.every(b=>b.disabled),true);
 const selected=api.state.selected;api.selectTile(1);assert.equal(api.state.selected,selected);
 tick(); // Commit.
 assert.equal(api.currentPlayer(),0);assert.equal(api.busy,false);
 assert.ok(api.state.lastCpuCell);assert.equal(api.snapshots.length,2);
 api.undoTurn();assert.equal(api.currentPlayer(),0);assert.equal(api.state.board[r][c],null);
 assert.equal(api.state.selected,null);assert.equal(api.snapshots.length,1);
 api.selectTile(1);const next=api.validPlacements(api.tileMask(api.state.selected))[0];api.place(...next);
 assert.equal(timers.size,1);api.undoTurn();assert.equal(timers.size,0);assert.equal(api.currentPlayer(),0);
});

test('unplayable drafts skip only with no affordable orientation',()=>{
 const {api}=game();
 api.state.board=api.state.board.map(row=>row.map(()=>({mask:0})));
 api.state.board[2][2]={mask:15};api.state.board[1][2]=null;
 api.state.players[1].rot=0;
 api.state.draft=Array.from({length:5},()=>({type:'E',rot:0,bonus:0}));
 assert.equal(api.cpuPlan(api.cpuObservation()).kind,'skip');
 api.state.draft[2].bonus=2;
 const plan=api.cpuPlan(api.cpuObservation());
 assert.equal(plan.kind,'place');assert.equal(plan.index,2);assert.equal(plan.steps,2);
 assert.equal(plan.r,1);assert.equal(plan.c,2);
});

test('a poor draft can trigger one affordable swap without peeking at the actual draw',()=>{
 const {api,node,tick}=game();
 api.state.board=api.state.board.map(row=>row.map(()=>({mask:0})));
 api.state.board[2][2]={mask:1};api.state.board[1][2]=null;
 api.state.board[0][2]={mask:12};api.state.board[0][1]={mask:10};api.state.board[0][0]={mask:2,goal:'red'};
 api.state.secrets[1].red=0;api.state.secrets[0].red=2;
 api.state.draft=Array.from({length:5},()=>({type:'B',rot:0,bonus:0}));
 const view=api.cpuObservation();view.odds={A:0,B:0,C:0,D:0,E:100};
 assert.equal(api.cpuPlan(view).kind,'swap');
 for(const [key,value] of Object.entries(view.odds))node('#odds_'+key).value=value;
 // Match the configured odds through the real options event, then exercise the scheduler.
 node('#optionsBack').click();api.showScreen('gameScreen');
 api.state.pickIndex=1;api.beginTurn();tick();
 assert.equal(api.state.history.filter(s=>s.includes('入れ替え（2P消費）')).length,1);
 assert.ok(api.state.players[1].rot>=0&&api.state.players[1].rot<=1);
});

test('multiple human undos preserve walls geometry and discard the abandoned branch',()=>{
 const {api,node,tick}=game();node('#optionGoalMode').value='walls';api.initGame('cpu');
 const advance=()=>{
  api.state.draft[0].type='A';api.selectTile(0);api.place(...api.validPlacements(api.tileMask(api.state.selected))[0]);tick();tick();
  if(node('#overlay').classList.contains('show'))node('#modal #confirmOrder').click();
  if(api.currentPlayer()===1){tick();tick()}
 };
 advance();advance();assert.equal(api.snapshots.length,3);
 api.undoTurn();assert.equal(api.snapshots.length,2);api.undoTurn();assert.equal(api.snapshots.length,1);
 assert.equal(api.state.board[0][0],undefined);assert.equal(api.state.board.flat().filter(x=>x!==undefined).length,29);
 advance();assert.equal(api.snapshots.length,2);
});

test('CPU chooses multi-goal order automatically, and round undo restores totals and history',()=>{
 const {api,node}=game();api.state.pickIndex=1;
 api.state.board=api.state.board.map(row=>row.map(()=>({mask:15})));
 api.state.board[0][0].goal='red';api.state.board[0][4].goal='blue';api.state.board[4][4].goal='green';api.state.board[4][0].goal='yellow';
 assert.equal(api.checkGoals(1),false);assert.equal(api.state.reached.length,4);
 api.state.humanStarted=true;api.finishRound();assert.equal(api.state.roundOver,true);
 assert.equal(api.state.roundHistory.length,1);api.undoTurn();
 assert.equal(api.state.roundHistory.length,0);assert.equal(api.state.players[0].total,0);assert.equal(api.state.roundOver,false);
 api.finishRound();api.nextRound();assert.equal(api.state.round,2);assert.equal(api.state.mode,'cpu');
 assert.equal(api.snapshots.length,1);assert.equal(node('#overlay').classList.contains('show'),false);
});

test('CPU consecutive turns after a bonus switch, reset and title exit are safe',()=>{
 const {api,tick,timers,node}=game();
 api.state.draft[0].type='A';api.state.draft[0].bonus=1;
 api.selectTile(0);api.place(...api.validPlacements(api.tileMask(api.state.selected))[0]);
 tick();tick();
 assert.equal(api.state.first,1);assert.equal(api.currentPlayer(),1);assert.equal(timers.size,0);
 node('#modal #confirmOrder').click();assert.equal(timers.size,1);tick();tick();assert.equal(api.currentPlayer(),0);
 api.showScreen('titleScreen');assert.equal(timers.size,0);
 api.showScreen('gameScreen');api.initGame('cpu');api.state.pickIndex=1;api.beginTurn();assert.equal(timers.size,1);
 api.initGame('vs');assert.equal(timers.size,0);assert.equal(api.state.mode,'vs');tick();assert.equal(api.currentPlayer(),0);
});

test('three-round matches finish in corner/wall and public/private modes',()=>{
 for(const mode of ['corners','walls'])for(const visible of [true,false])for(const seed of [1,7,42]){
  const {api,node,timers,tick}=game(seed);node('#optionGoalMode').value=mode;node('#optionPublicRates').checked=visible;api.initGame('cpu');
  let actions=0;
  while(!api.state.gameOver&&actions++<1200){
   if(timers.size){tick();continue}
   if(node('#overlay').classList.contains('show')){
    if(api.state.roundOver)node('#modal #nr').click();
    else if(node('#modal #orderBtns').children.length)node('#modal #orderBtns').children[0].click();
    else node('#modal #confirmOrder').click();
    continue;
   }
   assert.equal(api.currentPlayer(),0,'CPU must have a scheduled action');
   let placed=false;
   for(let i=0;i<api.state.draft.length&&!placed;i++){
    api.selectTile(i);
    for(let rotations=0;rotations<4&&!placed;rotations++){
     const places=api.validPlacements(api.tileMask(api.state.selected));
     if(places.length){api.place(...places[0]);placed=true}
     else if(api.state.players[0].rot>0)api.rotate(1);
     else break;
    }
   }
   if(!placed)api.skip();
   assert.ok(api.state.players.every(p=>p.rot>=0));
  }
  assert.ok(api.state.gameOver,`${mode}/${visible}/${seed}: game did not finish`);
  assert.equal(api.state.roundHistory.length,3);
  for(let p=0;p<2;p++){
   const total=api.state.roundHistory.reduce((sum,h)=>sum+h.scores[p],0);
   assert.equal(api.state.players[p].total,total);
  }
  assert.equal(timers.size,0);
 }
});
