const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(mode='double'){const {api}=game(mode);emptyHands(api);api.state.actions=2;api.state.turn=0;return api;}
function trap(api,id,p,l=0){const t=api.card(id,p);Object.assign(t,{controller:p,zone:'magic',lane:l,faceDown:true,playedTurn:api.state.turnNo});api.state.players[p].magic[l]=t;return t;}
const slot=(p,l=0)=>({p,l,zone:'monster'});

test('edited catalog replaces former abilities and classifies guardian as a rite trap',()=>{
 const a=setup(),g=a.bases.find(c=>c.id===109);assert.equal(g.name,'守護の儀');assert.equal(g.mode,'trap');assert.equal(g.magicFamily,'rite');assert.equal(g.isBook,undefined);
 assert.equal(a.bases.find(c=>c.id===106).name,'進化の書');assert.equal(a.bases.length,24);
});
test('golem survives two losing battles, still takes double weakness, and dies after third',async()=>{
 const a=setup(),g=a.card(2,0),enemy=a.card(5,1);enemy.atkMod=30;putOnField(a,g);putOnField(a,enemy,1);
 for(let i=1;i<=2;i++){await a.monsterBattle(0,0);assert.equal(a.state.players[0].monster[0],g);assert.equal(g.atkMod,-6*i);}
 await a.monsterBattle(0,0);assert.ok(a.graveFor(0).includes(g));assert.equal(g.battleCount,3);
});
test('dead eyes weakens all opposing current ATK7+ monsters instead of discarding a hand',async()=>{
 const a=setup(),d=a.card(6,0),g=a.card(2,1),m=a.card(3,1);m.atkMod=6;putOnField(a,g,1);putOnField(a,m,1,1);const hand=a.card(8,1);a.state.players[1].hand=[hand];
 await a.sendGrave(d,'discard',true,false);await a.resolvePending();assert.equal(g.atkMod,-10);assert.equal(m.atkMod,1);assert.equal(a.state.players[1].hand[0],hand);
});
test('dead eyes ignores lower current attack and its grave effect is suppressed by anti-undead',async()=>{
 const a=setup(),m=a.card(8,1);m.atkMod=-2;putOnField(a,m,1);await a.sendGrave(a.card(6,0),'cost');await a.resolvePending();assert.equal(m.atkMod,-2);
 putOnField(a,a.card(7,0));m.atkMod=0;await a.sendGrave(a.card(6,0),'cost');await a.resolvePending();assert.equal(m.atkMod,0);
});
test('necromancer steals only a same-lane hidden trap on every summon and replaces own trap',async()=>{
 for(const mode of ['single','double']){
  const a=setup(mode),n=a.card(9,0),old=trap(a,105,0),stolen=trap(a,110,1),other=trap(a,104,1,1);
  const before=a.deckFor(0).length;await a.summon(n,0,0,false,false);await a.resolvePending();
  assert.ok(a.graveFor(0).includes(old));assert.equal(a.state.players[0].magic[0],stolen);assert.equal(a.state.players[1].magic[0],null);assert.equal(a.state.players[1].magic[1],other);
  assert.equal(stolen.controller,0);assert.equal(stolen.faceDown,true);assert.equal(stolen.playedTurn,a.state.turnNo);assert.equal(a.deckFor(0).length,before);assert.equal(a.state.players[0].hand.length,0);
 }
});
test('necromancer replacing acceleration resolves its destruction draw for the original controller',async()=>{
 const a=setup(),n=a.card(9,0),old=trap(a,104,0),stolen=trap(a,105,1);await a.summon(n,0,0);await a.resolvePending();
 assert.equal(a.state.players[0].hand.length,2);assert.equal(a.state.actions,3);assert.ok(a.graveFor(0).includes(old));assert.equal(a.state.players[0].magic[0],stolen);
});
test('necromancer with no stealable trap leaves own trap and decks untouched',async()=>{
 const a=setup(),n=a.card(9,0),own=trap(a,105,0),faceUp=trap(a,104,1);faceUp.faceDown=false;
 await a.summon(n,0,0,false,true);await a.resolvePending();assert.equal(a.state.players[0].magic[0],own);assert.equal(a.state.players[1].magic[0],faceUp);assert.equal(a.state.players[0].hand.length,0);
});
test('evolution deck summon cancels safely and never uses an opponent deck or a full field',async()=>{
 const a=setup();a.deckFor(0).length=0;const c=a.card(3,0);a.deckFor(0).push(c);a.pick(null);assert.equal(await a.transformEffect(0),false);assert.equal(a.deckFor(0)[0],c);
 putOnField(a,a.card(8,0));putOnField(a,a.card(4,0),0,1);assert.equal(await a.transformEffect(0),false);assert.equal(a.deckFor(0)[0],c);
});
test('guardian prevents same-lane weakness once, grants ATK2, and preserves other-lane traps',async()=>{
 const a=setup(),g=a.card(2,0),m=a.card(8,0);putOnField(a,g);putOnField(a,m,0,1);const t=trap(a,109,0);
 await a.applyDebilitate(m,2,'test');assert.equal(m.atkMod,-2);assert.equal(a.state.players[0].magic[0],t);
 await a.applyDebilitate(g,5,'test');assert.equal(g.atkMod,2);assert.ok(a.graveFor(0).includes(t));assert.equal(a.state.players[0].magic[0],null);
 await a.applyDebilitate(g,1,'test');assert.equal(g.atkMod,0);
});
test('guardian intercepts vampire and dead eyes weakness through the same handler',async()=>{
 for(const source of ['vampire','deadEyes']){const a=setup(),m=a.card(8,1);putOnField(a,m,1);const t=trap(a,109,1);
  if(source==='vampire'){a.choices('debuff','draw');a.pick(slot(1));await a.vampireEffect(0);}else{await a.sendGrave(a.card(6,0),'cost');await a.resolvePending();}
  assert.equal(m.atkMod,2);assert.ok(a.graveFor(1).includes(t));
 }
});
test('guardian attack bonus changes battle outcome and expires after the attacking turn',async()=>{
 const a=setup(),attacker=a.card(8,0),defender=a.card(4,1);putOnField(a,attacker);putOnField(a,defender,1);const t=trap(a,109,1);a.pick(slot(0));
 await a.attackFlow();assert.ok(a.graveFor(0).includes(attacker));assert.equal(a.state.players[1].monster[0],defender);assert.equal(a.cardAtk(defender),10);assert.ok(a.graveFor(1).includes(t));
 a.state.turnNo++;assert.equal(a.cardAtk(defender),7);assert.equal(defender.atkMod,0);
});
test('guardian stays set with no front monster or an immune anti-undead monster',async()=>{
 for(const id of [null,7]){const a=setup(),attacker=a.card(8,0);putOnField(a,attacker);const t=trap(a,109,1);if(id)putOnField(a,a.card(id,1),1);
  assert.equal(await a.triggerAttackTraps(0,0,attacker,!id),false);assert.equal(a.state.players[1].magic[0],t);
  if(id){await a.applyDebilitate(a.state.players[1].monster[0],2,'monster');assert.equal(a.state.players[1].magic[0],t);assert.equal(a.cardAtk(a.state.players[1].monster[0]),4);}
 }
});
test('guardian activation queues possession and snapshots cannot extend its expired bonus',async()=>{
 const a=setup(),m=a.card(8,1);putOnField(a,m,1);trap(a,109,1);a.state.players[1].possessionEmblem=true;
 await a.triggerAttackTraps(0,0,a.card(3,0),false);assert.ok(a.state.pending.some(e=>e.type==='ghostCheck'));a.saveSnapshot(1);a.state.turnNo++;a.rewindOwnField(1);assert.equal(a.cardAtk(m),8);
});
test('magic book removes an opposing golem despite battle immunity and pays one extra hand card',async()=>{
 const a=setup(),g=a.card(2,1),book=a.card(111,0),cost=a.card(3,0);putOnField(a,g,1);a.state.players[0].hand=[book,cost];a.choices('golem',cost.uid);a.pick(slot(1));
 await a.playFromHand(book.uid);assert.equal(a.state.actions,1);assert.ok(a.graveFor(1).includes(g));assert.ok(a.graveFor(0).includes(cost));assert.ok(a.graveFor(0).includes(book));assert.equal(a.state.players[0].hand.length,0);
});
test('magic book no longer offers recovery or halving and does not pay when no targets exist',async()=>{
 const a=setup(),book=a.card(111,0),cost=a.card(3,0);a.state.players[0].hand=[book,cost];putOnField(a,a.card(8,1),1);a.putGrave(a.card(4,0));await a.playFromHand(book.uid);
 assert.equal(a.state.actions,2);assert.equal(a.state.players[0].hand.length,2);assert.equal(a.choiceHistory.length,0);
});
test('discarded dead eyes belongs to the player paying the hand cost, regardless of original deck',async()=>{
 for(const mode of ['single','double'])for(const origin of [0,1]){
  const a=setup(mode);a.state.turn=1;const book=a.card(111,1),cost=a.card(6,origin),own=a.card(8,1),enemy=a.card(8,0);putOnField(a,own,1);putOnField(a,enemy,0);a.state.players[1].hand=[book,cost];a.choices('charge',cost.uid);a.pick(slot(1));
  await a.playFromHand(book.uid);assert.equal(enemy.atkMod,-5);assert.equal(own.atkMod,0);assert.ok(a.graveFor(mode==='double'?origin:1).includes(cost));
 }
});
test('a stolen destruction trap waits for its new opponent end phase and returns to its original grave',async()=>{
 const a=setup(),n=a.card(9,0),t=trap(a,110,1);await a.summon(n,0,0);await a.resolvePending();
 await a.endTurn();assert.equal(a.state.turn,1);assert.equal(a.state.players[0].magic[0],t);
 await a.endTurn();assert.equal(a.state.players[0].magic[0],null);assert.ok(a.graveFor(1).includes(t));assert.ok(a.graveFor(0).includes(n));
});
test('guardian is set with one AP without executing the removed draw/reset effect',async()=>{
 const a=setup(),t=a.card(109,0);a.state.players[0].hand=[t];const count=a.deckFor(0).length;a.pick({p:0,l:0,zone:'magic'});await a.playFromHand(t.uid);
 assert.equal(a.state.actions,1);assert.equal(a.state.players[0].magic[0],t);assert.equal(t.faceDown,true);assert.equal(a.deckFor(0).length,count);assert.equal(a.state.players[0].hand.length,0);
});
test('CPU can choose the new golem-removal effect over charge when both are available',()=>{
 const a=setup();a.setCpu();assert.equal(a.cpuPickOption('魔導の書 チョイス',[{label:'相手の錆びたゴーレム1体を墓地へ送る',value:'golem'},{label:'自分のモンスターに突撃を付与しAP+1',value:'charge'}]),0);
});
