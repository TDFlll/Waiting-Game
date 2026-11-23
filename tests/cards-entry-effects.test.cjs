const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(mode='double'){const d=game(mode);emptyHands(d.api);d.api.state.turn=0;d.api.state.actions=2;return d;}
const slot=(p,l=0)=>({p,l,zone:'monster'});
test('drill gains one attack on defensive breakthrough while remaining on field and keeps piercing unchanged',async()=>{
 const {api:a}=setup(),drill=a.card(4,1);putOnField(a,a.card(9,0));putOnField(a,drill,1);await a.monsterBattle(0,0);assert.equal(a.cardAtk(drill),8);assert.equal(a.pierceValue(drill),1);assert.equal(a.emblemOptions(1).length,0);
});
test('evolution can place the own grave child dragon in either deck mode without consuming its effect AP',async()=>{
 for(const mode of ['single','double']){const {api:a}=setup(mode);a.deckFor(0).length=0;const child=a.card(3,0);a.putGrave(child);a.pick(slot(0,1));assert.equal(await a.transformEffect(0),true);assert.equal(a.state.players[0].monster[1],child);assert.equal(a.graveFor(0).includes(child),false);assert.equal(a.state.actions,2);assert.equal(a.canAttack(child),false);}
});
test('evolution chooses between own deck and own grave copies and can cancel either selection without moving cards',async()=>{
 for(const stage of ['source','slot','success']){const {api:a}=setup();a.deckFor(0).length=0;const deck=a.card(3,0),grave=a.card(3,0);a.deckFor(0).push(deck);a.putGrave(grave);a.choices(stage==='source'?null:grave.uid);a.pick(stage==='slot'?null:slot(0));const ok=await a.transformEffect(0);assert.equal(ok,stage==='success');assert.equal(a.deckFor(0)[0],deck);assert.equal(a.graveFor(0).includes(grave),stage!=='success');if(stage==='success')assert.equal(a.state.players[0].monster[0],grave);}
});
test('evolution cannot use the opponent individual grave or a banished child',async()=>{
 const {api:a}=setup();a.deckFor(0).length=0;const other=a.card(3,1);a.putGrave(other);assert.equal(await a.transformEffect(0),false);assert.equal(a.graveFor(1)[0],other);
 const own=a.card(3,0);putOnField(a,own);a.banishMonsterFromField(0,0,'test');assert.equal(await a.transformEffect(0),false);assert.ok(a.state.banished.includes(own));
});
test('magic book banishes based on current ATK including exactly 9, with no grave trigger',async()=>{
 for(const mode of ['single','double']){const {api:a}=setup(mode),book=a.card(111,0),cost=a.card(100,0),dead=a.card(6,1),own=a.card(8,0);dead.atkMod=5;putOnField(a,dead,1);putOnField(a,own);a.state.players[0].hand=[book,cost];a.choices('banish',cost.uid);a.pick(slot(1));await a.playFromHand(book.uid);assert.equal(a.state.banished[0],dead);assert.equal(dead.zone,'banished');assert.ok(!a.graveFor(1).includes(dead));assert.equal(a.cardAtk(own),8);assert.equal(a.state.actions,1);assert.equal(a.state.pending.length,0);}
});
test('ATK below nine, own monsters, and book-immune anti-undead cannot be banished',async()=>{
 for(const scenario of ['low','own','immune']){const {api:a}=setup(),book=a.card(111,0),cost=a.card(100,0),m=a.card(scenario==='immune'?7:8,scenario==='own'?0:1);m.atkMod=scenario==='immune'?5:scenario==='own'?2:0;putOnField(a,m,scenario==='own'?0:1);a.state.players[0].hand=[book,cost];a.choices('banish',cost.uid);a.pick(slot(scenario==='own'?0:1));await a.playFromHand(book.uid);assert.equal(a.state.banished.length,0);assert.equal(a.state.actions,2);assert.equal(a.state.players[0].hand.length,2);}
});
test('banishing cancellation before choosing a target or hand cost preserves life, AP, cards and the target',async()=>{
 for(const stage of ['mode','target','cost']){const {api:a}=setup(),book=a.card(111,0),cost=a.card(100,0),target=a.card(12,1);putOnField(a,target,1);a.state.players[0].hand=[book,cost];a.choices(...(stage==='mode'?[null]:['banish',null]));a.pick(stage==='target'?null:slot(1));await a.playFromHand(book.uid);assert.equal(a.state.players[1].monster[0],target);assert.equal(a.state.players[0].hand.length,2);assert.equal(a.state.actions,2);assert.equal(a.state.banished.length,0);}
});
test('banished cards cannot be found, revived, recovered, transformed or restored from a saved field',async()=>{
 const {api:a}=setup();const target=a.card(12,1);putOnField(a,target,1);a.saveSnapshot(1);a.banishMonsterFromField(1,0,'test');
 assert.equal(a.locateCard(target.uid),null);assert.equal(a.takeGrave(target.uid,1),null);assert.notEqual(a.findAnywhere(12,null)?.card,target);
 a.rewindOwnField(1);assert.equal(a.state.players[1].monster[0],null);assert.equal(target.zone,'banished');
 await a.summon(target,1,0);a.putGrave(target);a.placeByDescriptor(target,{area:'hand',p:1,i:0});await a.sendGrave(target,'test');assert.equal(a.state.players[1].hand.length,0);assert.equal(a.graveFor(1).length,0);assert.equal(a.state.banished[0],target);
 a.state.players[1].faithEmblem=true;await a.faithStartOption(1);assert.equal(a.state.players[1].hand.includes(target),false);assert.equal(a.state.players[1].monster[0],null);
});
test('necromancer triggers from both hand and grave, adds displayed current attack and never removes the reference',async()=>{
 for(const mode of ['single','double'])for(const from of ['hand','grave']){const {api:a}=setup(mode),n=a.card(9,0),ref=a.card(8,0);ref.atkMod=-3;a.putGrave(ref);
  if(from==='hand'){a.state.players[0].hand=[n];a.choices(ref.uid);a.pick(slot(0));await a.playFromHand(n.uid)}else{a.putGrave(n);a.choices(n.uid,ref.uid);assert.equal(await a.revivalEffect(0,0),true);await a.resolvePending()}
  assert.equal(a.cardAtk(n),7);assert.ok(a.graveFor(0).includes(ref));assert.equal(a.state.players[0].monster[0],n);
 }
});
test('necromancer excludes opponent grave monsters, non-monsters and banished cards',async()=>{
 const {api:a}=setup(),n=a.card(9,0),other=a.card(12,1),magic=a.card(100,0),banished=a.card(4,0);a.putGrave(other);a.putGrave(magic);putOnField(a,banished);a.banishMonsterFromField(0,0,'test');await a.summon(n,0,0);await a.resolvePending();assert.equal(a.cardAtk(n),2);assert.equal(a.choiceHistory.length,0);
});
test('hatred counts every entry including repeated revival from the grave, without increasing on hand recovery alone',async()=>{
 const {api:a}=setup(),c=a.card(12,0);await a.summon(c,0,0,false,false);assert.equal(a.cardAtk(c),10);
 for(const atk of [12,12]){await a.sendMonsterFromField(0,0,'test');a.choices(c.uid);assert.equal(await a.revivalEffect(0,0),true);assert.equal(a.cardAtk(c),atk)}
 assert.equal(c.summonCount,3);assert.equal(c.handSummonCount,0);assert.equal(a.state.players[0].faithEmblem,true);
});
test('angry dragon removal and swap-pot hand replacement also trigger when entering from a grave',async()=>{
 {const {api:a}=setup(),dragon=a.card(1,0),target=a.card(8,1);a.putGrave(dragon);putOnField(a,target,1);a.choices(dragon.uid);a.pick(slot(1));await a.revivalEffect(0,0);await a.resolvePending();assert.ok(a.graveFor(1).includes(target));assert.equal(a.state.players[0].monster[0],dragon);}
 {const {api:a}=setup(),pot=a.card(11,0);a.putGrave(pot);a.state.players[0].hand=[a.card(100,0),a.card(103,0)];const count=a.deckFor(0).length;a.choices(pot.uid);await a.revivalEffect(0,0);await a.resolvePending();assert.equal(a.state.players[0].hand.length,2);assert.equal(a.deckFor(0).length,count);assert.ok(a.state.log.some(t=>t.includes('入れかえ壺：手札2枚')));}
});
test('banished cards are listed separately in the grave inspector and the public grave list',async()=>{
 const {api:a,node}=setup(),c=a.card(12,1);putOnField(a,c,1);a.banishMonsterFromField(1,0,'test');a.showGrave();assert.match(node('modalOptions').innerHTML,/除外（蘇生・回収不可）/);assert.match(node('modalOptions').innerHTML,/腐天使/);
 const waiting=a.realChoose('対象',[{label:'対象',value:1}]);a.openDecisionReview('grave');assert.match(node('decisionReviewBody').innerHTML,/除外（蘇生・回収不可）/);a.closeDecisionReview();node('modalCancel').onclick();await waiting;
});
test('effect terminology uses field entry while the original spell name is preserved',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../games/cards.html'),'utf8');assert.ok(!html.replaceAll('召喚の魔法','').includes('召喚'));const {api:a}=setup();assert.equal(a.bases.find(c=>c.id===102).name,'召喚の魔法');assert.match(a.bases.find(c=>c.id===102).text,/場に出す/);assert.ok(!html.includes('貫通エンブレム'));assert.match(a.bases.find(c=>c.id===106).text,/デッキ・墓地/);
});
