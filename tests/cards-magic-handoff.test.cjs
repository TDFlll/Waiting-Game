const {test}=require('node:test'),assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(mode='double'){const d=game(mode);emptyHands(d.api);d.api.state.turn=0;d.api.state.actions=0;return d;}
test('MAGIC offers only enemy removal and draw/return, costs one life and no AP, twice per player',async()=>{
 const {api:a}=setup();a.state.players[0].life=10;
 for(let i=0;i<3;i++){const enemy=a.card(8,1);putOnField(a,enemy,1);a.choices('destroy');a.pick({p:1,l:0,zone:'monster'});await a.useMagic();assert.equal(a.state.players[0].magicUses,Math.min(i+1,2));assert.equal(a.state.players[0].life,10-Math.min(i+1,2));assert.equal(a.state.actions,0);assert.equal(a.graveFor(1).includes(enemy),i<2);}
 const options=a.choiceHistory[0].options;assert.deepEqual(Array.from(options,o=>o.value),['destroy','draw']);
 a.state.turn=1;a.choices('draw',opts=>opts[0].value);await a.useMagic();assert.equal(a.state.players[1].magicUses,1);assert.equal(a.state.players[0].magicUses,2);
});
test('MAGIC removal excludes own monsters, triggers grave abilities, and does not change AP',async()=>{
 const {api:a}=setup(),own=a.card(8,0),enemy=a.card(6,1);putOnField(a,own);putOnField(a,enemy,1);a.pick({p:1,l:0,zone:'monster'});a.choices('destroy');await a.useMagic();
 assert.equal(a.state.players[0].monster[0],own);assert.ok(a.graveFor(1).includes(enemy));assert.equal(own.atkMod,-5);assert.equal(a.state.actions,0);
});
test('MAGIC refuses own target and both cancellation stages preserve life and uses',async()=>{
 for(const stage of ['menu','target','own']){const {api:a}=setup(),own=a.card(8,0);putOnField(a,own);putOnField(a,a.card(8,1),1);a.choices(stage==='menu'?null:'destroy');a.pick(stage==='own'?{p:0,l:0}:null);await a.useMagic();assert.equal(a.state.players[0].life,4);assert.equal(a.state.players[0].magicUses,0);assert.equal(a.state.players[0].monster[0],own);}
});
test('MAGIC drawing uses the correct deck, draws two, returns one to bottom, and hides its name',async()=>{
 for(const mode of ['single','double']){const {api:a}=setup(mode),before=a.deckFor(0).length;const back=a.card(1,1);a.state.players[0].hand=[back];a.choices('draw',back.uid);await a.useMagic();assert.equal(a.state.players[0].hand.length,2);assert.equal(a.deckFor(0)[0],back);assert.equal(a.deckFor(0).length,before-1);assert.equal(a.state.players[0].life,3);assert.equal(a.state.actions,0);assert.ok(!a.state.turnEvents.some(e=>e.includes('激おこドラゴン')));if(mode==='double')assert.equal(a.deckFor(1).length,20);}
});
test('insufficient deck omits draw; no target or usable mode does not spend anything',async()=>{
 const {api:a}=setup();a.deckFor(0).length=1;await a.useMagic();assert.equal(a.choiceHistory.length,0);assert.equal(a.state.players[0].magicUses,0);
 putOnField(a,a.card(8,1),1);a.choices(null);await a.useMagic();assert.deepEqual(Array.from(a.choiceHistory[0].options,o=>o.value),['destroy']);
});
test('paying last life loses immediately before the MAGIC effect',async()=>{
 const {api:a}=setup();a.state.players[0].life=1;const count=a.deckFor(0).length;a.choices('draw');await a.useMagic();assert.equal(a.state.players[0].life,0);assert.equal(a.state.gameover,true);assert.equal(a.state.players[0].magicUses,1);assert.equal(a.deckFor(0).length,count);
});
test('turn summary retains the whole turn, groups repeats, and never uses transient popup queues',()=>{
 const {api:a,node}=setup();a.state.lastTurnPlayer=0;a.state.lastTurnEvents=['P1 のターン開始',...Array.from({length:14},(_,i)=>'公開イベント'+i),'P1 が罠をセット','P1 が罠をセット'];a.state.turnEvents=[];
 a.realShowHandoff(1);const text=node('handoffMsg').textContent;assert.match(text,/公開イベント0/);assert.match(text,/公開イベント13/);assert.match(text,/罠をセット（2回）/);assert.ok(!text.includes('のターン開始'));assert.equal(node('handoff').classList.contains('hidden'),false);
 node('readyBtn').onclick();assert.equal(node('handoff').classList.contains('hidden'),true);assert.match(node('turnDigestList').textContent,/公開イベント0/);assert.match(node('turnDigestList').textContent,/公開イベント13/);assert.equal(node('turnDigestBar').classList.contains('show'),true);
 a.realLog('貫通1が発動');assert.equal(node('eventToast').classList.contains('show'),false);assert.equal(node('effectFlash').classList.contains('show'),false);
});
test('handoff separates preceding turn events from current turn start effects',async()=>{
 const {api:a,node}=setup();a.state.firstTurn=false;a.state.turnEvents=['P1 が罠をセット'];await a.endTurn();assert.equal(a.state.lastTurnPlayer,0);a.realShowHandoff(1);assert.match(node('handoffMsg').textContent,/P1 が罠をセット/);assert.match(node('handoffMsg').textContent,/ターン開始時/);assert.match(node('handoffMsg').textContent,/P2 が 1枚ドロー/);
});
test('CPU can choose draw MAGIC and never spends its last life',async()=>{
 const {api:a}=setup();a.setCpu();a.state.turn=1;a.choices('draw',opts=>opts[0].value);assert.equal(await a.cpuMaybeMagic(),true);assert.equal(a.state.players[1].hand.length,1);assert.equal(a.state.players[1].magicUses,1);
 a.state.players[1].life=1;assert.equal(await a.cpuMaybeMagic(),false);assert.equal(a.state.players[1].magicUses,1);
});
test('CPU prioritizes enemy removal when choosing between the two MAGIC modes',()=>{
 const {api:a}=setup();a.setCpu();assert.equal(a.cpuPickOption('MAGIC / 残り2回',[{label:'相手の場のモンスター1体を墓地へ送る',value:'destroy'},{label:'デッキから2枚引き、手札1枚をデッキの底へ戻す',value:'draw'}]),0);
});
