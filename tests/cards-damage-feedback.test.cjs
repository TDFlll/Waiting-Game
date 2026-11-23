const {test}=require('node:test'),assert=require('node:assert/strict');const {game,emptyHands}=require('./cards-harness.cjs');
function setup(){const g=game();emptyHands(g.api);g.api.state.turn=0;g.api.state.actions=2;return g;}
test('damage feedback highlights only the damaged player and clears after its reserved duration',()=>{
 const g=setup(),a=g.api;a.damage(0,1,'直接攻撃');assert.equal(g.node('damageFeedback1').children[0].textContent,'P1 ダメージ −1');assert.equal(g.node('score1').classList.contains('damageHit'),true);assert.equal(g.node('score2').classList.contains('damageHit'),false);assert.equal(g.node('damageFeedback2').children.length,0);
 g.advance(899);assert.equal(g.node('damageFeedback1').children.length,1);g.advance(1);assert.equal(g.node('damageFeedback1').children.length,0);assert.equal(g.node('score1').classList.contains('damageHit'),false);
});
test('successive hits queue in the target panel while both players can animate independently',()=>{
 const g=setup(),a=g.api;a.state.players.forEach(p=>p.life=30);a.damage(0,1,'first');a.damage(0,2,'second');a.damage(1,3,'third');assert.match(g.node('damageFeedback1').children[0].textContent,/−1$/);assert.match(g.node('damageFeedback2').children[0].textContent,/−3$/);
 g.advance(900);assert.match(g.node('damageFeedback1').children[0].textContent,/−2$/);assert.equal(g.node('damageFeedback2').children.length,0);g.advance(900);assert.equal(g.node('damageFeedback1').children.length,0);assert.equal(g.timerCount,0);assert.equal(a.state.lifeEvents.length,3);
});
test('the lethal hit locks the game immediately but the win screen waits for the hit and then replays the battle log',()=>{
 const g=setup(),a=g.api;a.state.players[1].life=1;a.damage(1,1,'直接攻撃',{player:0,name:'失笑ライダー'});assert.equal(a.state.gameover,true);assert.equal(a.state.players[1].life,0);assert.equal(g.node('gameover').classList.contains('hidden'),true);assert.match(g.node('damageFeedback2').children[0].textContent,/ダメージ −1/);
 a.damage(0,1,'after finish');assert.equal(a.state.players[0].life,4);g.advance(900);assert.equal(g.node('gameover').classList.contains('hidden'),false);assert.equal(g.node('battleLogList').children.length,0);g.advance(1000);assert.equal(g.node('battleLogList').children.length,1);
});
test('a finishing hit replaces a queued smaller hit so the lethal damage itself is visible before the result',()=>{
 const g=setup(),a=g.api;a.state.players[1].life=4;a.damage(1,1,'first');a.damage(1,3,'finish');assert.match(g.node('damageFeedback2').children[0].textContent,/−3$/);g.advance(900);assert.equal(g.node('gameover').classList.contains('hidden'),false);assert.equal(g.node('damageFeedback2').children.length,0);
});
test('MAGIC labels paid life as a cost and its free use at one life adds no animation',async()=>{
 const g=setup(),a=g.api;a.state.players[0].life=2;for(let i=0;i<2;i++){a.choices('draw',opts=>opts[0].value);await a.useMagic()}
 assert.equal(g.node('damageFeedback1').children[0].textContent,'P1 コスト −1');assert.equal(a.state.lifeEvents.length,1);g.advance(900);assert.equal(g.node('damageFeedback1').children.length,0);assert.equal(g.timerCount,0);
});
test('returning to title clears active and queued effects and cancels delayed gameover',()=>{
 const g=setup(),a=g.api;a.state.players[1].life=1;a.damage(0,1,'first');a.damage(0,1,'second');a.damage(1,1,'finish');a.showTitle();assert.equal(g.timerCount,0);g.advance(3000);assert.equal(g.node('damageFeedback1').children.length,0);assert.equal(g.node('damageFeedback2').children.length,0);assert.equal(g.node('gameover').classList.contains('hidden'),true);
});
test('fresh games have no stale feedback or delayed result callback',()=>{
 const g=setup(),a=g.api;a.state.players[1].life=1;a.damage(1,1,'finish');a.init('double');g.advance(3000);assert.equal(a.state.gameover,false);assert.equal(a.state.players[1].life,4);assert.equal(g.node('damageFeedback2').children.length,0);assert.equal(g.timerCount,0);
});
