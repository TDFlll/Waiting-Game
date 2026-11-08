const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function memory(){
  const nodes=new Map();
  function element(){return {children:[],style:{},classList:{add(){},remove(){},toggle(){}},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(){},showModal(){},close(){}};}
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},createElement:element};
  const context=vm.createContext({document,localStorage:{getItem(){return JSON.stringify(['花子<img>','太郎'])}},window:{},console,setTimeout:fn=>{fn()}});
  const html=fs.readFileSync(path.join(__dirname,'../games/memory-line.html'),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script.replace(/\}\)\(\);\s*$/,`window.api={start,place,undo,legal,call,anyOwnerLine,completedByLast,createsDoubleThree,render,settings,
    state:()=>({board,turn,first,moves,hands,selected,history,ended,result,locked}),
    set(values){if(values.board)board=values.board;if(values.turn)turn=values.turn;if(values.first)first=values.first;if(values.moves!==undefined)moves=values.moves;},
    options:game};})();`),context);
  const api=context.window.api;
  return {api,node:id=>document.getElementById(id),begin(options={}){Object.assign(api.settings,options);api.start();}};
}
const piece=(owner=1,color=0,shape=0)=>({owner,color,shape});
const blank=()=>Array(81).fill(null);
test('selected P2 opening owns the first placed piece and undo retains that opening player',()=>{
 const {api}=memory();api.start(2);assert.equal(api.state().first,2);assert.equal(api.state().turn,2);api.place(40);assert.equal(api.state().board[40].owner,2);api.undo();assert.equal(api.state().first,2);assert.equal(api.state().turn,2);assert.equal(api.state().moves,0);
});

test('first move is unrestricted, normal adjacency and undo preserve pieces and turn',()=>{
  const m=memory();m.begin();const {api}=m;
  assert.equal(Array.from({length:81},(_,i)=>api.legal(i)).filter(Boolean).length,81);
  const turn=api.state().turn;api.place(40);
  assert.equal(api.legal(30),true);assert.equal(api.legal(20),false);assert.equal(api.legal(40),false);
  api.undo();assert.equal(api.state().moves,0);assert.equal(api.state().turn,turn);
});
test('advanced mode permits distance two and replenishes a hand only on its owner next turn',()=>{
  const m=memory();m.begin({advanced:true});const {api}=m;
  const first=api.state().turn;api.place(40);
  assert.equal(api.state().hands[first][0],null);assert.equal(api.legal(20),true);assert.equal(api.legal(10),false);
  api.place(39);assert.ok(api.state().hands[first][0]);
});
test('normal owner line wins automatically and undo hides ownership again',()=>{
  const m=memory();m.begin();const {api}=m,b=blank();
  for(let i=36;i<40;i++)b[i]=piece(1);
  api.set({board:b,turn:1,moves:4});api.place(40);
  assert.equal(api.state().result,'1');assert.equal(api.state().ended,true);
  api.undo();assert.equal(api.state().ended,false);assert.equal(api.state().board[40],null);
});
test('advanced mixed-owner five colors and five shapes are independent wins',()=>{
  const m=memory();m.begin({advanced:true});const {api}=m;
  for(const kind of ['color','shape']){
    const b=blank();for(let i=0;i<5;i++){b[36+i]=piece(i%2+1);b[36+i][kind]=i;}
    api.set({board:b});assert.ok(api.completedByLast(40,2));
  }
});
test('double-three rejects only the first player and consumes no move or hand',()=>{
  const m=memory();m.begin({advanced:true,doubleThree:true});const {api}=m,b=blank();
  for(const i of [39,41,31,49])b[i]=piece(1);
  api.set({board:b,turn:1,first:1,moves:4});const hand=JSON.stringify(api.state().hands);
  api.place(40);assert.equal(api.state().board[40],null);assert.equal(api.state().moves,4);
  assert.equal(JSON.stringify(api.state().hands),hand);assert.equal(api.state().history.length,0);
  b[40]=piece(2);api.set({board:b});assert.equal(api.createsDoubleThree(40,2),false);
});
test('CALL failure respects penalty and releases animation lock',async()=>{
  for(const penalty of [false,true]){
    const m=memory();m.begin({call:true,penalty});const {api}=m,turn=api.state().turn;
    await api.call();assert.equal(api.state().turn,penalty?3-turn:turn);assert.equal(api.state().locked,false);
  }
});
test('CALL owner-line success and undo restore the active match',async()=>{
  const m=memory();m.begin({call:true});const {api}=m,b=blank();
  for(let i=36;i<41;i++)b[i]=piece(1);
  api.set({board:b,turn:1,moves:5});await api.call();assert.equal(api.state().result,'1');
  api.undo();assert.equal(api.state().ended,false);
});
test('full-board failed CALL resolves a draw',async()=>{
  const m=memory();m.begin({call:true});const {api}=m,b=Array.from({length:81},(_,i)=>piece((Math.floor(i/9)+2*(i%9))%4<2?1:2));
  api.set({board:b,turn:1,moves:81});
  assert.equal(api.anyOwnerLine(1),null);await api.call();assert.equal(api.state().ended,true);assert.equal(api.state().result,'');
});
test('edge and opponent-blocked threes do not count as open threes',()=>{
  const m=memory();m.begin({doubleThree:true});const {api}=m,b=blank();
  for(const i of [0,1,2,9,18])b[i]=piece(1);
  api.set({board:b,first:1});assert.equal(api.createsDoubleThree(0,1),false);
  const c=blank();for(const i of [39,40,41,31,49])c[i]=piece(1);c[38]=piece(2);
  api.set({board:c});assert.equal(api.createsDoubleThree(40,1),false);
});
test('only the last placer may CALL an existing mixed color or shape line',async()=>{
  for(const kind of ['color','shape']){
    const m=memory();m.begin({advanced:true,call:true});const b=blank();
    // The center, rather than the last board index, completes the line for P2.
    for(let i=0;i<5;i++){b[36+i]={...piece(i===2?2:1),placedAt:[1,2,5,3,4][i]};b[36+i][kind]=i;}
    m.api.set({board:b,turn:1,moves:5});assert.equal(m.api.anyOwnerLine(1),null);assert.ok(m.api.anyOwnerLine(2));
    await m.api.call();assert.equal(m.api.state().ended,false);
    m.api.set({turn:2});await m.api.call();assert.equal(m.api.state().result,'2');
  }
});
test('placing and undoing a mixed winning line restores its CALL ownership',()=>{
  const m=memory();m.begin({advanced:true,call:true});const {api}=m,b=blank();
  const next=api.state().hands[1][0],others=[0,1,2,3,4].filter(c=>c!==next.color);
  for(let i=0;i<4;i++)b[36+i]={...piece(i%2+1,others[i],next.shape),placedAt:i+1};
  api.set({board:b,turn:1,moves:4});api.place(40);
  assert.equal(api.state().board[40].placedAt,5);assert.ok(api.anyOwnerLine(1));assert.equal(api.anyOwnerLine(2),null);
  api.undo();assert.equal(api.state().board[40],null);assert.equal(api.anyOwnerLine(1),null);
  api.place(40);assert.ok(api.anyOwnerLine(1));assert.equal(api.anyOwnerLine(2),null);
});
