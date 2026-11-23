const {test}=require('node:test'),assert=require('node:assert/strict');const {game}=require('./robots-harness.cjs');
test('two to four players receive exactly player-count plus two distinct shared draft candidates',()=>{
 for(const n of [2,3,4]){const {api:a}=game([],n);a.startDraft();assert.equal(a.draftOptions.length,n+2);assert.equal(new Set(a.draftOptions.map(x=>x.id)).size,n+2);assert.equal(a.phase,'draft');}
});
test('every player can choose the same candidate and duplicate an owned ability without removing the shared offer',()=>{
 for(const n of [2,3,4]){const {api:a}=game(Array.from({length:n},()=>[1]),n);a.players.forEach((p,i)=>p.score=i);a.startDraft();const ids=[1,2,4,7,10,12].slice(0,n+2);a.draftOptions.splice(0,a.draftOptions.length,...ids.map(id=>a.abilities.find(x=>x.id===id)));a.renderDraft();const offered=Array.from(a.draftOptions,x=>x.id),order=Array.from(a.draftOrder);
  for(const who of order){assert.equal(a.takeDraftAbility(who,1),true);assert.deepEqual(Array.from(a.draftOptions,x=>x.id),offered)}assert.ok(a.players.every(p=>a.abilityCount(p,1)===2));assert.equal(a.round,2);assert.equal(a.phase,'input');
 }
});
test('former unique abilities are selectable by every player and do not carry exclusive metadata',()=>{
 const {api:a}=game([[3,6],[3,6]]);assert.ok(!a.abilities.find(x=>x.id===3).unique);assert.ok(!a.abilities.find(x=>x.id===6).unique);a.startDraft();for(const id of [3,6])assert.ok(a.players.every(p=>a.canTakeDraftAbility(p,a.abilities.find(x=>x.id===id))));
});
test('duplicate actions share one action slot while both input and execution use the summed charge limit',()=>{
 const {api:a}=game([1,1,1,2,5]);const p=a.players[0];assert.deepEqual(Array.from(a.actionAbs(p),x=>x.id),[1,2,5]);assert.equal(a.abilityUseLimit(p,1),3);
 for(let i=0;i<4;i++){a.startActionInput(a.abilities.find(x=>x.id===1));a.chooseActionDir('R')}assert.equal(p.cmds.filter(c=>c.id===1).length,3);for(let i=0;i<3;i++){assert.equal(a.runtimeCanUse(p,1),true);a.consumeUse(p,1)}assert.equal(a.runtimeCanUse(p,1),false);a.setupRound();assert.equal(a.abilityUseLimit(p,1),3);assert.equal(a.runtimeCanUse(p,1),true);
});
test('an existing action can be acquired at the three-kind cap, but a new fourth action remains unavailable',()=>{
 const {api:a,node}=game([1,1,2,5]);a.startDraft();a.draftOptions.splice(0,a.draftOptions.length,...[1,8,4,12].map(id=>a.abilities.find(x=>x.id===id)));a.renderDraft();const p=a.players[a.draftOrder[0]];if(p===a.players[1]){p.abilities=[1,1,2,5];a.renderDraft()}assert.equal(a.canTakeDraftAbility(p,a.abilities.find(x=>x.id===1)),true);assert.equal(a.canTakeDraftAbility(p,a.abilities.find(x=>x.id===8)),false);const forbidden=node('draftGrid').children.find(x=>x.dataset.abilityId==='8');assert.equal(forbidden.disabled,true);assert.equal(a.takeDraftAbility(a.draftOrder[0],8),false);
});
test('a saturated action player always gets an available candidate even if the first random offer is all new actions',()=>{
 const {api:a}=game([[1,2,5],[1,2,5]]);const preferred=[8,9,11,15].map(id=>a.abilities.find(x=>x.id===id));const pool=preferred.concat(Array.from(a.abilities).filter(x=>!preferred.includes(x)));const options=a.buildDraftOptions(pool);assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.id)).size,4);assert.ok(a.players.every(p=>options.some(x=>a.canTakeDraftAbility(p,x))));
});
test('knife copies add passive activation charges rather than triggering several times for one collision',()=>{
 const {api:a}=game([7,7]);const p=a.players[0],other=a.players[1];other.score=20;for(let i=0;i<5;i++)a.handleCollisionPassives([[0,1],[1,0]]);assert.equal(a.abilityUseLimit(p,7),4);assert.equal(p.used[7],4);assert.equal(other.score,16);
});
test('always-on copies stack point multipliers, command capacity and generated gems',()=>{
 const {api:a}=game([4,4,12,12,14,14,16,16]);const p=a.players[0];assert.equal(a.commandLimit(p),20);a.setRound(3);assert.equal(a.commandLimit(p),22);a.setTreasures([{r:p.r,c:p.c,value:2,taken:false}]);assert.equal(a.collectTreasure(p,p.r,p.c),8);assert.equal(a.treasures.filter(x=>!x.taken).length,2);const before=p.score;a.handleCollisionPassives([[0,1]]);assert.equal(p.score,before-2);
});
test('avenger and overclock copies add their per-copy bonuses to each hit',()=>{
 const {api:a}=game([10,10,13,13]);const p=a.players[0],other=a.players[1];p.r=2;p.c=1;other.r=2;other.c=2;other.score=20;const before=p.score;a.hitAbility(p,other,1,0);assert.equal(other.score,17);assert.equal(p.score,before+4);a.hitAbility(p,other,1,1);assert.equal(other.c,5);assert.equal(p.score,before+8);assert.equal(p.abilityHits,2);
});
test('computation copies increase peek length and put more copies later in the input order',()=>{
 const {api:a,node}=game([[6,6],[6],[],[6,6,6]],4);a.buildInputOrder();assert.deepEqual(Array.from(a.inputOrder),[2,1,0,3]);a.setCurrent(0);a.players[1].cmds=Array.from({length:10},()=>({type:'move',dir:'U'}));a.realRenderPeek();const text=node('peekArea').children[0].textContent;assert.match(text,/先頭8手/);assert.equal((text.match(/▲/g)||[]).length,8);
});
test('shared electric shock stops tied eligible owners and lets the only remaining eligible owner use its added charge',()=>{
 for(const exhausted of [false,true]){const g=game([[3,3],[3]]),a=g.api,p=a.players[0],other=a.players[1];p.r=other.r=2;p.c=1;other.c=3;p.cmds=[{type:'move',dir:'R'}];other.cmds=[{type:'move',dir:'L'}];if(exhausted)other.used[3]=1;a.runStep();g.flush();assert.equal(p.c,exhausted?2:1);assert.equal(other.c,3);assert.equal(p.used[3]||0,exhausted?1:0);assert.equal(a.abilityUseLimit(p,3),2);assert.equal(a.runtimeCanUse(p,3),true);}
});
test('multiple copies allow repeated real action execution and enforce the summed limit',()=>{
 const g=game([16,2,2]),a=g.api,p=a.players[0];p.cmds=[{type:'action',id:2,dirs:['R']},{type:'action',id:2,dirs:['R']},{type:'action',id:2,dirs:['R']},{type:'move',dir:'D'}];let done=false;a.executeActions(()=>done=true,true);g.flush();assert.equal(done,true);assert.equal(p.used[2],2);assert.equal(a.runtimeCanUse(p,2),false);assert.equal(a.players[1].reverse,true);
});
test('ability display groups copies and shows combined round charges',()=>{
 const {api:a,node}=game([1,1,7,7]);a.realRenderRoster();const card=node('abilityRoster').children[1];const details=card.children.slice(1);assert.equal(details.length,2);assert.match(details[0].innerHTML,/ダッシュ ×2/);assert.match(details[0].innerHTML,/合計 2回/);assert.match(details[1].innerHTML,/合計 4回/);
});
test('returning from final results preserves settings and the next game restores the board with fresh match state',()=>{
 const g=game([],3,{custom:true,colorRoad:false,initialMode:'choose',selectedInitial:[1,12]}),a=g.api;const before=JSON.stringify(a.settings);a.endGame();assert.equal(a.phase,'result');assert.ok(g.node('boardPanel').classList.contains('hidden'));g.node('titleReturnBtn').onclick();assert.equal(a.phase,'setup');assert.equal(a.players.length,0);assert.equal(JSON.stringify(a.settings),before);assert.equal(g.node('setupPanel').classList.contains('hidden'),false);assert.equal(g.node('game').classList.contains('hidden'),true);a.newGame(2);assert.equal(a.players.length,3);assert.ok(a.players.every(p=>p.score===0&&p.abilities.join(',')==='1,12'));assert.equal(g.node('boardPanel').classList.contains('hidden'),false);assert.equal(a.startingInput,2);assert.equal(g.reloads,0);
});
test('play again retains settings, asks for a new starting player and cancellation preserves the final result',async()=>{
 const g=game([],4,{custom:false,colorRoad:true,initialMode:'choose',selectedInitial:[4,12]}),a=g.api;const before=JSON.stringify(a.settings);a.endGame();const players=a.players;g.setStarter(null);await g.node('restartBtn').onclick();assert.equal(a.players,players);assert.equal(a.phase,'result');g.setStarter(1);await g.node('restartBtn').onclick();assert.notEqual(a.players,players);assert.equal(a.players.length,4);assert.ok(a.players.every(p=>p.abilities.length===0));assert.equal(JSON.stringify(a.settings),before);assert.equal(a.startingInput,1);assert.equal(g.reloads,0);
});
