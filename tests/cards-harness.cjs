const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(mode='double',seed=1){
 const nodes=new Map();
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set();
  const e={innerHTML:'',textContent:'',style:{},children:[],disabled:false,
   classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)},toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c)}},
   appendChild(c){this.children.push(c)},append(c){this.children.push(c)},querySelectorAll(){return []},setAttribute(){}};
  nodes.set(id,e);return e;
 }
 const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const context=vm.createContext({Math:math,document:{readyState:'loading',addEventListener(){},getElementById:node,querySelector:node,querySelectorAll:()=>[],createElement:()=>node('new'+nodes.size),createTextNode:t=>({textContent:t})},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout(){},clearTimeout(){},console});
 const code=fs.readFileSync(path.join(__dirname,'../games/cards.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInContext(code+`
 const realRender=render,realShowHandoff=showHandoff,realLog=log;
 let scriptedChoices=[],fieldChoice=null,fieldChoices=[],choiceHistory=[];
 choose=async (title,options)=>{choiceHistory.push({title,options});const requested=scriptedChoices.shift();return typeof requested==='function'?requested(options):requested===undefined?options[0]?.value:requested};
 chooseFieldSlot=async()=>fieldChoices.length?fieldChoices.shift():fieldChoice;
 withDecisionPlayer=async(player,label,fn)=>fn();
 render=renderLog=showCardEffect=showEventToast=clearDigestBanners=showHandoff=function(){};
 log=function(t){S.log.push(t);S.turnEvents.push(t)};
 window.api={get state(){return S},get bases(){return BASE_CARDS},init(mode){uid=1;DECK_MODE=mode;S=newState();busy=false;scriptedChoices=[];fieldChoice=null;fieldChoices=[];choiceHistory=[]},
 get uid(){return uid},get choiceHistory(){return choiceHistory},playFromHand,specialSummonDragon,resolveMagicEffect,activateInstant,forgeryEffect,vampireEffect,attackFlow,triggerAttackTraps,cpuAttackScore,cpuCardScore,cpuPickField,cpuPickOption,cpuMaybeMagic,canAttack,cardAtk,pierceValue,gainPierceEmblem,emblemOptions,graveFor,graveEntries,putGrave,sendGrave,sendMonsterFromField,destroyWholeLane,monsterBattle,revivalEffect,magicBookEffect,faithStartOption,resolvePending,showGrave,
 deckFor,deckEntries,draw,handLimit,applyDebilitate,necromancerEffect,swapPotEffect,transformEffect,findAnywhere,locateCard,captureLocations,removeLocated,placeByDescriptor,saveSnapshot,rewindOwnField,checkStalemate,summon,takeGrave,cloneCard,useMagic,startTurn,endTurn,showRules,realRender,realShowHandoff,realLog,summarizeTurn,showDigestBanners,
 choices(...v){scriptedChoices=v},pick(v){fieldChoice=v},picks(...v){fieldChoices=v},setCpu(){GAME_MODE='CPU'},
 card(id,p){const c=cloneCard(BASE_CARDS.find(b=>b.id===id));c.originalDeck=p;return c}
 };
 `,context);
 const api=context.window.api;api.init(mode);
 return {api,node,all(){return [...api.state.players.flatMap(p=>[...p.hand,...p.monster.filter(Boolean),...p.magic.filter(Boolean)]),...api.graveEntries().flatMap(e=>e.grave),...api.deckEntries().flatMap(e=>e.deck)]}};
}

function putOnField(api,card,p=0,l=0){card.controller=p;card.zone='monster';card.lane=l;api.state.players[p].monster[l]=card}
function emptyHands(api){api.state.players.forEach(p=>{p.hand=[]})}


module.exports={game,putOnField,emptyHands};
