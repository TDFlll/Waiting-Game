const {test}=require('node:test'),assert=require('node:assert/strict');
const {game,putOnField,emptyHands}=require('./cards-harness.cjs');
function setup(){const g=game('double');emptyHands(g.api);g.api.state.turn=0;g.api.state.actions=2;return g;}
test('result log records both players chronological life losses and reveals exactly one per second including the lethal hit',()=>{
 const g=setup(),a=g.api;a.state.turnNo=2;a.damage(1,1,'直接攻撃',{player:0,name:'失笑ライダー'});a.state.turnNo=3;a.damage(0,1,'直接攻撃',{player:1,name:'こどもドラゴン'});a.state.turnNo=4;a.damage(1,3,'直接攻撃',{player:0,name:'失笑ライダー'});
 assert.equal(a.state.lifeEvents.length,3);assert.equal(a.state.gameover,true);assert.match(g.node('gameoverTitle').textContent,/P1 WIN/);assert.equal(g.node('battleLogList').children.length,0);
 g.advance(899);assert.equal(g.node('gameover').classList.contains('hidden'),true);g.advance(1);assert.equal(g.node('gameover').classList.contains('hidden'),false);g.advance(999);assert.equal(g.node('battleLogList').children.length,0);g.advance(1);assert.equal(g.node('battleLogList').children.length,1);assert.equal(g.node('battleLogList').children[0].textContent,'2ターン P1 失笑ライダー → P2 −1');
 g.advance(1000);assert.equal(g.node('battleLogList').children[1].textContent,'3ターン P2 こどもドラゴン → P1 −1');g.advance(1000);assert.equal(g.node('battleLogList').children.length,3);assert.match(g.node('battleLogList').children[2].textContent,/4ターン.*P2 −3/);assert.equal(g.node('battleLogStatus').textContent,'全3件');assert.equal(g.timerCount,0);
 a.damage(0,1,'after finish');assert.equal(a.state.lifeEvents.length,3);
});
test('direct attacks record their actual attacking card, controller and turn',async()=>{
 const {api:a}=setup(),c=a.card(8,1);a.state.turn=1;a.state.turnNo=7;c.summonedTurn=6;putOnField(a,c,1);a.pick({p:1,l:0,zone:'monster'});await a.attackFlow();
 const event=a.state.lifeEvents[0];assert.equal(event.sourceName,'失笑ライダー');assert.equal(event.sourcePlayer,1);assert.equal(event.targetPlayer,0);assert.equal(event.turn,7);assert.equal(event.amount,1);assert.equal(event.lifeBefore,4);assert.equal(event.lifeAfter,3);
});
test('defensive piercing records the defending player as the damage source',async()=>{
 const {api:a}=setup(),attacker=a.card(9,0),drill=a.card(4,1);putOnField(a,attacker);putOnField(a,drill,1);a.state.turnNo=5;await a.monsterBattle(0,0);assert.equal(a.state.lifeEvents.length,1);const e=a.state.lifeEvents[0];assert.equal(e.sourcePlayer,1);assert.equal(e.targetPlayer,0);assert.equal(e.sourceName,'ドリルドリ（貫通）');
});
test('vampire life loss uses the effect controller while healing adds no damage log',async()=>{
 const {api:a}=setup();a.choices('life','heal');await a.vampireEffect(1);assert.equal(a.state.lifeEvents.length,1);const e=a.state.lifeEvents[0];assert.equal(e.sourceName,'吸血の書');assert.equal(e.sourcePlayer,1);assert.equal(e.targetPlayer,0);assert.equal(a.state.players[1].life,5);
});
test('MAGIC logs the cost once and the free activation at one life adds no false entry',async()=>{
 const {api:a}=setup();a.state.players[0].life=2;for(let i=0;i<2;i++){a.choices('draw',opts=>opts[0].value);await a.useMagic()}
 assert.equal(a.state.lifeEvents.length,1);const e=a.state.lifeEvents[0];assert.equal(e.sourceName,'MAGIC（コスト）');assert.equal(e.sourcePlayer,0);assert.equal(e.targetPlayer,0);assert.equal(a.state.players[0].life,1);
});
test('a draw with no life damage shows an empty-log message and creates no replay timer',()=>{
 const g=setup();g.api.finish(null,'引き分け');assert.equal(g.node('gameoverTitle').textContent,'DRAW');assert.equal(g.node('battleLogStatus').textContent,'ライフ減少の記録はありません。');assert.equal(g.timerCount,0);
});
test('leaving results cancels replay and a fresh game does not inherit the prior log',()=>{
 const g=setup(),a=g.api;a.damage(1,1,'test');a.finish(0,'test');assert.equal(g.timerCount,2);a.showTitle();assert.equal(g.timerCount,0);g.advance(3000);assert.equal(g.node('battleLogList').children.length,0);
 a.init('double');assert.equal(a.state.lifeEvents.length,0);a.finish(null,'new');g.advance(5000);assert.equal(g.node('battleLogList').children.length,0);
});
test('restarting a result replay never duplicates a scheduled row and ignores a replaced game state',()=>{
 const g=setup(),a=g.api;a.damage(1,1,'test');a.finish(0,'test');a.startBattleLogReplay();assert.equal(g.timerCount,2);g.advance(1000);assert.equal(g.node('battleLogList').children.length,1);
 a.startBattleLogReplay();a.init('double');g.advance(1000);assert.equal(g.node('battleLogList').children.length,0);
});
test('unrelated turn logs and non-damage changes never become life-loss events',()=>{
 const {api:a}=setup();a.realLog('秘密の手札情報');a.damage(0,0,'zero');a.damage(0,-1,'heal');assert.equal(a.state.lifeEvents.length,0);assert.equal(a.state.players[0].life,4);
});
