const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');

function setup(mode='double'){
 const d=game(mode);emptyHands(d.api);d.api.state.actions=2;d.api.state.turn=0;return d;
}
function fieldPick(p,l=0,zone='monster'){return{p,l,zone}}
async function steal(api,id=4,owner=0){
 const a=api.card(id,owner),sacrifice=api.card(3,1-owner),trap=api.card(101,1-owner);
 putOnField(api,a,owner);putOnField(api,sacrifice,1-owner);trap.controller=1-owner;trap.faceDown=true;trap.zone='magic';trap.lane=0;api.state.players[1-owner].magic[0]=trap;
 api.state.turn=owner;api.choices('yes');assert.equal(await api.triggerAttackTraps(owner,0,a,false),true);
 return{a,sacrifice,trap};
}

test('updated definitions include renamed families and new monster stats without changing the deck size',()=>{
 const {api}=setup();assert.equal(api.bases.length,24);
 const revival=api.bases.find(c=>c.id===100),destruction=api.bases.find(c=>c.id===110),deadEyes=api.bases.find(c=>c.id===6);
 assert.equal(revival.name,'復活の書');assert.equal(revival.isBook,true);assert.equal(revival.magicFamily,undefined);
 assert.equal(destruction.name,'破壊の儀');assert.equal(destruction.magicFamily,'rite');
 assert.equal(deadEyes.debilitate,undefined);assert.equal(deadEyes.pierce,undefined);assert.equal(api.bases.find(c=>c.id===1).pierce,1);
});

test('dragon special summon consumes one AP and a field monster, then removes an enemy card',async()=>{
 const {api}=setup();const dragon=api.card(1,0),cost=api.card(3,0),target=api.card(8,1);
 api.state.players[0].hand=[dragon];putOnField(api,cost);putOnField(api,target,1);api.picks(fieldPick(0),fieldPick(1));
 await api.playFromHand(dragon.uid);assert.equal(api.state.actions,1);assert.equal(api.state.players[0].monster[0],dragon);
 assert.ok(api.graveFor(0).includes(cost));assert.ok(api.graveFor(1).includes(target));assert.equal(api.state.players[0].hand.length,0);
});

test('dragon summon with no opponent field succeeds while missing cost or cancelled cost changes nothing',async()=>{
 const {api}=setup();const d=api.card(1,0);api.state.players[0].hand=[d];await api.playFromHand(d.uid);
 assert.equal(api.state.actions,2);assert.equal(api.state.players[0].hand[0],d);
 const c=api.card(3,0);putOnField(api,c);api.pick(null);await api.playFromHand(d.uid);assert.equal(api.state.actions,2);
 api.pick(fieldPick(0));await api.playFromHand(d.uid);assert.equal(api.state.actions,1);assert.equal(api.state.players[0].monster[0],d);
 assert.ok(api.state.log.some(x=>x.includes('相手の場に対象なし')));
});

test('dragon direct attacks now deal normal damage instead of instant victory',async()=>{
 const {api}=setup();const d=api.card(1,0);putOnField(api,d);api.pick(fieldPick(0));
 await api.attackFlow();assert.equal(api.state.players[1].life,3);assert.equal(api.state.gameover,false);
});

test('golem survives winning battles until its third completed battle',async()=>{
 const {api}=setup();const golem=api.card(2,0);putOnField(api,golem);
 for(let i=1;i<=3;i++){
  putOnField(api,api.card(8,1),1);await api.monsterBattle(0,0);
  assert.equal(golem.battleCount,i);assert.equal(api.state.players[0].monster[0]===golem,i<3);
 }
 assert.ok(api.graveFor(0).includes(golem));
});

test('golems survive ties in their first two battles and both leave after the third',async()=>{
 const {api}=setup();const a=api.card(2,0),b=api.card(2,1);putOnField(api,a);putOnField(api,b,1);
 for(let i=0;i<2;i++){await api.monsterBattle(0,0);assert.equal(api.state.players[0].monster[0],a);assert.equal(api.state.players[1].monster[0],b);}
 await api.monsterBattle(0,0);assert.ok(api.graveFor(0).includes(a));assert.ok(api.graveFor(1).includes(b));
});

test('drill breakthrough awards one emblem without growing its own piercing damage',async()=>{
 const {api}=setup();const a=api.card(4,0),b=api.card(9,1);putOnField(api,a);putOnField(api,b,1);
 await api.monsterBattle(0,0);assert.equal(api.state.players[0].pierceEmblem,true);assert.equal(api.pierceValue(a),1);
 assert.equal(api.state.players[1].life,3);api.gainPierceEmblem(0);assert.equal(api.state.players[0].pierceEmblem,true);
});

test('emblem affects only later summons, grants piercing or one attack point, and does not stack',async()=>{
 const {api}=setup();const old=api.card(3,0);putOnField(api,old);api.gainPierceEmblem(0);api.gainPierceEmblem(0);
 assert.equal(api.pierceValue(old),0);const n=api.card(3,0);await api.summon(n,0,1);assert.equal(api.pierceValue(n),1);assert.equal(api.cardAtk(n),1);
 const p=api.card(4,0);await api.summon(p,0,1);assert.equal(api.pierceValue(p),1);assert.equal(api.cardAtk(p),8);
});

test('dead eyes no longer weakens on battle or deals piercing damage and never peeks at traps',async()=>{
 const {api}=setup();const a=api.card(6,0),b=api.card(2,1);b.atkMod=-8;putOnField(api,b,1);
 await api.summon(a,0,0);assert.equal(api.choiceHistory.length,0);await api.monsterBattle(0,0);
 assert.equal(b.atkMod,-8);assert.equal(api.state.players[1].life,4);
});

test('rider gets trap bonus and monster bonus independently, with AP capped at four',async()=>{
 const {api}=setup();api.state.actions=4;const trap=api.card(104,1);trap.faceDown=true;api.state.players[1].magic[0]=trap;
 putOnField(api,api.card(9,1),1);const rider=api.card(8,0);await api.summon(rider,0,0);
 assert.equal(rider.hasCharge,true);assert.equal(api.pierceValue(rider),1);assert.equal(api.state.actions,4);
 const other=api.card(8,0);await api.summon(other,0,1);assert.equal(other.hasCharge,false);assert.equal(api.pierceValue(other),0);
});

test('counter ritual sacrifices its own monster, takes the attacker and refunds one attacker AP',async()=>{
 const {api}=setup();api.state.actions=3;const {a,sacrifice,trap}=await steal(api);
 assert.equal(api.state.players[0].monster[0],null);assert.equal(api.state.players[1].monster[0],a);
 assert.equal(a.controller,1);assert.equal(a.returnTo,0);assert.equal(api.state.actions,4);
 assert.ok(api.graveFor(1).includes(sacrifice));assert.ok(api.graveFor(1).includes(trap));
});

test('counter ritual cannot trigger without its sacrifice, can be declined, and cannot steal anti-undead',async()=>{
 for(const scenario of ['noCost','decline','immune']){
  const {api}=setup();const a=api.card(scenario==='immune'?7:4,0);putOnField(api,a);
  if(scenario!=='noCost')putOnField(api,api.card(3,1),1);
  const t=api.card(101,1);t.faceDown=true;api.state.players[1].magic[0]=t;api.choices('no');
  assert.equal(await api.triggerAttackTraps(0,0,a,false),false);assert.equal(api.state.players[0].monster[0],a);assert.equal(t.faceDown,true);
 }
});

test('stolen monsters return to their prior player hand, deck, or grave when leaving the field',async()=>{
 for(const mode of ['single','double'])for(const area of ['hand','deck','grave']){
  const {api}=setup(mode);const {a}=await steal(api);api.state.players[1].monster[0]=null;
  if(area==='grave')await api.sendGrave(a,'test',false,true);else api.placeByDescriptor(a,{area,p:1,i:0});
  const destination=area==='hand'?api.state.players[0].hand:area==='deck'?api.deckFor(0):api.graveFor(0);
  assert.ok(destination.includes(a),mode+' '+area);assert.equal(a.returnTo,null);assert.equal(a.controller,0);
  if(mode==='double'&&area!=='hand')assert.ok(!(area==='deck'?api.deckFor(1):api.graveFor(1)).includes(a));
 }
});

test('forgery destroys a chosen opposing emblem without stripping earlier monster buffs',async()=>{
 const {api}=setup();api.gainPierceEmblem(1);const m=api.card(3,1);await api.summon(m,1,0);
 api.choices('emblem','pierceEmblem');assert.equal(await api.forgeryEffect(0),true);
 assert.equal(api.state.players[1].pierceEmblem,false);assert.equal(api.pierceValue(m),1);
 const n=api.card(3,1);await api.summon(n,1,1);assert.equal(api.pierceValue(n),0);
});

test('forgery swap remains a field selection and anti-undead rows remain immune',async()=>{
 const {api}=setup();const a=api.card(4,0);putOnField(api,a);api.choices('swap');api.pick({p:0,zone:'monster',l:0});
 assert.equal(await api.forgeryEffect(0),true);assert.equal(api.state.players[0].monster[1],a);assert.equal(a.lane,1);
 const immune=setup();putOnField(immune.api,immune.api.card(7,0));assert.equal(await immune.api.forgeryEffect(0),false);
});

test('transform searches only the acting player deck for child dragon',async()=>{
 const {api}=setup();const before=api.deckFor(1).map(c=>c.uid).join(',');
 if(!api.deckFor(0).some(c=>c.id===3))api.deckFor(0).push(api.card(3,0));
 api.choices('search');api.pick(fieldPick(0));assert.equal(await api.transformEffect(0),true);
 assert.equal(api.state.players[0].monster[0].id,3);assert.equal(api.state.players[0].monster[0].originalDeck,0);
 assert.equal(api.state.players[0].hand.length,0);assert.equal(api.canAttack(api.state.players[0].monster[0]),false);
 assert.equal(api.deckFor(1).map(c=>c.uid).join(','),before);
});

test('transform exchange invokes summon-time removal when child dragon becomes angry dragon',async()=>{
 const {api}=setup();const child=api.card(3,0),angry=api.card(1,0),enemy=api.card(8,1);
 putOnField(api,child);putOnField(api,enemy,1);api.deckFor(0).unshift(angry);api.choices('transform');api.picks(fieldPick(0),fieldPick(1));
 assert.equal(await api.transformEffect(0),true);await api.resolvePending();assert.equal(api.state.players[0].monster[0].id,1);
 assert.ok(api.graveFor(1).includes(enemy));assert.ok(api.deckFor(0).includes(child));
});

test('vampire draw no longer requires returning a card',async()=>{
 const {api}=setup();const count=api.deckFor(0).length;api.choices('life','draw');
 assert.equal(await api.vampireEffect(0),true);assert.equal(api.state.players[0].hand.length,1);
 assert.equal(api.deckFor(0).length,count-1);assert.equal(api.state.players[1].life,3);assert.equal(api.choiceHistory.length,2);
});

test('enhancement grants three attack and piercing, or four attack to an already piercing monster',async()=>{
 for(const id of [3,4]){
  const {api}=setup();const a=api.card(id,0);putOnField(api,a);api.pick(fieldPick(0));const before=api.cardAtk(a);
  assert.equal(await api.resolveMagicEffect(api.card(108,0),0,0),true);
  assert.equal(api.cardAtk(a),before+(id===3?3:4));assert.equal(api.pierceValue(a),1);
 }
});

test('magic book charge option discards exactly one other card and leaves one AP after activation',async()=>{
 const {api}=setup();api.state.actions=1;const book=api.card(111,0),cost=api.card(3,0),m=api.card(8,0);m.summonedTurn=api.state.turnNo;putOnField(api,m);
 api.state.players[0].hand=[book,cost];api.choices('charge',cost.uid);api.pick(fieldPick(0));
 await api.playFromHand(book.uid);assert.equal(api.state.actions,1);assert.equal(m.hasCharge,true);assert.equal(api.canAttack(m),true);
 assert.ok(api.graveFor(0).includes(book));assert.ok(api.graveFor(0).includes(cost));assert.equal(api.state.players[0].hand.length,0);
});

test('magic book cancellation before discarding its cost preserves cards and AP',async()=>{
 const {api}=setup();const book=api.card(111,0),cost=api.card(3,0),m=api.card(8,0);putOnField(api,m);api.state.players[0].hand=[book,cost];
 api.choices('charge',null);api.pick(fieldPick(0));await api.playFromHand(book.uid);
 assert.equal(api.state.actions,2);assert.equal(api.state.players[0].hand.length,2);assert.equal(m.hasCharge,false);
});

test('CPU refuses high-attack futile child-dragon battles and prioritizes actual removal',async()=>{
 const {api}=setup();api.setCpu();api.state.turn=1;const a=api.card(8,1),child=api.card(3,0);putOnField(api,a,1);putOnField(api,child,0);
 assert.equal(api.cpuAttackScore(0),-99);assert.equal(api.cpuPickField('破壊する場のモンスターをタップ',(p,l,z,c)=>z==='monster'&&!!c).p,0);
 assert.ok(api.cpuCardScore(api.card(1,1))>10);api.pick(api.cpuPickField('破壊する場のモンスターをタップ',(p,l,z,c)=>z==='monster'&&!!c));const result=await api.cpuMaybeMagic();assert.equal(result,true);
 assert.ok(api.graveFor(0).includes(child));assert.equal(api.state.players[1].magicUses,1);
});

test('snapshot restores stolen-control return destination and does not restore a destroyed emblem',async()=>{
 const {api}=setup();const {a}=await steal(api);api.saveSnapshot(1);
 api.state.players[1].monster[0]=null;await api.sendGrave(a,'test',false,true);api.state.players[1].pierceEmblem=false;
 api.rewindOwnField(1);assert.equal(api.state.players[1].monster[0],a);assert.equal(a.controller,1);assert.equal(a.returnTo,0);
 assert.equal(api.state.players[1].pierceEmblem,false);
});

test('AP bonuses are applied after paying a card cost, including at the four AP cap',async()=>{
 for(const id of [8,111]){
  const {api}=setup();api.state.actions=4;
  const c=api.card(id,0),cost=api.card(3,0);api.state.players[0].hand=[c,cost];api.pick(fieldPick(0));
  if(id===8){const trap=api.card(104,1);trap.faceDown=true;api.state.players[1].magic[0]=trap}
  else{putOnField(api,api.card(8,0));api.choices('charge',cost.uid)}
  await api.playFromHand(c.uid);assert.equal(api.state.actions,4);
 }
});

test('escape ritual returns a stolen attacker to its previous player hand',async()=>{
 const {api}=setup();const {a}=await steal(api);const escape=api.card(105,0);escape.faceDown=true;escape.controller=0;api.state.players[0].magic[0]=escape;
 api.state.turn=1;assert.equal(await api.triggerAttackTraps(1,0,a,true),true);
 assert.ok(api.state.players[0].hand.includes(a));assert.ok(!api.state.players[1].hand.includes(a));assert.equal(a.returnTo,null);
});

test('stolen death effects belong to the field controller while the card returns to its prior player grave',async()=>{
 const {api}=setup();const {a}=await steal(api,6);api.state.players[1].monster[0]=null;
 await api.sendGrave(a,'test',true,true);assert.ok(api.graveFor(0).includes(a));
 const trigger=api.state.pending.find(e=>e.type==='deadEyesGrave');assert.equal(trigger.owner,1);
});
