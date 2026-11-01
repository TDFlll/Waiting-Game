// Run with: node --test tests/derby-open-modes.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function derby(){
 const nodes=new Map(),timers=new Map(),events={},windowEvents={};let now=0,nextId=0;
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const e={innerHTML:'',textContent:'',value:'',classList:{toggle(){}},addEventListener(){}};
  nodes.set(id,e);return e;
 }
 const document={hidden:false,getElementById:node,addEventListener(name,fn){events[name]=fn}};
 const window={location:{href:''},addEventListener(name,fn){windowEvents[name]=fn}};
 function timeout(fn,ms,repeat=false){const id=++nextId;timers.set(id,{fn,at:now+ms,ms,repeat});return id}
 const context=vm.createContext({document,window,localStorage:{getItem(){return null}},confirm:()=>true,alert(){},
  setTimeout:(fn,ms)=>timeout(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>timeout(fn,ms,true),clearInterval:id=>timers.delete(id),console});
 const html=fs.readFileSync(path.join(__dirname,'../games/derby.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInContext(script+`
 window.api={get state(){return game},get timer(){return randomOpenTimer},startGame,openOptions,setOpenMode,returnHome,quitGame,passEnter,chooseFlip,flip,publicCount,odds,stopOpen,beginPrivate,showPrivate,confirmBuy,closeModal,openRules,randomOpenTick,enterResult,calculateResult,finishRound,render};
 `,context);
 return {api:window.api,node,document,window,timers,
  advance(ms){const until=now+ms;let guard=0;while(true){const due=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;if(++guard>1000)throw Error('Timer loop');const [id,t]=due;now=t.at;timers.delete(id);if(t.repeat)timers.set(id,{...t,at:now+t.ms});t.fn()}now=until},
  hidden(v){document.hidden=v;events.visibilitychange()},pagehide(){windowEvents.pagehide()},
  randomStart(){window.api.openOptions();window.api.setOpenMode('random');window.api.returnHome();window.api.startGame();window.api.passEnter()},
  buy(kind='randomBuy',amount=1000){window.api.showPrivate(kind);node('buyType').value='win';node('buyFirst').value='1';node('buySecond').value='2';node('buyAmount').value=String(amount);window.api.confirmBuy(kind)}
 };
}

test('title includes Start, Options and Quit; mode defaults to Free Open',()=>{
 const {api,node,window}=derby();const title=node('app').innerHTML;
 assert.match(title,/スタート/);assert.match(title,/オプション/);assert.match(title,/ゲームをやめる/);
 assert.equal(api.state.settings.openMode,'free');api.openOptions();assert.match(node('app').innerHTML,/Free Open/);assert.match(node('app').innerHTML,/Randm Open/);
 api.setOpenMode('random');api.returnHome();assert.match(node('app').innerHTML,/Randm Open/);api.quitGame();assert.equal(window.location.href,'../index.html');
});

test('Free Open keeps player card choice and mandatory reveal after buying',()=>{
 const d=derby(),{api}=d;api.startGame();api.passEnter();assert.equal(api.timer,null);
 d.advance(15000);assert.equal(api.publicCount(),0);api.beginPrivate('buy');d.buy('buy');
 assert.equal(api.state.mode,'flip');assert.equal(api.state.current,0);
 const pos=api.state.board.find(c=>!c.revealed).pos;api.flip(pos);
 assert.equal(api.publicCount(),1);assert.equal(api.state.current,1);assert.equal(api.state.screen,'pass');
});

test('Randm Open reveals one unrevealed card every five seconds, never during handoff',()=>{
 const d=derby(),{api}=d;api.openOptions();api.setOpenMode('random');api.returnHome();api.startGame();
 d.advance(20000);assert.equal(api.publicCount(),0);api.passEnter();
 d.advance(4999);assert.equal(api.publicCount(),0);d.advance(1);assert.equal(api.publicCount(),1);
 d.advance(10000);assert.equal(api.publicCount(),3);assert.equal(api.state.board.filter(c=>c.kind==='horse'&&c.revealed).length,6);
 assert.equal(api.state.current,0);assert.equal(api.state.mode,'view');
});

test('Stop freezes cards and odds throughout private purchase, then changes player without a manual flip',()=>{
 const d=derby(),{api}=d;d.randomStart();d.advance(10000);const odds=api.odds('win');
 api.stopOpen();assert.equal(api.timer,null);d.advance(30000);assert.equal(api.publicCount(),2);
 d.buy();assert.equal(api.state.players[0].tickets[0].count,2);assert.equal(api.state.players[0].tickets[0].odds,odds);
 assert.equal(api.state.players[0].cash,9000);assert.equal(api.state.current,1);assert.equal(api.state.screen,'pass');assert.equal(api.publicCount(),2);
 d.advance(10000);assert.equal(api.publicCount(),2);api.passEnter();d.advance(5000);assert.equal(api.publicCount(),3);
});

test('cancelling Stop resumes after a fresh five seconds and discards stale timer callbacks',()=>{
 const d=derby(),{api}=d;d.randomStart();const oldTick=d.timers.get(api.timer).fn;
 d.advance(4900);api.stopOpen();oldTick();assert.equal(api.publicCount(),0);api.closeModal();
 d.advance(4999);assert.equal(api.publicCount(),0);d.advance(1);assert.equal(api.publicCount(),1);
 assert.equal(api.state.players[0].tickets.length,0);
});

test('rules and ticket review suspend automatic reveals',()=>{
 const d=derby(),{api}=d;d.randomStart();
 for(const open of [()=>api.openRules(),()=>api.beginPrivate('review')]){
  const count=api.publicCount();open();d.advance(12000);assert.equal(api.publicCount(),count);api.closeModal();d.advance(5000);assert.equal(api.publicCount(),count+1);
 }
});

test('background pages pause the clock and foreground resumes with a fresh interval',()=>{
 const d=derby(),{api}=d;d.randomStart();d.advance(4000);d.hidden(true);d.advance(15000);assert.equal(api.publicCount(),0);
 d.hidden(false);d.advance(4999);assert.equal(api.publicCount(),0);d.advance(1);assert.equal(api.publicCount(),1);
 d.pagehide();d.advance(10000);assert.equal(api.publicCount(),1);
});

test('nine automatic reveals enter final purchases with the final card still hidden',()=>{
 const d=derby(),{api}=d;d.randomStart();d.advance(45000);
 assert.equal(api.publicCount(),9);assert.equal(api.state.screen,'pass');assert.equal(api.state.mode,'forcePass');assert.equal(api.timer,null);
 api.passEnter();assert.equal(api.state.screen,'force');api.beginPrivate('forceBuy');d.buy('forceBuy');api.passEnter();
 api.beginPrivate('forceBuy');d.buy('forceBuy');assert.equal(api.state.screen,'result');assert.equal(api.publicCount(),9);
 d.advance(20000);assert.equal(api.publicCount(),9);
});

test('players with two tickets are skipped and both finished players end the round early',()=>{
 const d=derby(),{api}=d;d.randomStart();
 for(let i=0;i<4;i++){
  api.stopOpen();d.buy();
  if(i<3)api.passEnter();
 }
 assert.equal(api.state.screen,'result');assert.equal(api.publicCount(),0);
 assert.equal(api.state.players[0].tickets.length,2);assert.equal(api.state.players[1].tickets.length,2);assert.equal(api.timer,null);
});

test('all-in players are skipped on subsequent turns',()=>{
 const d=derby(),{api}=d;d.randomStart();api.stopOpen();d.buy('randomBuy',10000);api.passEnter();
 api.stopOpen();d.buy();assert.equal(api.state.current,1);assert.equal(api.state.screen,'pass');api.passEnter();
 api.stopOpen();d.buy();assert.equal(api.state.screen,'result');assert.equal(api.state.players[0].tickets.length,1);
});

test('Randm Open blocks manual flips and freezes the odds during an invalid purchase',()=>{
 const d=derby(),{api,node}=d;d.randomStart();api.chooseFlip();const pos=api.state.board.find(c=>!c.revealed).pos;api.flip(pos);assert.equal(api.publicCount(),0);
 api.stopOpen();api.showPrivate('randomBuy');node('buyType').value='win';node('buyFirst').value='1';node('buySecond').value='2';node('buyAmount').value='101';api.confirmBuy('randomBuy');
 d.advance(10000);assert.equal(api.publicCount(),0);assert.equal(api.state.players[0].tickets.length,0);assert.equal(api.timer,null);
});

test('returning to title or starting a new game cancels pending reveals',()=>{
 const d=derby(),{api}=d;d.randomStart();const stale=d.timers.get(api.timer).fn;
 api.returnHome();d.advance(10000);assert.equal(api.state.screen,'home');assert.equal(api.publicCount(),0);
 api.startGame();stale();assert.equal(api.state.screen,'pass');assert.equal(api.publicCount(),0);
});

test('second round retains Randm Open and starts with fresh hands and a stopped timer',()=>{
 const d=derby(),{api}=d;d.randomStart();api.enterResult();api.calculateResult();api.finishRound();
 assert.equal(api.state.round,2);assert.equal(api.state.openMode,'random');assert.equal(api.state.current,1);
 assert.equal(api.state.screen,'pass');assert.equal(api.timer,null);assert.equal(api.publicCount(),0);
 api.state.players.forEach(p=>{assert.equal(p.cash,10000);assert.equal(p.tickets.length,0)});
 api.passEnter();d.advance(5000);assert.equal(api.publicCount(),1);
});
