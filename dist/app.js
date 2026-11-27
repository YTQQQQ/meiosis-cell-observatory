(() => {
  'use strict';
  const $=id=>document.getElementById(id), on=(id,fn)=>$(id).addEventListener('click',fn);
  const opt={egg:false,example:'linked',cross:true,flip:false,opacity:.62,color:true,genes:false,track:'',trackS:null};
  const ids={Lp:'父源长染色体',Lm:'母源长染色体',Sp:'父源短染色体',Sm:'母源短染色体',other0:'另一配子的长染色体',other1:'另一配子的短染色体'};
  const cam={yaw:-.35,pitch:.2,zoom:1,target:[0,0,0],span:5.75,cut:false};
  let t=4.65,intro=true,playing=false,pausedEnd=false,twoD=false,scope='cell',focus=-1,voice=false,raf=0,previous=0,lastUI=0,slide=0;
  let slowFrames=0,visualQuality=1,model,project,hit=[],modalRenderer=null,lessonKey='',dynamicKey='',dirty=true;
  const optics=Optics($('world')), range=Bio=>Math.min(13,Math.floor(Bio)), last=14;
  const stageIndex=()=>pausedEnd?Math.max(0,Math.round(t)-1):range(t), lesson=()=>Lessons[stageIndex()];
  const activate=(a,b,v)=>{for(const [id,selected] of [[a,v],[b,!v]]){$(id).classList.toggle('on',selected);$(id).setAttribute('aria-pressed',selected);}};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let comparison=null,compareFrame=0,pan=[0,0,0];
  function resetCamera(){cam.yaw=-.35;cam.pitch=.20;cam.zoom=1;pan=[0,0,0];focus=-1;draw();}
  function cancelComparison(){
    if(!comparison)return;
    cancelAnimationFrame(compareFrame);comparison=null;delete opt.orientation;
    dirty=true;setupExperiment();
  }
  function pause(){
    playing=false;previous=0;cancelAnimationFrame(raf);raf=0;
    const interrupted=!!comparison;cancelComparison();
    if(voice&&'speechSynthesis' in window)window.speechSynthesis.cancel();
    if(interrupted){sync();draw();}
  }
  function seek(value,end=false,defer=false){
    intro=false;t=Biology.clamp(+value,0,last);pausedEnd=end;dirty=true;
    if(t<7||t>=13)focus=-1;
    sync();if(defer)scheduleDraw();else draw();
  }
  function play(){
    if(comparison)return;
    if(playing){pause();sync();return;}
    if(intro||t>=last)seek(0);
    if(pausedEnd){seek(t);}
    pausedEnd=false;playing=true;previous=0;speak();sync();raf=requestAnimationFrame(frame);
  }
  function frame(now){
    if(!playing)return;
    if(previous){const ms=now-previous;slowFrames=ms>24?Math.min(48,slowFrames+1):Math.max(0,slowFrames-1);if(slowFrames>=20)visualQuality=.72;else if(slowFrames===0)visualQuality=1;}
    const dt=previous?Math.min(.16,(now-previous)/1000):0;previous=now;
    const old=stageIndex(),speed=parseFloat($('speed').value),next=Math.min(last,t+dt*speed/(old===0?3:5.2));
    if($('mode').value==='step' && next>=old+1 && old<13){
      t=old+1;pausedEnd=true;dirty=true;pause();sync();draw();return;
    }
    t=next;dirty=true;
    if(stageIndex()!==old){if(t>=13)focus=-1;speak();}
    if(now-lastUI>75||t===last){sync();lastUI=now;}
    draw();if(t>=last){pause();sync();return;}raf=requestAnimationFrame(frame);
  }
  function sync(){
    const i=stageIndex(), q=lesson(),key=[intro,i,opt.egg,opt.example,opt.cross].join('/');
    if(key!==lessonKey){
      lessonKey=key;
      $('phase').textContent=intro?'模型导览':q.group;
      $('lessonTitle').textContent=intro?'认识一对同源染色体':q.name;
      $('event').textContent=intro?'找到一长一短两对染色体。每一对中，蓝色来自父方，红色来自母方。点选其中一条，就能持续追踪它。':(opt.egg&&q.egg?q.egg:q.event);
      $('why').textContent=intro?'先看长的那一对。两条同源染色体都已复制，合在一起共有四条染色单体。':q.why;
      if(!intro&&i===13)$('event').textContent=(opt.egg?'跟随上一幕的卵细胞':'选取上一幕的一个精子')+'，转到受精视野。紫色标出另一亲本带来的染色体。两套核染色体汇入一个受精卵。';
      if(!intro&&i===3&&(opt.example==='independent'||!opt.cross))$('event').textContent='本次观察关闭了标记片段互换。父源与母源的标记片段保持原组合，可切换实验比较。';
      $('lens').textContent=!intro&&i===1?'放大复制叉':!intro&&i===3?'放大交换位置':'拆开观察';
      $('screenName').textContent=intro?'模型导览 · 减Ⅰ中期':q.name;
      $('timeName').textContent=intro?'全过程时间轴':q.name;
    }
    $('play').textContent=playing?'Ⅱ  暂停':intro?'▶  开始学习':t>=last?'▶  重新学习':'▶  继续';
    $('timeline').value=t;
    $('play').disabled=!!comparison;
    const v=stats(t,scope);
    $('stage').classList.toggle('neutral',!opt.color);
    const ds=[...v,scope,focus,t>=13.78,t>=13,t>=12,t>=7,opt.egg,intro].join('/');
    if(ds!==dynamicKey){
      dynamicKey=ds;
      $('stats').innerHTML=v.map((n,j)=>'<div><strong>'+n+'</strong><small>'+['染色体','核DNA','染色单体','染色体组'][j]+'</small></div>').join('');
      $('scopeName').textContent=scopeLabel();
    }
    $('tracktag').textContent=opt.track?'追踪 · '+ids[opt.track]+(opt.trackS==null?'':(opt.trackS?'②':'①')):'';
    if(!$('numbers').hidden)drawSpark();
    $('more').textContent=intro?'模型说明':'深入解释';
  }
  function scopeLabel(){
    if(scope==='pole')return '单极 · 姐妹或同源伙伴移开后计数';
    if(scope==='total')return '总计 · 当前画面全部细胞，组数为求和';
    if(t>=13.78)return '单个细胞 · 受精卵';
    if(t>=13)return '单个细胞 · 一个参与受精的配子';
    if(t>=12)return '单个产物 · '+(opt.egg?(focus>0?'极体':'卵细胞'):'精细胞或精子');
    if(t>=7)return '单个细胞 · '+(opt.egg?(focus===1?'第一极体':'次级卵母细胞'):'次级精母细胞');
    return '单个细胞 · '+(t>=2||intro?(opt.egg?'初级卵母细胞':'初级精母细胞'):'分裂前的生殖细胞');
  }
  function stats(time,which){
    const v=Biology.count(time);
    if(which==='cell')return v;
    if(which==='pole'){
      if(time>=5.5&&time<7)return [2,4,4,1];
      if(time>=10.5&&time<12)return [2,2,0,1];
      return ['—','—','—','—'];
    }
    const n=time>=13.78?1:time>=13?2:time>=12?4:time>=7?2:1;
    return v.map(x=>typeof x==='number'?x*n:x);
  }
  function getCamera(){
    const w=$('stage').clientWidth,h=$('stage').clientHeight, expansion=Biology.ramp(t,5.4,7),width=5.3+expansion*2.9;
    let span=Math.max(5.6+Biology.ramp(t,10.7,12)*1.45,width*h/w*1.16);
    let target=[0,0,0];
    if(t>=12.9){const u=Biology.ramp(t,12.9,13.35);span+=(Math.max(5.4,7.0*h/w)-span)*u;}
    if(focus>=0&&t>=7&&t<13){const cells=t<12?model.g.mid:model.g.end,cell=cells[focus%cells.length];span=cell.r*2.85;target=cell.center;}
    if(comparison?.returnView){const {startView,progress}=comparison.returnView;
      span=startView.span+(span-startView.span)*progress;
      target=target.map((x,i)=>startView.target[i]-pan[i]+(x-startView.target[i]+pan[i])*progress);
    }
    return {...cam,target:target.map((x,i)=>x+pan[i]),span,quality:visualQuality};
  }
  function draw(){
    if(dirty||!model){model=Biology.scene(t,opt);dirty=false;}
    const camera=getCamera();$('world').hidden=twoD;$('map').hidden=!twoD;
    if(twoD)project=Diagram.draw($('map'),model,{...camera,yaw:0,pitch:0,roll:0});
    else {optics.render(model,camera);project=p=>optics.project(p);}
    hit=model.items.map(a=>({id:a.id,points:a.points.filter((_,i)=>i%3===0).map(project),s:a.s}));overlay();
    const displayMini=focus>=0&&t>=7&&t<13;$('mini').hidden=!displayMini;
    if(displayMini)Diagram.draw($('mini'),model,{span:8});
    if(modalRenderer&&$('dialog').open)modalRenderer();
  }
  function overlay(){
    const {ctx,w,h}=Diagram.prepare($('labels')), placed=[];
    function write(x,y,txt,col,font=12){
      if(x<4||x>w-4||y<44||y>h-24)return;
      ctx.font='600 '+font+'px system-ui';
      const len=ctx.measureText(txt).width;
      const left=Biology.clamp(x,5,w-len-7);
      if(placed.some(b=>left<b[0]+b[2]+2&&left+len>b[0]-2&&Math.abs(b[1]-y)<15))return;
      placed.push([left,y,len]);ctx.lineWidth=3.5;ctx.strokeStyle='#132c2ed9';ctx.strokeText(txt,left,y);ctx.fillStyle=col;ctx.fillText(txt,left,y);
    }
    if($('showlabels').checked){
      const s=model.shells.filter(s=>!s.nuclear)[0], stage=stageIndex();
      const leader=(p,title,side,dy)=>{
        const [x,y]=project(p);if(x<12||x>w-12||y<45||y>h-35)return;
        const length=Math.min(w*.11,73),x2=Biology.clamp(x+side*length,46,w-86),y2=Biology.clamp(y+dy,65,h-45);
        ctx.strokeStyle='#a9cbbb9a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.lineTo(x2+side*13,y2);ctx.stroke();
        ctx.fillStyle='#c5dfca';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();write(x2+(side<0?-38:2),y2-4,title,'#c9dfd0');
      };
      if(t<6&&s)leader([1.50,1.68,.5],'细胞膜',1,-12);
      if(t<2.7)leader([-.96,1.12,.36],'核膜',-1,-9);
      if((intro||stage===4)&&model.beads.length)leader([-1.92,0,0],'中心体',-1,-27);
      if(stage===4&&!opt.genes)leader([.85,-.32,.14],'纺锤丝',1,32);
      if(intro&&!opt.genes)leader([0,-.6,-.35],'一对同源染色体',-1,70);
      if(!intro)for(const l of model.labels.filter(l=>l.kind==='id')){
        let [x,y]=project(l.at);write(x+5,y+12,l.text,l.color);
      }
      if(t>=7&&t<13&&opt.egg){
        const cells=t<12?model.g.mid:model.g.end;cells.forEach((c,j)=>{let [x,y]=project(c.center);write(x-21,y-c.r*11-19,(t<12?['次级卵母细胞','第一极体']:['卵细胞','第二极体','极体','极体'])[j],'#bfe1c5');});
      }
    }
    if(opt.genes)for(const l of model.labels.filter(l=>l.kind==='gene')){const [x,y]=project(l.at);write(x-9,y-3,l.text,l.color,14);}
  }
  function updateModel(){dirty=true;dynamicKey='';sync();draw();}
  function speechText(){const q=lesson();return (intro?'模型导览':q.name)+'。'+$('event').textContent+'。'+$('why').textContent;}
  function speak(){if(!voice||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(speechText());u.lang='zh-CN';u.rate=.95;window.speechSynthesis.speak(u);}
  on('speak',()=>{if(!('speechSynthesis'in window)){openBox('朗读与字幕','<p>当前浏览器仅提供文字字幕。切换时期可阅读对应讲解。</p>');return;}voice=!voice;$('speak').textContent=voice?'关闭朗读':'朗读';if(voice)speak();else window.speechSynthesis.cancel();});
  function changeRoute(egg){pause();opt.egg=egg;focus=-1;activate('male','female',!egg);updateModel();}
  on('male',()=>changeRoute(false));on('female',()=>changeRoute(true));
  on('play',play);on('prev',()=>{pause();seek(intro?0:Math.max(0,stageIndex()-1));});on('next',()=>{pause();seek(intro?0:Math.min(last,stageIndex()+1));});on('restart',()=>{pause();focus=-1;seek(0);});
  $('timeline').oninput=e=>{const requestedTime=e.target.value;pause();seek(requestedTime,false,true);};
  on('restore',resetCamera);on('zoomIn',()=>{cam.zoom=Math.min(4,cam.zoom*1.23);draw();});on('zoomOut',()=>{cam.zoom=Math.max(.6,cam.zoom/1.23);draw();});
  function switchView(d){twoD=d;activate('d3','d2',!d);draw();}
  const viewer=$('stage').closest('.viewer');
  function expanded(active){
    viewer.classList.toggle('expanded',active);document.body.classList.toggle('observing',active);
    $('fullscreen').setAttribute('aria-pressed',String(active));
    $('fullscreen').setAttribute('aria-label',active?'退出全屏':'全屏观察');
    $('fullscreen').title=active?'退出全屏':'全屏观察';
    scheduleDraw();
  }
  on('fullscreen',async()=>{
    const next=!viewer.classList.contains('expanded');
    expanded(next);
    try{
      if(next)await document.documentElement.requestFullscreen?.();
      else if(document.fullscreenElement)await document.exitFullscreen();
    }catch{/* The viewport-filling layout also works without native fullscreen. */}
  });
  document.addEventListener('fullscreenchange',()=>expanded(!!document.fullscreenElement));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dialog').open&&viewer.classList.contains('expanded'))expanded(false);});
  on('d2',()=>switchView(true));on('d3',()=>switchView(false));on('settings',()=>{$('prefs').hidden=!$('prefs').hidden;});
  $('opacity').oninput=e=>{opt.opacity=1-e.target.value/100;updateModel();};
  $('cut').onchange=e=>{cam.cut=e.target.checked;if(cam.cut&&twoD){twoD=false;activate('d3','d2',true);}draw();};$('showlabels').onchange=draw;
  for(const id of ['color','genes'])$(id).onchange=e=>{opt[id]=e.target.checked;updateModel();};
  on('resetTrack',()=>{opt.track='';opt.trackS=null;updateModel();});on('fold',()=>{$('numbers').hidden=!$('numbers').hidden;$('fold').textContent=$('numbers').hidden?'展开':'收起';});
  const pointers=new Map();let start,dragged=false,distance=0,gestureFrame=0;
  const scheduleDraw=()=>{if(!gestureFrame)gestureFrame=requestAnimationFrame(()=>{gestureFrame=0;draw();});};
  const gap=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a[0]-b[0],a[1]-b[1]);};
  for(const id of ['world','map']){
    const c=$(id);c.onpointerdown=e=>{if(pointers.size>=2)return;c.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){start=[e.clientX,e.clientY];dragged=false;}else{dragged=true;distance=gap();}};
    c.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);
      if(pointers.size===2){
        const d=gap(),worldPerPx=getCamera().span/(cam.zoom*Math.max(1,c.clientHeight));
        const dx=(e.clientX-old[0])*worldPerPx*.5,dy=(e.clientY-old[1])*worldPerPx*.5;
        const yaw=twoD?0:cam.yaw,pitch=twoD?0:cam.pitch;
        pan[0]-=dx*Math.cos(yaw)+dy*Math.sin(yaw)*Math.sin(pitch);
        pan[1]+=dy*Math.cos(pitch);pan[2]+=dx*Math.sin(yaw)-dy*Math.cos(yaw)*Math.sin(pitch);
        if(distance>1&&d>1)cam.zoom=Biology.clamp(cam.zoom*d/distance,.55,4);distance=d;}
      else{if(Math.hypot(e.clientX-start[0],e.clientY-start[1])>4)dragged=true;
        if(!twoD&&dragged){cam.yaw+=(e.clientX-old[0])*.009;cam.pitch=Biology.clamp(cam.pitch+(e.clientY-old[1])*.008,-1.4,1.4);}}scheduleDraw();};
    c.onpointerup=e=>{if(!pointers.delete(e.pointerId)||dragged||pointers.size)return;
      const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      const nearest=hit.map(it=>({id:it.id,s:it.s,d:Math.min(...it.points.map(p=>Math.hypot(p[0]-x,p[1]-y)))})).sort((a,b)=>a.d-b.d)[0];
      if(nearest&&nearest.d<21){opt.track=nearest.id;opt.trackS=(t>=10.14&&t<13)?nearest.s:null;updateModel();}};
    c.onpointercancel=c.onlostpointercapture=e=>{if(pointers.delete(e.pointerId))dragged=true;};
    c.onwheel=e=>{e.preventDefault();cam.zoom=Biology.clamp(cam.zoom*Math.exp(-e.deltaY*.002),.55,4);draw();};
  }
  function openBox(title,html){pause();sync();$('prefs').hidden=true;modalRenderer=null;Lens.unmount();$('dialogTitle').textContent=title;$('dialogBody').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
  function closeBox(){$('dialog').close();}
  $('dialog').addEventListener('close',()=>{modalRenderer=null;Lens.unmount();});on('close',closeBox);
  $('dialog').onclick=e=>{if(e.target===$('dialog')){const b=$('dialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeBox();}};
  on('guide',()=>openBox('学习手册',CurriculumHTML+'<h3>点读术语</h3>'+Object.entries(Glossary).map(([k,v])=>'<details><summary>'+k+'</summary><p>'+v+'</p></details>').join('')));
  on('lens',()=>{const topic=!intro&&stageIndex()===1?'dna':!intro&&stageIndex()===3?'cross':'structure';openBox('结构放大镜','<div id="closeup"></div>');Lens.mount($('closeup'),topic);});
  on('more',()=>{const q=lesson();openBox(intro?'模型说明':q.name,intro?CurriculumHTML:'<h3>观察到的变化</h3><p>'+q.event+'</p><h3>怎样判断</h3><p>'+q.trap+'</p><h3>深入理解</h3><p>'+q.deep+'</p>'+(opt.egg&&q.egg?'<p>'+q.egg+'</p>':'')+'<details><summary>相关术语</summary>'+Object.entries(Glossary).map(([k,v])=>'<p><b>'+k+'</b>　'+v+'</p>').join('')+'</details>');});
  function chapterMenu(){
    openBox('时期目录',Lessons.map((q,i)=>(!i||q.group!==Lessons[i-1].group?'<h3>'+q.group+'</h3>':'')+'<button class="action" data-time="'+i+'">'+q.name+'</button> ').join(''));
    $('dialogBody').querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{seek(+b.dataset.time);closeBox();speak();});
  }
  on('chapters',chapterMenu);
  function setupExperiment(){
    const linked=opt.example==='linked';activate('linked','arrangement',linked);
    $('expOption').hidden=!linked;$('experimentCheck').checked=opt.cross;
    $('arrangement').disabled=!!comparison;
    $('arrangement').setAttribute('aria-busy',String(!!comparison));
    $('expDesc').textContent=comparison?(comparison.returnView?'正在定位至减Ⅰ中期…':'教学对照 · 比较两次分裂可能采用的取向。'):linked?'长染色体携带 AB 或 ab，观察对应片段的互换。':
      '情况'+(opt.flip?'二':'一')+' · 比较不同细胞中两对同源染色体的取向。A/a 与 B/b 分处两对。';
  }
  $('experimentCheck').onchange=e=>{pause();opt.cross=e.target.checked;updateModel();};
  on('linked',()=>{pause();opt.example='linked';opt.cross=true;opt.genes=true;$('genes').checked=true;seek(3);setupExperiment();});
  on('arrangement',()=>{
    if(comparison)return;
    pause();
    const start=t, startView=getCamera(), target=4.76, from=Number(opt.flip);
    const travel=reduced.matches?100:Math.min(1600,Math.abs(start-target)*200);
    const duration=reduced.matches?160:1150;
    const began=performance.now();
    comparison={returnView:{startView,progress:0}};intro=false;pausedEnd=false;focus=-1;
    setupExperiment();sync();
    function animate(now){
      const elapsed=Math.max(0,now-began);
      if(elapsed<travel){
        const u=Biology.ramp(elapsed,0,travel);comparison.returnView.progress=u;t=start+(target-start)*u;
      }else{
        if(comparison.returnView){
          comparison.returnView=null;t=target;opt.example='independent';opt.genes=true;$('genes').checked=true;setupExperiment();
        }
        const u=Biology.ramp(elapsed-travel,0,duration);opt.orientation=from+(1-2*from)*u;
        if(u===1){opt.flip=!from;delete opt.orientation;comparison=null;setupExperiment();}
      }
      dirty=true;sync();draw();
      if(comparison)compareFrame=requestAnimationFrame(animate);
    }
    compareFrame=requestAnimationFrame(animate);
  });
  on('results',()=>{const future=Biology.scene(12,opt),row=j=>{const items=future.items.filter(x=>x.child===j);return '<tr><td>'+(opt.egg?['卵细胞','第二极体','第一极体的子细胞①','第一极体的子细胞②'][j]:'精细胞 '+(j+1))+'</td><td>'+items.map(a=>ids[a.id]).join('、')+'</td><td>'+items.map(a=>a.sequence).join('')+'</td></tr>';};
    openBox('本次分裂的产物','<p>按当前互换和取向设置推演到减Ⅱ结束。</p><table><tr><th>产物</th><th>染色体主体来源</th><th>基因组合</th></tr>'+[0,1,2,3].map(row).join('')+'</table><p>'+(opt.example==='linked'?'这里的两个基因位于长染色体上。开启一次互换时，四条染色单体得到 AB、Ab、aB、ab 四种标记。':'本个体有两对同源染色体。多次分裂可能出现 2²＝4 种来源组合；本次四个产物中有两种互补组合，各两个。')+'</p><button class="action" id="toProducts">在模型中查看</button>');on('toProducts',()=>{closeBox();seek(12);});});
  on('focusBtn',()=>{const cells=t>=12&&t<13?4:t>=7&&t<12?2:0;
    openBox('选择细胞与追踪对象','<h3>观察范围</h3><div class="rows"><button data-f="-1">全部细胞</button>'+Array.from({length:cells},(_,j)=>'<button data-f="'+j+'">'+(opt.egg?(cells===2?['次级卵母细胞','第一极体']:['卵细胞','第二极体','极体①','极体②'])[j]:'细胞 '+(j+1))+'</button>').join('')+'</div><h3>追踪染色体</h3><div class="rows"><button data-id="">结束追踪</button>'+Object.entries(ids).filter(([k])=>model.items.some(a=>a.id===k)).map(([k,v])=>'<button data-id="'+k+'">'+v+'</button>').join('')+'</div><p>金色标记随选中染色体的主体传递。红蓝片段保留各自的来源色。</p>');
    $('dialogBody').querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{focus=+b.dataset.f;cam.zoom=1;closeBox();sync();draw();});
    $('dialogBody').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{opt.track=b.dataset.id;opt.trackS=null;closeBox();updateModel();});});
  const lineColors=['#25654f','#4489c4','#ba6474','#997941'];
  const curveCache=new Map();
  function valuesForGraph(x,kind,j){
    if(x>1&&x<2&&kind!=='pole')return [4,4+4*(x-1),null,2][j];
    return stats(x,kind)[j];
  }
  function drawSpark(){
    const {ctx,w,h}=Diagram.prepare($('spark')),x=v=>4+(w-8)*v/14,y=v=>h-5-v*(h-10)/8;
    const key=[w,h,scope].join('|');
    if(!curveCache.has(key)){
      const samples=[...Array.from({length:141},(_,i)=>i/10),6.99999,10.13999,10.14,11.99999,12.99999,13.77999,13.78].sort((a,b)=>a-b);
      const paths=lineColors.map((col,j)=>{const p=new Path2D();let pen=false;
        samples.forEach(v=>{const num=valuesForGraph(v,scope,j);if(typeof num!=='number'){pen=false;return;}
          if(pen)p.lineTo(x(v),y(num));else p.moveTo(x(v),y(num));pen=true;});return p;});
      if(curveCache.size>12)curveCache.clear();curveCache.set(key,paths);
    }
    curveCache.get(key).forEach((p,j)=>{ctx.strokeStyle=lineColors[j];ctx.setLineDash([[],[5,2],[2,3],[6,2]][j]);ctx.lineWidth=1.6;ctx.stroke(p);});
    ctx.setLineDash([]);ctx.strokeStyle='#263e2d';ctx.beginPath();ctx.moveTo(x(t),1);ctx.lineTo(x(t),h-1);ctx.stroke();
  }
  function sparkSeek(e){const r=$('spark').getBoundingClientRect();pause();seek(14*Biology.clamp((e.clientX-r.left-4)/(r.width-8)));}
  $('spark').onpointerdown=e=>{$('spark').setPointerCapture(e.pointerId);sparkSeek(e);};
  $('spark').onpointermove=e=>{if($('spark').hasPointerCapture(e.pointerId))sparkSeek(e);};
  function curveBox(){
    openBox('数量曲线','<div class="choicebar">'+['cell','pole','total'].map((s,j)=>'<button data-s="'+s+'">'+['一个细胞','一极','画面总计'][j]+'</button>').join('')+'</div><p>横轴与动画共用时间。点按或拖动曲线可回看该时刻。</p><canvas id="chart"></canvas><button class="action" id="chartPlay">播放此段</button><div id="chartLegend"></div><p id="chartCounts"></p><p>S 期蓝线表示核 DNA 含量按复制前分子数折算的相对变化。单体形成中仅显示首尾计数；无两极分配时，单极曲线留空。</p><p>减Ⅱ后期同一细胞按排列可数出两组，每一极各有一组。两组是姐妹分开形成的两份，细胞的单倍体来源没有改变。受精段另取两个配子观察。</p>');
    const chart=$('chart');on('chartPlay',()=>{if(intro)seek(0);play();modalRenderer();});
    $('chartLegend').innerHTML=['染色体','核DNA','染色单体','染色体组'].map((v,j)=>'<span style="padding-right:12px;color:'+lineColors[j]+'">● '+v+'</span>').join('');
    modalRenderer=()=>{
      const {ctx,w,h}=Diagram.prepare(chart),left=31,top=26,bottom=h-29,right=w-12;
      const max=scope==='total'?8:scope==='pole'?4:8;
      const X=v=>left+(right-left)*v/14,Y=v=>bottom-(bottom-top)*v/max;
      ctx.font='12px system-ui';ctx.textAlign='right';
      for(let v=0;v<=max;v+=2){ctx.fillStyle='#476656';ctx.fillText(v,left-7,Y(v)+4);ctx.strokeStyle='#d3e0d1';ctx.beginPath();ctx.moveTo(left,Y(v));ctx.lineTo(right,Y(v));ctx.stroke();}
      for(let j=0;j<4;j++){
        ctx.beginPath();let pen=false;ctx.strokeStyle=lineColors[j];ctx.setLineDash([[],[7,3],[3,3],[9,3,2,3]][j]);ctx.lineWidth=2.4;
        const xs=[...Array.from({length:281},(_,a)=>a/20),6.99999,10.13999,10.14,11.99999,12.99999,13.77999,13.78].sort((a,b)=>a-b);
        for(const x of xs){let v=stats(x,scope)[j];if(x>1&&x<2&&scope!=='pole')v=[4,4+4*(x-1),null,2][j];
          if(typeof v!=='number'){pen=false;continue;}
          if(pen)ctx.lineTo(X(x),Y(v));else ctx.moveTo(X(x),Y(v));pen=true;
        }ctx.stroke();
      }
      ctx.setLineDash([]);ctx.textAlign='center';
      [[0,'开始'],[7,'减Ⅰ完成'],[12,'减Ⅱ完成'],[14,'受精']].forEach(([x,l])=>{ctx.fillStyle='#466653';ctx.fillText(l,Biology.clamp(X(x),20,w-18),h-6);});
      ctx.strokeStyle='#1d442d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X(t),top-9);ctx.lineTo(X(t),bottom);ctx.stroke();
      $('chartCounts').textContent=scopeLabel()+'　｜　'+stats(t,scope).join('  /  ');$('chartPlay').textContent=playing?'暂停曲线':'播放此段';
      $('dialogBody').querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('active',b.dataset.s===scope));
    };
    $('dialogBody').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{scope=b.dataset.s;sync();modalRenderer();});
    function jump(e){const r=chart.getBoundingClientRect();pause();seek(Biology.clamp((e.clientX-r.left-31)/(r.width-43))*14);}
    chart.onpointerdown=e=>{chart.setPointerCapture(e.pointerId);jump(e);};chart.onpointermove=e=>{if(chart.hasPointerCapture(e.pointerId))jump(e);};modalRenderer();
  }
  on('curve',curveBox);
  function mitotic(anaphase){
    const scene={shells:[{center:[0,0,0],radii:[2.4,2.2,2.0],alpha:.6,color:'#7ac4aa'}],labels:[],items:[],planes:[],paths:[],beads:[]};
    for(let j=0;j<4;j++)for(let s=0;s<2;s++){
      const y=(j-1.5)*.8,c=s?1:-1;
      const pts=Array.from({length:13},(_,k)=>{const v=k/6-1;return [anaphase?c*(1.1-Math.abs(v)*.2):c*.41*v,.14*Math.sin(v*1.3)+y+.16*v,0];});
      scene.paths.push({points:pts,radius:.065,color:j%2?'#ff9297':'#74baff'});
      const center=pts[6];scene.paths.push({points:[[c*2,0,0],center],radius:.012,color:'#6fa68c'});
    }
    return scene;
  }
  function compare(tab=0){
    openBox('对照学习','<div class="choicebar">'+['减Ⅰ与减Ⅱ','精子与卵细胞','有丝与减数分裂'].map((n,j)=>'<button data-c="'+j+'" class="'+(tab===j?'active':'')+'">'+n+'</button>').join('')+'</div><div class="twins"><figure><canvas id="ca"></canvas><figcaption id="capA"></figcaption></figure><figure><canvas id="cb"></canvas><figcaption id="capB"></figcaption></figure></div><label id="compLabel"></label><input style="width:100%" id="compRange" type="range" min="0" max="1" step=".01" value="'+(tab===1?.78:0)+'"><p id="compNote"></p>');
    $('dialogBody').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>compare(+b.dataset.c));
    const render=()=>{
      const u=+$('compRange').value, a=tab===1?6+u*1.22:4.85+u*.99,b=tab===1?a:9.85+u*.99;
      const sa=tab===2?mitotic(u>.33):Biology.scene(a,{...opt,egg:false}),sb=Biology.scene(tab===2?a:b,{...opt,egg:tab===1});
      Diagram.draw($('ca'),sa,{span:tab===1?Math.max(5.7,8*$('ca').clientHeight/$('ca').clientWidth):5.4});
      Diagram.draw($('cb'),sb,tab===0?{span:4.4,target:sb.g.mid[0].center}:{span:Math.max(5.6,8*$('cb').clientHeight/$('cb').clientWidth)});
      $('capA').textContent=['减Ⅰ · 初级精母细胞','精子路线 · 两侧近等大','有丝分裂 · 2n＝4'][tab];
      $('capB').textContent=['减Ⅱ · 一个次级精母细胞','卵细胞路线 · 分裂沟偏移','减Ⅰ · 2n＝4'][tab];
      $('compLabel').textContent=tab===1?'拖动观察第一次胞质分裂':'拖动比较中期至后期';
      $('compNote').textContent=['减Ⅰ两条同源染色体相对排列，后期各带着两条姐妹移向一极。减Ⅱ中每条染色体独立排列，姐妹分别移向两极。','两种路线中，每个正常减Ⅰ产物都得到一条长染色体和一条短染色体。卵细胞路线将大部分胞质留在次级卵母细胞。','两个初始细胞都有两对同源染色体。有丝分裂中各条独立排列、姐妹分离。减Ⅰ中同源染色体成对排列、同源伙伴分离。'][tab];
    };modalRenderer=render;$('compRange').oninput=render;render();
  }
  const questions=[
    {time:4.76,angle:.72,ans:0,opts:['减Ⅰ中期','减Ⅱ中期','减Ⅰ后期'],why:'长、短两对同源染色体各自成对排列，伙伴面对不同的两极。'},
    {time:5.87,angle:-.68,ans:2,opts:['有丝分裂后期','减Ⅱ后期','减Ⅰ后期'],why:'各有一条长和一条短染色体移向一极，每条仍有两条姐妹染色单体。'},
    {time:10.86,angle:1.15,ans:1,opts:['减Ⅰ中期','减Ⅱ后期','减Ⅰ后期'],why:'这一个次级细胞内，长染色体的姐妹分开，短染色体的姐妹也分开。每一极有两条子染色体。'}
  ];
  function quiz(i=0){
    const q=questions[i];openBox('判图练习 · '+(i+1)+' / '+questions.length,'<p>观察赤道面两侧的染色体，判断图中的时期。</p><canvas class="questionCanvas" id="question"></canvas><div class="choicebar">'+q.opts.map((v,k)=>'<button data-answer="'+k+'">'+v+'</button>').join('')+'</div><p id="feedback" class="feedback" aria-live="polite"></p><div class="rows"><button id="reviewClip" hidden>回看对应动画</button><button id="another" hidden>'+(i===2?'再练一轮':'下一题')+'</button></div>');
    const s=Biology.scene(q.time,{...opt,egg:false});modalRenderer=()=>Diagram.draw($('question'),s,{span:q.time>7?5:6,roll:q.angle,target:q.time>7?s.g.mid[0].center:[0,0,0]});modalRenderer();
    $('dialogBody').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{$('feedback').textContent=(+b.dataset.answer===q.ans?'判断正确。':'答案是'+q.opts[q.ans]+'。')+q.why;$('reviewClip').hidden=$('another').hidden=false;});
    on('another',()=>quiz((i+1)%3));on('reviewClip',()=>{closeBox();changeRoute(false);seek(q.time);});
  }
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='compare')compare();else if(b.dataset.nav==='quiz')quiz();else if($('dialog').open)closeBox();});
  window.addEventListener('resize',()=>draw());
  new ResizeObserver(()=>draw()).observe($('stage'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();sync();}});
  document.addEventListener('keydown',e=>{if($('dialog').open||/INPUT|SELECT|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();play();}if(e.key==='ArrowRight')$('next').click();if(e.key==='ArrowLeft')$('prev').click();});
  activate('male','female',true);activate('d3','d2',true);setupExperiment();sync();draw();
})();
