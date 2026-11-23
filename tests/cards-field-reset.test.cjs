const {test}=require('node:test'),assert=require('node:assert/strict');const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
const slot=(p,l=0)=>({p,l,zone:'monster'});
function setup(mode='double'){const g=game(mode);emptyHands(g.api);g.api.state.turn=0;g.api.state.turnNo=3;g.api.state.actions=2;return g;}
function modified(a,id,p,amount){const c=a.card(id,p);c.atkMod=amount;c.halfCount=1;c.turnAtkBonus=3;c.bonusTurn=a.state.turnNo;c.battleCount=2;return c;}
function initial(a,c){assert.equal(a.cardAtk(c),c.atk);assert.equal(c.atkMod,0);assert.equal(c.halfCount,0);assert.equal(c.turnAtkBonus,0);assert.equal(c.bonusTurn,null);assert.equal(c.battleCount,0);}
test('escape ritual resets both increased and decreased ATK, temporary bonuses, halves and golem battle count in the returned hands',async()=>{
 for(const mode of ['single','double']){const {api:a}=setup(mode),attacker=modified(a,12,0,6),golem=modified(a,2,1,-4),t=a.card(105,1);attacker.summonCount=4;attacker.handSummonCount=2;putOnField(a,attacker);putOnField(a,golem,1);t.faceDown=true;t.controller=1;a.state.players[1].magic[0]=t;await a.triggerAttackTraps(0,0,attacker,false);initial(a,attacker);initial(a,golem);assert.equal(attacker.summonCount,4);assert.equal(attacker.handSummonCount,2);assert.ok(a.state.players[0].hand.includes(attacker));assert.ok(a.state.players[1].hand.includes(golem));}
});
test('grave removal, destruction of a whole lane and banishing all reset field modifiers',async()=>{
 for(const mode of ['single','double'])for(const route of ['grave','lane','banish','descriptor']){const {api:a}=setup(mode),c=modified(a,2,0,-3);putOnField(a,c);if(route==='grave')await a.sendMonsterFromField(0,0,'test');else if(route==='lane')await a.destroyWholeLane(0,1,'test',false);else if(route==='descriptor')a.placeByDescriptor(a.removeLocated(a.locateCard(c.uid)),null);else a.banishMonsterFromField(0,0,'test');initial(a,c);assert.equal(a.state.players[0].monster[0],null);assert.equal(c.fieldExitCount,1);}
});
test('battle destruction resets the loser before it enters the grave and post-battle weakness cannot modify it again',async()=>{
 const {api:a}=setup(),loser=a.card(9,0),enemy=a.card(5,1);loser.atkMod=-1;putOnField(a,loser);putOnField(a,enemy,1);await a.monsterBattle(0,0);initial(a,loser);assert.ok(a.graveFor(0).includes(loser));assert.equal(loser.fieldExitCount,1);
});
test('golem forced destruction at its third battle resets to zero and revival starts a fresh set of three battles',async()=>{
 const {api:a}=setup(),golem=a.card(2,0),child=a.card(3,1);putOnField(a,golem);putOnField(a,child,1);
 for(let round=0;round<2;round++){for(let i=1;i<=3;i++){await a.monsterBattle(0,0);assert.equal(golem.battleCount,i<3?i:0);assert.equal(a.state.players[0].monster[0]===golem,i<3)}initial(a,golem);assert.ok(a.graveFor(0).includes(golem));if(!round){a.choices(golem.uid);await a.revivalEffect(0,0);assert.equal(golem.battleCount,0);}}
});
test('magic book checks ATK before banishing and the excluded monster then has its initial stats',async()=>{
 const {api:a}=setup(),c=a.card(6,1),book=a.card(111,0),cost=a.card(100,0);c.atkMod=5;c.battleCount=2;putOnField(a,c,1);a.state.players[0].hand=[book,cost];a.choices('banish',cost.uid);a.pick(slot(1));await a.playFromHand(book.uid);assert.ok(a.state.banished.includes(c));initial(a,c);
});
test('evolution exchange resets the outgoing dragon when it moves from the field to a hand',async()=>{
 const {api:a}=setup(),dragon=modified(a,1,0,5),child=a.card(3,0);putOnField(a,dragon);a.state.players[0].hand=[child];a.choices('transform');a.pick(slot(0));assert.equal(await a.transformEffect(0),true);assert.ok(a.state.players[0].hand.includes(dragon));initial(a,dragon);assert.equal(a.state.players[0].monster[0],child);
});
test('changing controller or exchanging field slots does not reset attack or battle count until the card actually leaves the field',async()=>{
 const {api:a}=setup(),golem=a.card(2,0),sacrifice=a.card(8,1),counter=a.card(101,1);golem.atkMod=-3;golem.battleCount=2;putOnField(a,golem);putOnField(a,sacrifice,1);counter.faceDown=true;counter.controller=1;a.state.players[1].magic[0]=counter;a.choices('yes');await a.triggerAttackTraps(0,0,golem,false);assert.equal(a.cardAtk(golem),8);assert.equal(golem.battleCount,2);assert.equal(golem.fieldExitCount,0);
 const escape=a.card(105,0);escape.faceDown=true;escape.controller=0;a.state.players[0].magic[0]=escape;await a.triggerAttackTraps(1,0,golem,true);assert.ok(a.state.players[0].hand.includes(golem));initial(a,golem);
});
test('a dragon exchanged between two field slots retains its modifiers because it stays on the field',async()=>{
 const {api:a}=setup(),dragon=a.card(1,0),child=a.card(3,1);a.state.decks[0]=a.deckFor(0).filter(c=>c.id!==3);dragon.atkMod=3;child.atkMod=4;putOnField(a,dragon);putOnField(a,child,1);a.choices('transform');a.pick(slot(0));await a.transformEffect(0);assert.equal(a.cardAtk(dragon),15);assert.equal(a.cardAtk(child),5);assert.equal(dragon.fieldExitCount,0);assert.equal(child.fieldExitCount,0);
});
test('saved field restoration cannot resurrect ATK modifiers or golem counts that expired when leaving the field',async()=>{
 const {api:a}=setup(),golem=a.card(2,0);golem.atkMod=-3;golem.battleCount=2;putOnField(a,golem);a.saveSnapshot(0);await a.sendMonsterFromField(0,0,'test');a.rewindOwnField(0);initial(a,golem);assert.equal(a.state.players[0].monster[0],golem);assert.equal(golem.fieldExitCount,1);
 golem.atkMod=3;golem.battleCount=1;a.saveSnapshot(0);golem.atkMod=8;golem.battleCount=2;a.rewindOwnField(0);assert.equal(golem.atkMod,3);assert.equal(golem.battleCount,1);assert.equal(golem.fieldExitCount,1);
});
test('faith recovers the reset base card and hatred applies a fresh plus two on each later entry without carrying the previous bonus',async()=>{
 const {api:a}=setup(),angel=a.card(12,0);await a.summon(angel,0,0,false,true);angel.atkMod=7;await a.sendMonsterFromField(0,0,'test');initial(a,angel);const costs=[a.card(100,0),a.card(103,0)];a.state.players[0].hand=costs;a.choices(angel.uid,...costs.map(c=>c.uid));await a.faithStartOption(0);assert.equal(a.cardAtk(angel),10);assert.equal(angel.summonCount,1);a.pick(slot(0));await a.playFromHand(angel.uid);assert.equal(a.cardAtk(angel),12);await a.sendMonsterFromField(0,0,'test');initial(a,angel);a.choices(angel.uid);await a.revivalEffect(0,0);assert.equal(a.cardAtk(angel),12);assert.equal(angel.summonCount,3);
});
test('necromancer reads the initial ATK of a grave monster after its field buffs have expired',async()=>{
 const {api:a}=setup(),ref=a.card(4,0),n=a.card(9,0);ref.atkMod=5;putOnField(a,ref);await a.sendMonsterFromField(0,0,'test');a.choices(ref.uid);await a.summon(n,0,0);await a.resolvePending();assert.equal(a.cardAtk(ref),7);assert.equal(a.cardAtk(n),9);assert.ok(a.graveFor(0).includes(ref));
});
