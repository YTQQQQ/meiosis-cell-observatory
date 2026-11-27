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
    assert(!state.labels.some(l=>/^短[父母副]/.test(l.text)));
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
const options={egg:false,example:'independent',cross:false,flip:false,opacity:.62,color:true,genes:true};
const pose=u=>Biology.scene(4.76,{...options,orientation:u});
let start=pose(0),prev=start;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
for(let j=1;j<=120;j++){
  const frame=pose(j/120);
  frame.items.forEach((a,k)=>{
    assert.equal(a.id,start.items[k].id);assert.equal(a.sequence,start.items[k].sequence);
    for(let n=0;n<a.points.length;n++){
      assert(distance(a.points[n],prev.items[k].points[n])<.025);
      assert(Math.abs(distance(a.points[n],a.center)-distance(start.items[k].points[n],start.items[k].center))<1e-8);
    }
    if(!a.pair)assert.deepEqual(a.points,start.items[k].points);
  });
  const anchors=frame.beads.filter(b=>b.color==='#80c3bd');
  for(const p of frame.paths.filter(p=>p.color==='#80c3bd'))assert(anchors.some(b=>distance(b.center,p.points.at(-1))<1e-8));
  prev=frame;
}
assert.deepEqual(prev.items.map(a=>a.points),Biology.scene(4.76,{...options,flip:true}).items.map(a=>a.points));
console.log(JSON.stringify({checkpointCounts:stageCounts.length,lessonCount:Lessons.length,geometrySamples:sampled,geneticConfigurations:genetic,seekRoundTrips:cycles,turnFrames:120,result:'pass'},null,2));
