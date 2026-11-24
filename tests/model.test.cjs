'use strict';
// Run from any directory using Node.js 18+.
const { strict: assert } = require('node:assert');
global.window=global;
require('../dist/model.js');require('../dist/lessons.js');
const stageCounts=[
 [0,[4,4,0,2]],[1,[4,4,0,2]],[2,[4,8,8,2]],[4.8,[4,8,8,2]],
 [6.8,[4,8,8,2]],[7,[2,4,4,1]],[9.9,[2,4,4,1]],[10.14,[4,4,0,2]],
 [11.9,[4,4,0,2]],[12,[2,2,0,1]],[13.2,[2,2,0,1]],[14,[4,4,0,2]]
];
stageCounts.forEach(([t,v])=>assert.deepEqual(Biology.count(t),v));
assert.equal(Lessons.length,14);
let sampled=0,cycles=0,genetic=0;
for(const egg of [false,true])for(const example of ['linked','independent'])for(const cross of [false,true])for(const flip of [false,true]){
  const o={egg,example,cross,flip,genes:true,opacity:.6,color:true,track:'Lp'};
  for(let j=0;j<=140;j++){
    const time=j/10, state=Biology.scene(time,o);sampled++;
    const pts=state.paths.flatMap(p=>p.points);
    assert(pts.every(p=>p.length===3&&p.every(Number.isFinite)));
    assert(state.paths.every(p=>p.radius>0));
    assert.equal(state.items.length,time>=13||time<=1?4:8);
    if(time>=2&&time<13){
      assert.equal(new Set(state.items.map(a=>a.id+'/'+a.s)).size,8);
      assert.equal(state.items.filter(a=>a.id==='Lp').length,2);
    }
  }
  const end=Biology.scene(12,o), out=[0,1,2,3].map(i=>end.items.filter(x=>x.child===i));
  const combos=out.map(pair=>{
    assert.equal(pair.length,2);assert.deepEqual(pair.map(a=>a.pair),[0,1]);
    return pair.map(a=>a.sequence).join('');
  }).sort();
  const expected=example==='linked'&&cross?['AB','Ab','aB','ab']:
    example==='independent'&&flip?['Ab','Ab','aB','aB']:['AB','AB','ab','ab'];
  assert.deepEqual(combos,expected); genetic++;
  for(const mid of [6.51,7.14,11.52]){
    const earlier=Biology.scene(mid,o);Biology.scene(14,o);Biology.scene(0,o);
    assert.deepEqual(Biology.scene(mid,o),earlier);cycles++;
  }
  if(egg)assert(end.g.end[0].r>end.g.end[1].r*2);
}
console.log(JSON.stringify({checkpointCounts:stageCounts.length,lessonCount:Lessons.length,geometrySamples:sampled,geneticConfigurations:genetic,seekRoundTrips:cycles,result:'pass'},null,2));
