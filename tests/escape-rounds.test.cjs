// Run with: node --test tests/escape-rounds.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(){
 const nodes=new Map();
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set();
  const e={textContent:'',innerHTML:'',value:'',checked:false,dataset:{},
   classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)},toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);return on}},
   setAttribute(){}};
  nodes.set(id,e);return e;
 }
 const window={addEventListener(){},scrollTo(){}};
 const context=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[]},window,requestAnimationFrame(){},console});
 let code=fs.readFileSync(path.join(__dirname,'../games/escape.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 code=code.replace(/\}\)\(\);\s*$/, 'window.api={get state(){return G},init,render,finishDetective,returnToTitle};})();');
 node('pc').value='2';node('target').value='5';node('rainbow').value='0.5';node('double').value='0.5';
 vm.runInContext(code,context);
 window.api.init();
 return {api:window.api,node,click(){assert.equal(typeof node('ovBtn').onclick,'function');node('ovBtn').onclick()}};
}

test('round counter stays visible in action screens and resets with the game',()=>{
 const {api,node}=game();
 assert.equal(node('roundProgress').textContent,'ROUND 1/18');
 assert.equal(node('roundProgress').classList.contains('hidden'),false);
 assert.match(node('ovTitle').textContent,/逃走者チーム/);
 api.returnToTitle();assert.equal(node('roundProgress').classList.contains('hidden'),true);
 api.init();assert.equal(node('roundProgress').textContent,'ROUND 1/18');
});

test('round 17 continues into round 18',()=>{
 const {api,node,click}=game();api.state.round=17;
 api.finishDetective();assert.equal(node('ovBtn').textContent,'次のラウンド');click();
 assert.equal(api.state.round,18);assert.equal(api.state.over,false);
 assert.equal(node('roundProgress').textContent,'ROUND 18/18');
});

test('round 18 ends with a detective win without starting round 19',()=>{
 const {api,node,click}=game();api.state.round=18;
 api.finishDetective();assert.equal(node('ovBtn').textContent,'結果へ');click();
 assert.equal(api.state.over,true);assert.equal(api.state.round,18);
 assert.equal(node('ovTitle').textContent,'捜査官の勝利！');
 assert.match(node('ovText').textContent,/18ラウンド終了/);
});

test('final-round exploration results finish before the time-limit victory',()=>{
 const {api,node,click}=game();api.state.round=18;
 const p=api.state.runners[0];p.pos='2-A';p.pendingExplorations=['2-A'];api.state.cells['2-A'].kind='redKey';
 api.finishDetective();assert.equal(p.keys.includes('redKey'),true);click();
 assert.equal(api.state.over,false);assert.equal(node('ovTitle').textContent,'逃走者チームの探索結果');
 click();assert.equal(node('ovTitle').textContent,'探索結果');click();
 assert.equal(api.state.over,true);assert.equal(node('ovTitle').textContent,'捜査官の勝利！');
});

test('escape on round 18 takes precedence over the time limit',()=>{
 for(const unopened of [false,true]){
  const {api,node}=game();api.state.round=18;
  const p=api.state.runners[0];p.pos='5-A';p.keys=['redKey'];api.state.cells['5-A'].kind='redDoor';
  if(unopened)p.pendingExplorations=['5-A'];else api.state.open.add('5-A');
  api.finishDetective();assert.equal(api.state.over,true);
  assert.equal(node('ovTitle').textContent,'逃走者チームの勝利！');
 }
});

test('capture-point victory is preserved before and on the final round',()=>{
 for(const round of [1,18]){
  const {api,node,click}=game();api.state.round=round;api.state.captures=api.state.target;
  api.finishDetective();click();assert.equal(api.state.over,true);
  assert.equal(node('ovTitle').textContent,'捜査官の勝利！');assert.match(node('ovText').textContent,/捜査ポイント/);
 }
});
