// Run with: node --test tests/cards-deck-modes.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(mode='double',seed=1){
 const nodes=new Map();
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set();
  const e={innerHTML:'',textContent:'',style:{},children:[],disabled:false,
   classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)},toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c)}},
   appendChild(c){this.children.push(c)},append(c){this.children.push(c)},querySelectorAll(){return []},setAttribute(){}};
  nodes.set(id,e);return e;
 }
 const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const context=vm.createContext({Math:math,document:{readyState:'loading',addEventListener(){},getElementById:node,querySelector:node,querySelectorAll:()=>[],createElement:()=>node('new'+nodes.size),createTextNode:t=>({textContent:t})},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout(){},clearTimeout(){},console});
 const code=fs.readFileSync(path.join(__dirname,'../games/cards.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInContext(code+`
 const realRender=render;
 let scriptedChoices=[],fieldChoice=null;
 choose=async (title,options)=>{const requested=scriptedChoices.shift();return requested===undefined?options[0]?.value:requested};
 chooseFieldSlot=async()=>fieldChoice;
 render=renderLog=showCardEffect=showEventToast=clearDigestBanners=showHandoff=function(){};
 log=function(t){S.log.push(t);S.turnEvents.push(t)};
 window.api={get state(){return S},get bases(){return BASE_CARDS},init(mode){uid=1;DECK_MODE=mode;S=newState();busy=false;scriptedChoices=[];fieldChoice=null},
 graveFor,graveEntries,putGrave,sendGrave,sendMonsterFromField,destroyWholeLane,monsterBattle,revivalEffect,magicBookEffect,faithStartOption,resolvePending,showGrave,
 deckFor,deckEntries,draw,handLimit,gamblingEffect,necromancerEffect,swapPotEffect,transformEffect,findAnywhere,locateCard,captureLocations,removeLocated,placeByDescriptor,saveSnapshot,rewindOwnField,checkStalemate,summon,takeGrave,cloneCard,useTimeMagic,startTurn,showRules,realRender,
 choices(...v){scriptedChoices=v},pick(v){fieldChoice=v},setCpu(){GAME_MODE='CPU'},
 card(id,p){const c=cloneCard(BASE_CARDS.find(b=>b.id===id));c.originalDeck=p;return c}
 };
 `,context);
 const api=context.window.api;api.init(mode);
 return {api,node,all(){return [...api.state.players.flatMap(p=>[...p.hand,...p.monster.filter(Boolean),...p.magic.filter(Boolean)]),...api.graveEntries().flatMap(e=>e.grave),...api.deckEntries().flatMap(e=>e.deck)]}};
}

function putOnField(api,card,p=0,l=0){card.controller=p;card.zone='monster';card.lane=l;api.state.players[p].monster[l]=card}
function emptyHands(api){api.state.players.forEach(p=>{p.hand=[]})}

test('single mode retains one shared 24-card deck and guaranteed monster opening hands',()=>{
 const {api,all}=game('single');assert.equal(all().length,24);assert.equal(api.deckFor(0),api.deckFor(1));
 assert.equal(api.deckFor(0).length,16);assert.equal(api.state.decks,null);
 api.state.players.forEach(p=>{assert.equal(p.hand.length,4);assert.ok(p.hand.some(c=>c.kind==='monster'))});
 api.draw(1);assert.equal(api.deckFor(0).length,15);
});

test('double mode has two independent identical compositions with globally unique card instances',()=>{
 for(let seed=1;seed<=40;seed++){
  const {api,all}=game('double',seed);const cards=all();
  assert.equal(cards.length,48);assert.equal(new Set(cards.map(c=>c.uid)).size,48);
  assert.notEqual(api.deckFor(0),api.deckFor(1));
  for(const p of [0,1]){
   const own=[...api.deckFor(p),...api.state.players[p].hand];
   assert.equal(own.length,24);assert.equal(new Set(own.map(c=>c.id)).size,24);
   assert.ok(own.every(c=>c.originalDeck===p));assert.ok(api.state.players[p].hand.some(c=>c.kind==='monster'));
   assert.equal(api.deckFor(p).length,20);
  }
 }
});

test('title buttons select modes and game rendering shows both deck counts',()=>{
 const {api,node}=game('single');node('doubleDeckBtn').onclick();
 assert.equal(node('doubleDeckBtn').classList.contains('on'),true);assert.match(node('deckModeHelp').textContent,/墓地もプレイヤーごと/);
 api.init('double');api.realRender();assert.match(node('deckText').textContent,/P1:20.*P2:20/);
 node('singleDeckBtn').onclick();assert.equal(node('singleDeckBtn').classList.contains('on'),true);
});

test('drawing from an exhausted deck never borrows the opponent deck',()=>{
 const {api}=game();api.deckFor(0).length=0;
 assert.equal(api.draw(0,3),0);assert.equal(api.deckFor(1).length,20);
 assert.equal(api.draw(1,2),2);assert.equal(api.deckFor(1).length,18);
});

test('opening turn draw setting works with the current player deck',async()=>{
 const {api}=game();api.state.starter=1;await api.startTurn(1,true);
 assert.equal(api.deckFor(1).length,19);assert.equal(api.deckFor(0).length,20);
});

test('hand limit returns even an opponent-origin card to the hand holder deck',async()=>{
 const {api}=game();const c=api.state.players[1].hand.pop();api.state.players[0].hand.push(c);
 api.draw(0,1);assert.equal(api.state.players[0].hand.length,6);api.choices(c.uid);
 await api.handLimit(0);assert.equal(api.deckFor(0)[0],c);assert.equal(api.deckFor(1).length,20);
});

test('swap pot redraws only from its player deck and preserves every card',async()=>{
 for(const mode of ['single','double']){
  const {api,all}=game(mode);const before=all().map(c=>c.uid).sort((a,b)=>a-b);
  const opponentDeck=api.deckFor(1).map(c=>c.uid).join(',');
  await api.swapPotEffect(0);assert.equal(api.state.players[0].hand.length,4);
  assert.deepEqual(all().map(c=>c.uid).sort((a,b)=>a-b),before);
  if(mode==='double')assert.equal(api.deckFor(1).map(c=>c.uid).join(','),opponentDeck);
 }
});

test('necromancer searches only the activating player deck, including for CPU',async()=>{
 const {api}=game();api.setCpu();const p=1;const before=api.deckFor(0).map(c=>c.uid).join(',');
 api.state.players[p].hand=[];await api.necromancerEffect(p);
 assert.equal(api.state.players[p].hand.length,1);assert.equal(api.state.players[p].hand[0].originalDeck,p);
 assert.equal(api.deckFor(0).map(c=>c.uid).join(','),before);
 api.deckFor(p).length=0;await api.necromancerEffect(p);assert.equal(api.state.players[p].hand.length,1);
});

test('gambling reset tests the user deck and returns each hand to its respective deck',async()=>{
 const {api,all}=game();const deck=api.deckFor(1);api.graveFor(1).push(...deck.splice(0,deck.length-1));
 const source=api.card(109,1);api.state.players[1].hand.push(source);
 const before=all().map(c=>c.uid).sort((a,b)=>a-b);await api.gamblingEffect(1,source);
 assert.equal(api.state.players[0].hand.length,2);assert.equal(api.state.players[1].hand.length,3);
 assert.ok(api.state.players[1].hand.includes(source));
 for(const p of [0,1])assert.ok(api.state.players[p].hand.every(c=>c.originalDeck===p));
 assert.deepEqual(all().map(c=>c.uid).sort((a,b)=>a-b),before);
});

test('gambling normal draws and returns do not use an exhausted opponent deck',async()=>{
 const {api}=game();api.deckFor(1).length=0;
 const hand=api.state.players[0].hand;const count=hand.length,deckCount=api.deckFor(0).length;
 await api.gamblingEffect(0,null);
 assert.equal(api.state.players[0].hand.length,count);assert.equal(api.deckFor(0).length,deckCount);assert.equal(api.deckFor(1).length,0);
 assert.ok(!api.state.log.some(t=>t.includes('リセット')));
});

test('transform prefers the matching original deck over an earlier opposing hand',async()=>{
 const {api}=game();emptyHands(api);api.state.grave=[];api.deckFor(0).length=0;api.deckFor(1).length=0;
 const target=api.card(3,1),wrong=api.card(1,0),right=api.card(1,1);
 putOnField(api,target,1);api.state.players[0].hand=[wrong];api.deckFor(1).push(right);api.pick({p:1,l:0});
 assert.equal(await api.transformEffect(0),true);
 assert.equal(api.state.players[1].monster[0],right);assert.equal(api.deckFor(1)[0],target);
 assert.equal(api.state.players[0].hand[0],wrong);assert.equal(api.deckFor(0).length,0);
});

test('single transform retains the existing cross-player search order',()=>{
 const {api}=game('single');emptyHands(api);const c=api.card(1,null);api.state.players[1].hand.push(c);
 assert.equal(api.findAnywhere(1,999).card,c);
});

test('snapshot rewind finds an exact UID in the second deck, keeping the duplicate untouched',()=>{
 const {api}=game();const target=api.card(4,0),duplicate=api.card(4,1);putOnField(api,target);api.deckFor(0).push(duplicate);
 api.saveSnapshot(0);api.state.players[0].monster[0]=null;api.deckFor(1).push(target);
 assert.equal(api.rewindOwnField(0),true);assert.equal(api.state.players[0].monster[0],target);
 assert.ok(!api.deckFor(1).includes(target));assert.ok(api.deckFor(0).includes(duplicate));
});

test('snapshot returns a newly summoned card to the correct original deck location',()=>{
 const {api}=game();const c=api.deckFor(1)[5];api.saveSnapshot(0);
 api.removeLocated(api.locateCard(c.uid));putOnField(api,c);api.rewindOwnField(0);
 assert.equal(api.deckFor(1)[5],c);assert.equal(api.state.players[0].monster[0],null);
});

test('TIME MAGIC draws and returns only through the current player deck',async()=>{
 const {api}=game();api.state.turn=1;api.state.actions=2;
 api.choices('draw');await api.useTimeMagic();assert.equal(api.state.players[1].timeUsed,true);
 assert.equal(api.deckFor(1).length,18);assert.equal(api.deckFor(0).length,20);
});

test('individual graves hold each copy and summoning tracks emblems and hatred per UID',async()=>{
 const {api}=game();const a=api.card(5,0),b=api.card(5,1);api.putGrave(a);api.putGrave(b);
 await api.summon(api.takeGrave(a.uid,0),0,0);await api.summon(api.takeGrave(b.uid,1),1,0);
 assert.equal(a.originalSummoner,0);assert.equal(b.originalSummoner,1);
 assert.equal(api.state.players[0].possessionEmblem,true);assert.equal(api.state.players[1].possessionEmblem,true);
 const x=api.card(12,0),y=api.card(12,1);await api.summon(x,0,1,false,true);await api.summon(x,0,1,false,true);await api.summon(y,1,1,false,true);
 assert.equal(x.atkMod,2);assert.equal(y.atkMod,0);
});

test('stalemate requires both decks empty and still preserves the single-mode rule',()=>{
 for(const mode of ['single','double']){
  const {api}=game(mode);api.deckFor(0).length=0;api.checkStalemate();
  assert.equal(api.state.gameover,mode==='single');
  if(mode==='double'){api.deckFor(1).length=0;api.state.players[0].life=3;api.checkStalemate();assert.equal(api.state.gameover,true)}
 }
});

test('grave routing follows the original deck even under opposing control',async()=>{
 const {api,node}=game();const a=api.card(4,0),b=api.card(8,1);
 a.controller=1;b.controller=0;await api.sendGrave(a,'test',false);await api.sendGrave(b,'test',false);
 assert.equal(api.graveFor(0)[0],a);assert.equal(api.graveFor(1)[0],b);
 assert.equal(api.takeGrave(b.uid,0),null);assert.equal(api.takeGrave(a.uid,1),null);
 api.realRender();assert.match(node('graveText').textContent,/P1:1 P2:1/);
 api.showGrave();assert.match(node('modalOptions').innerHTML,/P1 の墓地 \/ 1枚/);assert.match(node('modalOptions').innerHTML,/P2 の墓地 \/ 1枚/);
});

test('single mode still allows revival from the shared grave',async()=>{
 const {api}=game('single');const c=api.card(4,null);api.putGrave(c);
 assert.equal(api.graveFor(0),api.graveFor(1));assert.equal(await api.revivalEffect(1,0),true);
 assert.equal(api.state.players[1].monster[0],c);
});

test('revival and recovery cannot take monsters from the opposing grave',async()=>{
 const {api}=game();const other=api.card(4,1);api.putGrave(other);
 assert.equal(await api.revivalEffect(0,0),false);
 const book=api.card(111,0);api.state.players[0].hand.push(book);
 assert.equal(await api.magicBookEffect(0,book),false);assert.equal(api.graveFor(1)[0],other);
 const own=api.card(8,0);api.putGrave(own);assert.equal(await api.revivalEffect(0,0),true);
 assert.equal(api.state.players[0].monster[0],own);
});

test('necromancer can summon only from its own grave',async()=>{
 const {api}=game();api.deckFor(0).length=0;const other=api.card(5,1);api.putGrave(other);
 await api.necromancerEffect(0);assert.equal(api.state.players[0].monster[0],null);
 const own=api.card(7,0);api.putGrave(own);await api.necromancerEffect(0);
 assert.equal(api.state.players[0].monster[0],own);assert.equal(api.graveFor(1)[0],other);
});

test('faith cannot summon an opposing grave copy, including for CPU',async()=>{
 for(const cpu of [false,true]){
  const {api}=game();const p=cpu?1:0;if(cpu)api.setCpu();api.state.turn=p;
  api.state.players[p].faithEmblem=true;const other=api.card(12,1-p);api.putGrave(other);
  await api.faithStartOption(p);assert.equal(api.state.players[p].monster[0],null);
  assert.equal(api.graveFor(1-p)[0],other);assert.equal(api.state.players[p].faithUsedTurn,null);
 }
});

test('possession checks only its player grave even if the opposing copy was first summoned by that player',async()=>{
 const {api}=game();api.state.turn=0;api.state.players[0].possessionEmblem=true;
 const other=api.card(5,1);other.originalSummoner=0;api.putGrave(other);
 api.state.pending.push({type:'ghostCheck',owner:0});await api.resolvePending();
 assert.equal(api.state.players[0].monster[0],null);assert.equal(api.graveFor(1)[0],other);
 const own=api.card(5,0);own.originalSummoner=0;api.putGrave(own);api.pick({p:0,l:0});
 api.state.pending.push({type:'ghostCheck',owner:0});await api.resolvePending();
 assert.equal(api.state.players[0].monster[0],own);
});

test('battle and whole-lane destruction send cards to their respective graves',async()=>{
 const {api}=game();const a=api.card(8,0),b=api.card(8,1);putOnField(api,a,0);putOnField(api,b,1);
 await api.monsterBattle(0,0);assert.ok(api.graveFor(0).includes(a));assert.ok(api.graveFor(1).includes(b));
 const x=api.card(4,0),y=api.card(3,1);putOnField(api,x,1);putOnField(api,y,0);
 await api.destroyWholeLane(0,0,null,false);assert.ok(api.graveFor(0).includes(x));assert.ok(api.graveFor(1).includes(y));
});

test('snapshot restores a card from the opposing grave and returns new field cards to the correct grave',()=>{
 const {api}=game();const c=api.card(4,1);putOnField(api,c);api.saveSnapshot(0);
 api.state.players[0].monster[0]=null;api.putGrave(c);api.rewindOwnField(0);
 assert.equal(api.state.players[0].monster[0],c);assert.equal(api.graveFor(1).length,0);
 const d=api.card(8,1);api.putGrave(d);api.saveSnapshot(0);api.removeLocated(api.locateCard(d.uid));putOnField(api,d,0,1);
 api.rewindOwnField(0);assert.equal(api.graveFor(1)[0],d);assert.equal(api.state.players[0].monster[1],null);
});

test('transform retains its explicit ability to find a matching card in either grave',async()=>{
 const {api}=game();emptyHands(api);api.deckFor(0).length=0;api.deckFor(1).length=0;
 const target=api.card(3,1),replacement=api.card(1,1);putOnField(api,target,1);api.putGrave(replacement);api.pick({p:1,l:0});
 assert.equal(await api.transformEffect(0),true);assert.equal(api.state.players[1].monster[0],replacement);
 assert.equal(api.graveFor(1)[0],target);assert.equal(api.graveFor(0).length,0);
});
