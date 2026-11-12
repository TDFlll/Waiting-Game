const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=html.match(/<script data-wg-display>([\s\S]*?)<\/script>/)[1];
const core=script.split('// Browser integration')[0].replace('(function(){','');const ctx=vm.createContext({});vm.runInContext(core+';this.api={normalize,autoFactor,scaleCSS}',ctx);const {normalize,autoFactor,scaleCSS}=ctx.api;
const plain=v=>JSON.parse(JSON.stringify(v));
test('display preferences default to automatic and validate manual scale without accepting invalid values',()=>{
 assert.deepEqual(plain(normalize(null)),{mode:'auto',percent:100});assert.deepEqual(plain(normalize({mode:'other',percent:'oops'})),{mode:'auto',percent:100});
 assert.deepEqual(plain(normalize({mode:'manual',percent:'128'})),{mode:'manual',percent:130});assert.equal(normalize({mode:'manual',percent:500}).percent,175);assert.equal(normalize({mode:'manual',percent:20}).percent,75);
});
test('automatic sizing keeps phones at 100 percent and scales tablet and larger screens',()=>{
 assert.equal(autoFactor(390,390),1);assert.equal(autoFactor(844,390),1);assert.equal(autoFactor(768,768),1.25);assert.equal(autoFactor(1024,768),1.25);assert.equal(autoFactor(1366,1024),1.5);assert.equal(autoFactor(400,1024),1);
});
test('responsive breakpoints track logical width and height while viewport values stay within the physical display',()=>{
 const css='@media(max-width:600px) and (min-height:500px){.app{height:100dvh;width:calc(100vw - 20px);top:-12vh}}';const actual=scaleCSS(css,1.5);
 assert.match(actual,/@media\(max-width:900px\) and \(min-height:750px\)/);assert.match(actual,/height:calc\(100 \* var\(--wg-dvh\)\)/);assert.match(actual,/calc\(calc\(100 \* var\(--wg-vw\)\) - 20px\)/);assert.match(actual,/top:calc\(-12 \* var\(--wg-vh\)\)/);
});
test('resolution, orientation, fixed pixels and animation percentages are not rescaled',()=>{
 const css='@media(orientation:landscape) and (min-resolution:2dppx){.x{padding:12px;width:50%;transform:translateY(-105vh)}}';const actual=scaleCSS(css,1.25);assert.match(actual,/min-resolution:2dppx/);assert.match(actual,/padding:12px;width:50%/);assert.match(actual,/translateY\(calc\(-105 \* var\(--wg-vh\)\)\)/);
});
test('TOP and every standalone game embed the same display preference behavior without new external assets',()=>{
 const games=fs.readdirSync(path.join(root,'games')).filter(n=>n.endsWith('.html'));assert.equal(games.length,12);
 for(const file of games){const h=fs.readFileSync(path.join(root,'games',file),'utf8');assert.equal(h.match(/<script data-wg-display>([\s\S]*?)<\/script>/)[1],script,file);}
 assert.match(html,/id="displayScale"[^>]*min="75" max="175" step="5"/);assert.match(script,/waitingGamesDisplayV1/);
});
