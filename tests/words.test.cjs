const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../games/words.html'),'utf8'),data=html.match(/<script id="word-data" type="application\/json">([\s\S]*?)<\/script>/)[1],dictionary=JSON.parse(data);
function tool(saved=new Map()){
 const nodes=new Map();function node(id){if(nodes.has(id))return nodes.get(id);const n={children:[],style:{},checked:false,disabled:false,value:'',textContent:'',listeners:{},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},addEventListener(event,fn){this.listeners[event]=fn},set innerHTML(v){this.children=[];this.html=v},get innerHTML(){return this.html||''}};nodes.set(id,n);return n;}
 node('word-data').textContent=data;const context=vm.createContext({document:{getElementById:node,createElement:()=>node('new'+nodes.size),querySelectorAll:()=>node('checks').children.map(label=>label.children[0])},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},confirm:()=>true});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1]+';this.api={pool,remainingPool};',context);
 return {node,api:context.api,saved,draw(){node('draw').onclick();return node('word-list').children.map(c=>c.children[1].textContent)},count(n){node('count').value=String(n);node('count').listeners.change()},only(i){node('none').onclick();const checkbox=node('checks').children[i].children[0];checkbox.checked=true;checkbox.listeners.change()},all(){node('all').onclick()}};
}
test('Words retains the supplied 30 categories and 960 embedded entries and samples unique words across categories',()=>{
 assert.equal(Object.keys(dictionary).length,30);for(const words of Object.values(dictionary))assert.equal(words.length,32);const entries=Object.values(dictionary).flat();assert.equal(entries.length,960);assert.equal(new Set(entries).size,954);
 const t=tool(),pool=t.api.pool();assert.equal(pool.length,954);assert.equal(new Set(pool.map(x=>x.word)).size,pool.length);assert.match(html,/waiting-words-v1/);
});
test('one to five words are drawn without duplicates within a batch or across its saved history',()=>{
 const t=tool(),history=[];for(let round=0;round<20;round++)for(let n=1;n<=5;n++){t.count(n);const words=t.draw();assert.equal(words.length,n);assert.equal(new Set(words).size,n);history.push(...words);}assert.equal(new Set(history).size,history.length);assert.equal(JSON.parse(t.saved.get('waiting-words-v1')).used.length,history.length);
});
test('category selection, clearing and insufficient-word notice do not reuse previous words',()=>{
 const t=tool();t.only(0);t.count(5);for(let i=0;i<6;i++)assert.equal(t.draw().length,5);assert.equal(t.api.remainingPool().length,2);assert.equal(t.node('draw').disabled,true);assert.match(t.node('notice').textContent,/5語未満/);const before=t.saved.get('waiting-words-v1');t.draw();assert.equal(t.saved.get('waiting-words-v1'),before);
 t.node('none').onclick();assert.equal(t.node('draw').disabled,true);assert.match(t.node('notice').textContent,/カテゴリを1つ以上/);t.all();assert.equal(t.node('checks').children.every(c=>c.children[0].checked),true);
});
test('settings and history survive reload and resetting history permits drawing again',()=>{
 const t=tool();t.only(0);t.count(4);const first=t.draw(),reload=tool(t.saved);assert.equal(reload.node('count').value,'4');assert.equal(reload.api.pool().length,32);assert.ok(reload.api.remainingPool().every(x=>!first.includes(x.word)));assert.equal(reload.api.remainingPool().length,28);
 reload.node('reset').onclick();assert.equal(reload.api.remainingPool().length,32);assert.equal(JSON.parse(t.saved.get('waiting-words-v1')).used.length,0);assert.equal(reload.draw().length,4);
});
test('Words is registered as a standalone offline tool and launcher card with common navigation',()=>{
 const root=path.join(__dirname,'..'),m=JSON.parse(fs.readFileSync(path.join(root,'offline-manifest.json'),'utf8')),entry=m.items.find(x=>x.id==='words');assert.equal(entry.type,'tool');assert.equal(entry.url,'games/words.html');assert.deepEqual(entry.files,['games/words.html']);
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(index,/data-url="games\/words.html"/);assert.match(index,/>13 items</);assert.match(html,/class="wg-home"/);assert.match(html,/data-wg-home-confirm/);assert.match(html,/data-wg-display/);assert.doesNotMatch(html,/<script[^>]+src=/);
});
