const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function game(abilities=[16,2],count=2,options={}){
 const nodes=new Map(),timers=[];let seed=1,reloads=0,starter=0;
 function node(id){if(nodes.has(id))return nodes.get(id);const classes=new Set(),e={id,textContent:'',style:{},dataset:{},children:[],disabled:false,parentElement:null,classList:{add(...cs){cs.forEach(c=>classes.add(c))},remove(...cs){cs.forEach(c=>classes.delete(c))},contains(c){return classes.has(c)},toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c)}},appendChild(c){this.children.push(c)},querySelectorAll(){return []},setAttribute(){},focus(){}};let html='';Object.defineProperty(e,'innerHTML',{get(){return html},set(v){html=String(v);e.children=[]}});nodes.set(id,e);return e;}
 node('board').parentElement=node('boardWrap');node('boardWrap').parentElement=node('boardPanel');
 const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const window={wgChooseStarter:async()=>starter===null?null:{index:starter,mode:'manual'}};
 const context=vm.createContext({Math:math,window,document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('new'+nodes.size)},localStorage:{getItem(){return null}},location:{reload(){reloads++}},setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},console});
 let code=fs.readFileSync(path.join(__dirname,'../games/robots.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 code=code.replace(/\}\)\(\);\s*$/,`
 var realRenderScores=renderScores,realRenderRoster=renderAbilityRoster,realRenderPeek=renderPeek;
 window.api={get players(){return players},get abilities(){return AB},get step(){return step},get round(){return round},get phase(){return phase},get inputOrder(){return inputOrder},get draftOptions(){return draftOptions},get draftOrder(){return draftOrder},get draftPos(){return draftPos},get settings(){return {N,custom,colorRoad,initialMode,selectedInitial:selectedInitial.slice()}},get treasures(){return treasures},get startingInput(){return startingInput},
 setRound(n){round=n},setCurrent(i){current=i},setTreasures(list){treasures=list},abilityCount,abilityKinds,abilityUseLimit,abilityTotalText,has,actionAbs,actionSlot,runtimeCanUse,consumeUse,commandLimit,commandCount,programSteps,addCmd,startActionInput,chooseActionDir,cancelPendingAction,finishInput,executeActions,runStep,renderProgram,renderActionKeys,realRenderScores,realRenderRoster,realRenderPeek,collectTreasure,handleCollisionPassives,awardHit,hitAbility,buildInputOrder,buildDraftOptions,canTakeDraftAbility,startDraft,renderDraft,takeDraftAbility,setupRound,endRound,endGame,returnToTitle,newGame,requestNewGame,
 init(abs,count,opts){N=count;phase='input';current=0;gridSize=6;currentMap=null;custom=opts.custom!==false;colorRoad=!!opts.colorRoad;initialMode=opts.initialMode||'choose';selectedInitial=(opts.selectedInitial||[]).slice();treasures=[];roadOwners=[];round=1;step=0;draftPos=0;draftOptions=[];draftSelections=[];pendingAction=null;
  players=Array.from({length:N},function(_,i){var a=Array.isArray(abs[0])?abs[i]||[]:i===0?abs:[];return {abilities:a.slice(),cmds:[],r:2,c:i?4:1,startR:2,startC:i?4:1,score:5,roundScore:0,used:{},reverse:false,droneDue:null,roundHistory:[0,0,0],roadHistory:[0,0,0],contactHistory:[0,0,0],contacts:0,roundContacts:0,abilityHits:0,treasurePoints:0,colorRoadPoints:0}});
  renderBoard=renderScores=renderAbilityRoster=renderPeek=flashAction=fxActionName=fxBeamPlayers=fxBeamCells=fxReverseHit=fxLabelAtPlayer=fxRingAtPlayer=fxHammer=fxBurstAtPlayer=fxDroneLaunch=fxExplosionAtPlayer=fxVibration=fxJetFlame=function(){};
  centerForPlayer=function(){return null};animateMoves=function(intents,blocked,done){for(var i=0;i<N;i++)if(intents[i]&&!blocked[i]){players[i].r=intents[i].r;players[i].c=intents[i].c}done()};
 }};})();`);
 vm.runInContext(code,context);window.api.init(abilities,count,options);
 return {api:window.api,node,setStarter(i){starter=i},get reloads(){return reloads},flush(){let guard=0;while(timers.length){if(++guard>10000)throw Error('Timer loop');const fn=timers.shift();if(fn.name!=='runStep')fn()}}};
}
module.exports={game};
