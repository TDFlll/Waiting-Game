const {test}=require('node:test'),assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(mode='double',attackerP=0,ids=[8,6]){const g=game(mode),a=g.api;emptyHands(a);a.state.turn=attackerP;a.state.turnNo=3;a.state.actions=2;const defender=1-attackerP,attacker=a.card(ids[0],attackerP),own=ids[1]===null?null:a.card(ids[1],defender),trap=a.card(105,defender);putOnField(a,attacker,attackerP);attacker.summonedTurn=2;if(own)putOnField(a,own,defender);trap.faceDown=true;trap.controller=defender;trap.zone='magic';trap.lane=0;a.state.players[defender].magic[0]=trap;return {...g,attackerP,defender,attacker,own,trap};}
test('escape returns both same-lane monsters before drawing once for each player in both deck modes and attack directions',async()=>{
 for(const mode of ['single','double'])for(const p of [0,1]){const {api:a,attacker,own,defender,trap}=setup(mode,p);const before=[a.deckFor(0).length,a.deckFor(1).length];const other=a.card(12,defender);putOnField(a,other,defender,1);
  assert.equal(await a.triggerAttackTraps(p,0,attacker,false),true);assert.equal(a.state.players[p].monster[0],null);assert.equal(a.state.players[defender].monster[0],null);assert.equal(a.state.players[defender].monster[1],other);assert.ok(a.state.players[p].hand.includes(attacker));assert.ok(a.state.players[defender].hand.includes(own));
  assert.equal(a.state.players[p].hand.length,2);assert.equal(a.state.players[defender].hand.length,2);assert.equal(a.deckFor(0).length,before[0]-(mode==='single'?2:1));assert.equal(a.deckFor(1).length,before[1]-(mode==='single'?2:1));assert.ok(a.graveFor(defender).includes(trap));assert.ok(!a.graveFor(defender).includes(own));assert.equal(a.state.pending.length,0);
  const lastReturn=Math.max(...a.state.log.map((s,i)=>s.includes('の手札へ戻す')?i:-1)),firstDraw=a.state.log.findIndex(s=>s.includes('枚ドロー'));assert(lastReturn<firstDraw);assert.equal(a.state.actions,2);assert.equal(a.state.lifeEvents.length,0);
 }
});
test('an empty defender lane returns the attacker and only that recipient draws',async()=>{
 const {api:a,attacker,defender}=setup('double',0,[8,null]);const other=a.card(12,defender);putOnField(a,other,defender,1);const before=a.deckFor(defender).length;assert.equal(await a.triggerAttackTraps(0,0,attacker,true),true);assert.equal(a.state.players[0].hand.length,2);assert.equal(a.state.players[defender].hand.length,0);assert.equal(a.deckFor(defender).length,before);assert.equal(a.state.players[defender].monster[1],other);
});
test('each trap-immune monster stays on the field and its player does not draw',async()=>{
 for(const ids of [[7,8],[8,7],[7,7]]){const {api:a,attacker,own,trap}=setup('double',0,ids);const cancelled=await a.triggerAttackTraps(0,0,attacker,false);assert.equal(cancelled,ids[0]!==7);assert.equal(a.state.players[0].monster[0],ids[0]===7?attacker:null);assert.equal(a.state.players[1].monster[0],ids[1]===7?own:null);assert.equal(a.state.players[0].hand.length,ids[0]===7?0:2);assert.equal(a.state.players[1].hand.length,ids[1]===7?0:2);assert.ok(a.graveFor(1).includes(trap));}
});
test('a trap-immune attacker continues attacking after the defender returns to hand',async()=>{
 const {api:a,attacker,own}=setup('double',0,[7,8]);a.pick({p:0,l:0,zone:'monster'});await a.attackFlow();assert.equal(a.state.players[1].life,3);assert.equal(a.state.lifeEvents[0].sourceName,'反魔の死人');assert.equal(a.state.players[0].monster[0],attacker);assert.ok(a.state.players[1].hand.includes(own));assert.equal(a.state.actions,1);
});
test('normal attack is cancelled after both monsters return and no life-loss event is generated',async()=>{
 const {api:a}=setup();a.pick({p:0,l:0,zone:'monster'});await a.attackFlow();assert.equal(a.state.players[0].life,4);assert.equal(a.state.players[1].life,4);assert.equal(a.state.lifeEvents.length,0);assert.equal(a.state.actions,1);
});
test('controlled cards return to the existing return destination, and one player receiving both cards draws only once',async()=>{
 const {api:a,attacker,own}=setup('double',1,[4,8]);attacker.returnTo=0;attacker.originalDeck=0;const before=a.deckFor(0).length;assert.equal(await a.triggerAttackTraps(1,0,attacker,false),true);assert.equal(attacker.returnTo,null);assert.ok(a.state.players[0].hand.includes(attacker));assert.ok(a.state.players[0].hand.includes(own));assert.equal(a.state.players[0].hand.length,3);assert.equal(a.state.players[1].hand.length,0);assert.equal(a.deckFor(0).length,before-1);
});
test('a trap in another lane does not activate or draw, while exhausted decks never prevent returning the monsters',async()=>{
 {const {api:a,attacker,trap}=setup();a.state.players[1].magic[0]=null;a.state.players[1].magic[1]=trap;assert.equal(await a.triggerAttackTraps(0,0,attacker,false),false);assert.equal(a.state.players[1].magic[1],trap);assert.equal(a.state.players[0].hand.length,0);}
 {const {api:a,attacker,own}=setup();a.deckFor(0).length=a.deckFor(1).length=0;assert.equal(await a.triggerAttackTraps(0,0,attacker,false),true);assert.equal(a.state.players[0].hand[0],attacker);assert.equal(a.state.players[1].hand[0],own);assert.equal(a.state.players[0].hand.length,1);assert.equal(a.state.players[1].hand.length,1);}
});
test('CPU uses the same return and conditional draw rules and the card name stays unchanged',async()=>{
 const {api:a,attacker}=setup();a.setCpu();assert.equal(a.bases.find(c=>c.id===105).name,'脱出の儀');assert.match(a.bases.find(c=>c.id===105).text,/その後/);await a.triggerAttackTraps(0,0,attacker,false);assert.equal(a.state.players[0].hand.length,2);assert.equal(a.state.players[1].hand.length,2);
});
