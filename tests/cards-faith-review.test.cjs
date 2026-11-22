const {test}=require('node:test');const assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(mode='double',p=0){const g=game(mode);emptyHands(g.api);g.api.state.turn=p;g.api.state.actions=2;return g;}
test('Dead Eyes grants a faith emblem on its first summon and retains its grave effect',async()=>{
 const {api:a}=setup();const c=a.card(6,0);assert.equal(c.faith,2);assert.match(c.text,/信仰2/);await a.summon(c,0,0,false,true);assert.equal(a.state.players[0].faithEmblem,true);
 putOnField(a,a.card(8,1),1);await a.sendMonsterFromField(0,0,'test');await a.resolvePending();assert.equal(a.cardAtk(a.state.players[1].monster[0]),3);
});
test('faith returns the chosen monster to hand with a full field, no AP or summon effects, once per turn',async()=>{
 for(const mode of ['single','double'])for(const id of [6,12]){
  const {api:a}=setup(mode);a.state.players[0].faithEmblem=true;
  const c=a.card(id,0);c.originalSummoner=0;c.handSummonCount=1;c.summonCount=1;c.atkMod=2;a.putGrave(c);
  const costs=[a.card(100,0),a.card(103,0)];a.state.players[0].hand=costs.slice();
  const field=[a.card(8,0),a.card(2,0)];field.forEach((c,i)=>putOnField(a,c,0,i));
  a.choices(c.uid,...costs.map(c=>c.uid));await a.faithStartOption(0);
  assert.equal(a.state.actions,2);assert.equal(a.state.players[0].hand.length,1);assert.equal(a.state.players[0].hand[0],c);assert.equal(c.zone,null);assert.equal(c.lane,null);assert.equal(c.handSummonCount,1);assert.equal(c.atkMod,2);
  assert.equal(a.state.players[0].monster[0],field[0]);assert.equal(a.state.players[0].monster[1],field[1]);assert.equal(a.state.players[0].faithUsedTurn,a.state.turnNo);assert.ok(costs.every(c=>a.graveFor(0).includes(c)));
  assert.ok(!a.choiceHistory.some(x=>x.title.includes('召喚先')));
  a.putGrave(a.card(6,0));a.state.players[0].hand.push(a.card(100,0));const count=a.choiceHistory.length;await a.faithStartOption(0);assert.equal(a.choiceHistory.length,count);
 }
});
test('faith requires an emblem and enough hand cards; cancellations do not pay or consume the turn use',async()=>{
 for(const stage of ['emblem','short','target','discard1','discard2']){
  const {api:a}=setup();a.state.players[0].faithEmblem=stage!=='emblem';const c=a.card(6,0);a.putGrave(c);
  const costs=[a.card(100,0),a.card(103,0)];a.state.players[0].hand=costs.slice(0,stage==='short'?1:2);
  a.choices(...(stage==='target'?[null]:stage==='discard1'?[c.uid,null]:[c.uid,costs[0].uid,null]));
  const before=a.state.players[0].hand.length;await a.faithStartOption(0);
  assert.equal(a.state.players[0].hand.length,before);assert.equal(a.graveFor(0).length,1);assert.equal(a.graveFor(0)[0],c);assert.equal(a.state.players[0].faithUsedTurn,null);assert.equal(a.state.actions,2);
 }
});
test('faith costs trigger grave abilities and normal summoning of the recovered card still costs AP',async()=>{
 const {api:a}=setup();a.state.players[0].faithEmblem=true;const c=a.card(12,0);c.originalSummoner=0;c.handSummonCount=1;c.summonCount=1;a.putGrave(c);
 const dead=a.card(6,0),cost=a.card(103,0);a.state.players[0].hand=[dead,cost];const enemy=a.card(8,1);putOnField(a,enemy,1);
 a.choices(c.uid,dead.uid,cost.uid);await a.faithStartOption(0);assert.equal(a.cardAtk(enemy),3);assert.equal(a.state.actions,2);
 a.pick({p:0,l:0,zone:'monster'});await a.playFromHand(c.uid);assert.equal(a.state.actions,1);assert.equal(a.state.players[0].monster[0],c);assert.equal(c.handSummonCount,2);assert.equal(c.atkMod,2);
});
test('CPU faith recovers to hand even with full monster slots and spends no AP',async()=>{
 const {api:a}=setup('double',1);a.setCpu();a.state.players[1].faithEmblem=true;
 const c=a.card(12,1);a.putGrave(c);const costs=[a.card(100,1),a.card(100,1)];a.state.players[1].hand=costs;
 putOnField(a,a.card(8,1),1,0);putOnField(a,a.card(2,1),1,1);await a.faithStartOption(1);
 assert.ok(a.state.players[1].hand.includes(c));assert.equal(a.state.actions,2);assert.equal(a.state.players[1].faithUsedTurn,a.state.turnNo);
});
test('MAGIC is free at one life for either effect, remains limited to two uses and preserves AP',async()=>{
 for(const mode of ['single','double'])for(const effect of ['destroy','draw']){
  const {api:a}=setup(mode);a.state.players[0].life=2;
  for(let i=0;i<3;i++){
   const enemy=a.card(8,1);putOnField(a,enemy,1);a.choices(effect,opts=>opts[0].value);a.pick({p:1,l:0,zone:'monster'});await a.useMagic();
   assert.equal(a.state.players[0].life,1);assert.equal(a.state.players[0].magicUses,Math.min(i+1,2));assert.equal(a.state.actions,2);assert.equal(a.state.gameover,false);
   if(effect==='destroy')assert.equal(a.graveFor(1).includes(enemy),i<2);
  }
 }
});
test('inspection tabs preserve pending modal choices and keep opponent hand/trap identities hidden',async()=>{
 const {api:a,node}=setup();const own=a.card(6,0),secret=a.card(12,1),trap=a.card(109,1),grave=a.card(8,1);a.state.players[0].hand=[own];a.state.players[1].hand=[secret];trap.faceDown=true;trap.controller=1;a.state.players[1].magic[0]=trap;a.putGrave(grave);
 const pending=a.realChoose('選ぶ',[{label:'対象',value:1}]);const original=node('modalOptions').innerHTML;
 const before=JSON.stringify(a.state);
 for(const zone of ['hand','field','grave']){a.openDecisionReview(zone);const text=node('decisionReviewBody').innerHTML;assert.ok(!text.includes(secret.name));if(zone==='hand')assert.ok(text.includes(own.name));if(zone==='field'){assert.ok(text.includes('伏せカード'));assert.ok(!text.includes(trap.name));}if(zone==='grave')assert.ok(text.includes(grave.name));a.closeDecisionReview();assert.equal(a.selectionPending,true);assert.equal(node('modalOptions').innerHTML,original);}
 assert.equal(JSON.stringify(a.state),before);node('modalCancel').onclick();assert.equal(await pending,null);assert.equal(a.selectionPending,false);assert.equal(node('modalReviewTools').classList.contains('hidden'),true);
});
test('reaction inspection uses the choosing player, and field picks survive inspection until cancelled',async()=>{
 const {api:a,node}=setup();a.setDecisionPlayer(1);const active=a.card(6,0),reaction=a.card(12,1);a.state.players[0].hand=[active];a.state.players[1].hand=[reaction];
 const pending=a.realChooseFieldSlot('場から選ぶ',()=>true);a.openDecisionReview('hand');const text=node('decisionReviewBody').innerHTML;assert.ok(text.includes(reaction.name));assert.ok(!text.includes(active.name));a.closeDecisionReview();assert.equal(a.selectionPending,true);node('pickHint').onclick();assert.equal(await pending,null);assert.equal(a.selectionPending,false);assert.equal(node('fieldReviewTools').classList.contains('hidden'),true);
});
test('inspection reveals only the choosing player own traps and does not open for automated CPU choices',async()=>{
 const {api:a,node}=setup();const own=a.card(109,0),opposing=a.card(105,1);own.faceDown=opposing.faceDown=true;own.controller=0;opposing.controller=1;a.state.players[0].magic[0]=own;a.state.players[1].magic[0]=opposing;
 const pending=a.realChoose('対象選択',[{label:'対象',value:1}]);a.openDecisionReview('field');const html=node('decisionReviewBody').innerHTML;assert.ok(html.includes(own.name));assert.ok(!html.includes(opposing.name));assert.equal(node('modal').inert,true);a.closeDecisionReview();assert.equal(node('modal').inert,false);
 a.setCpu();a.setDecisionPlayer(1);a.openDecisionReview('hand');assert.equal(node('decisionReview').classList.contains('hidden'),true);node('modalCancel').onclick();await pending;
});
