/* Interactive close-ups. All geometry is reconstructed from the scrub position. */
(() => {
  "use strict";
  let cleanup = () => {};
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, n) => a + (b - a) * n;
  const palette = {
    blue: ["#326a93", "#72b9e2", "#b7e2fa"],
    red: ["#a34e57", "#ee8d91", "#ffd0c5"],
    old: ["#357a89", "#75d1d8", "#c4f8f1"],
    fresh: ["#916e30", "#eebc60", "#ffdf99"]
  };
  const topics = {
    structure: {label:"结构拆解", axis:"拆开程度", left:"联会状态", right:"结构分解", legend:"蓝色 · 父源　珊瑚色 · 母源　金点 · 着丝粒区域",
      notes:["一对同源染色体联会，形成一个四分体。跟着每一条有颜色的纵向结构，从一端沿到另一端。","将两条同源染色体稍稍移开。每一条都由两条姐妹染色单体组成，姐妹来自同一条染色体的复制。","在教学拆解图中，每条染色单体各含一个双链 DNA 分子。虚线标出原先相连接的位置。"],
      terms:[["同源染色体","一条来自父方，一条来自母方。本模型用一对常染色体演示，两条的长度、形态和基因位点相对应，位点上的等位基因可以不同。"],["姐妹与非姐妹染色单体","同一条复制后染色体上的两条染色单体互为姐妹。同一四分体中，分别属于两条同源染色体的染色单体互为非姐妹。"],["着丝粒和动粒","着丝粒是染色体上的特定区域。动粒是组装在该区域的蛋白质结构，纺锤体微管通过动粒连接染色体。金点标记着丝粒所在的区域。"],["染色体为什么有不同形状？","间期的染色质较松散。DNA 在间期复制，随后染色质凝缩。在复制完成、姐妹仍相连时，一个常见的 X 形示意图对应一条染色体。"]]},
    dna: {label:"DNA 复制",axis:"复制进度",left:"一条双链",right:"两条双链",legend:"青色 · 原有的链　金色 · 新合成的链　短线 · 配对碱基",
      notes:["观察一小段双链 DNA。两条原有的链沿同一条轴相互缠绕。拖动进度，让复制叉从左向右移动。","复制叉处的两条原链正在分开，每条原链分别充当模板。观察复制叉左侧，两组新双链都带有一条原链。","每组双链各保留一条原链，称为半保留复制。整条染色体完成复制后有两条姐妹染色单体，染色体数保持不变。"],
      terms:[["这个镜头对应哪个时期？","减数第一次分裂以前的间期，DNA 在 S 期复制。镜头只放大同一条染色体中的一小段 DNA。复制和染色质凝缩是两个事件。"],["数量怎样改变？","在 2n＝4 的模型中，整个细胞完成复制后，核 DNA 分子数从 4 变成 8，染色体数仍为 4。每条染色单体含一个双链 DNA 分子。"],["模型简化了什么？","这里截取一个移动方向的复制叉，并放大两条链之间的距离。真实染色体可有多个复制起点，两条新链的合成方式也有差异。"]]},
    cross: {label:"交叉互换",axis:"互换进度",left:"四分体",right:"互换产物",legend:"蓝色 · 父源片段　珊瑚色 · 母源片段　A/a、B/b · 两个基因位点",
      notes:["观察一个四分体。两条蓝色染色单体都带 AB，两条红色染色单体都带 ab。镜头选取内侧两条非姐妹染色单体。","两条非姐妹染色单体的对应位置靠近。交叉点在 A/a 与 B/b 两个基因位点之间，带 B 或 b 的末端片段将相互交换。","沿四条染色单体由上至下读基因组合，依次是 AB、Ab、aB、ab。外侧两条保持原组合，内侧两条形成重组组合。"],
      terms:[["为什么只交换两条？","这个特写选取一次发生在两条非姐妹染色单体间的交换。真实减数分裂中，交换次数和位置可以不同。"],["片段上的字母表示什么？","A/a 和 B/b 是两个对应位点上的等位基因，位在同一对同源染色体上。字母随其所在 DNA 片段一起移动。"],["这个特写简化了什么？","片段接近、衔接和分开的动作是教学放大。真实重组涉及 DNA 断裂与修复，染色单体并非从整体上滑动互换。身份按着丝粒所在染色体持续追踪。"]]}
  };
  const aliases = {replication:"dna", crossover:"cross", exchange:"cross", dissect:"structure", split:"structure", "拆开观察":"structure","交叉互换":"cross","DNA复制":"dna"};
  const css = `
    .mei-lens{color:#172b2a;font:16px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;display:grid;gap:14px;text-align:left}
    .mei-lens *{box-sizing:border-box}.mei-lens .ml-tabs,.mei-lens .ml-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .mei-lens button{font:inherit;color:#264641;background:#edf2ed;border:1px solid #cbdbd3;border-radius:9px;padding:7px 13px;min-height:42px;cursor:pointer}
    .mei-lens button[aria-pressed=true],.mei-lens .ml-play{background:#1b584c;border-color:#1b584c;color:white}
    .mei-lens button:focus-visible,.mei-lens input:focus-visible{outline:3px solid #ce8e22;outline-offset:2px}
    .mei-lens .ml-field{overflow:hidden;border-radius:14px;background:radial-gradient(ellipse at 53% 40%,#234244,#102729 67%,#0c2024);color:#e5f2e9;position:relative}
    .mei-lens canvas{width:100%;display:block;height:clamp(225px,32vh,345px);touch-action:none;cursor:grab}.mei-lens canvas:active{cursor:grabbing}
    .mei-lens .ml-legend{font-size:13px;line-height:1.5;padding:0 16px 12px;color:#c1d9d1}
    .mei-lens .ml-progress{display:flex;align-items:center;flex:1;min-width:135px;gap:9px}.mei-lens input{accent-color:#287566;min-width:60px;width:100%}
    .mei-lens output{font-variant-numeric:tabular-nums;min-width:3.5em;text-align:right;color:#335f52}
    .mei-lens p,.mei-lens details{margin:0}.mei-lens .ml-note{min-height:3.1em}.mei-lens .ml-hint{font-size:14px;color:#546b63}
    .mei-lens .ml-details details{border-top:1px solid #dbe4df;padding:9px 0}.mei-lens summary{cursor:pointer;font-weight:600}.mei-lens details p{margin:5px 0 0;color:#37564c}
  `;
  const sample = (fn, a=0, b=1, steps=50) => Array.from({length:steps+1},(_,i)=>fn(mix(a,b,i/steps)));
  function mount(container, initialTopic = "structure") {
    cleanup();
    let topic = Object.hasOwn(topics, initialTopic) ? initialTopic : (aliases[initialTopic] || "structure");
    const root = document.createElement("div");
    root.className = "mei-lens";
    root.innerHTML = `<style>${css}</style><div class="ml-tabs" role="group" aria-label="特写主题">${Object.entries(topics).map(([key,m])=>`<button type="button" data-topic="${key}">${m.label}</button>`).join("")}</div><div class="ml-field"><canvas role="img"></canvas><div class="ml-legend"></div></div><div class="ml-tools"><button type="button" class="ml-play">播放</button><label class="ml-progress"><input type="range" min="0" max="1000" step="1"><output></output></label><button type="button" data-zoom="down" aria-label="缩小特写">−</button><button type="button" data-zoom="up" aria-label="放大特写">＋</button><button type="button" data-reset>复位视角</button></div><p class="ml-hint"></p><p class="ml-note"></p><div class="ml-details"></div>`;
    container.replaceChildren(root);
    const el = s => root.querySelector(s);
    const canvas = el("canvas"), ctx = canvas.getContext("2d");
    const slider = el("input"), out = el("output"), play = el(".ml-play");
    let t = 0, yaw = -.13, pitch = .05, zoom = 1, playing = false, frame = 0, previous = 0;
    let shift = 0, width = 650, height = 300, cameraScale = 1;
    let lastNote = -1;
    const pointers = new Map();
    const point = (x,y,z=0)=>({x,y,z});
    function project(p) {
      const xx = p.x*Math.cos(yaw)+p.z*Math.sin(yaw);
      const zz = -p.x*Math.sin(yaw)+p.z*Math.cos(yaw);
      const yy = p.y*Math.cos(pitch)-zz*Math.sin(pitch);
      return [width*.5+xx*cameraScale,height*.5+(yy+shift)*cameraScale,zz];
    }
    function line(points,color,thickness=1) {
      ctx.beginPath(); points.forEach((p,i)=>{const [x,y]=project(p); if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      ctx.strokeStyle=color;ctx.lineWidth=Math.max(.4,thickness*cameraScale);ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
    }
    function tube(curve,pal,radius,a=0,b=1) {
      if (b<=a) return;
      const pts=sample(curve,a,b);
      line(pts,pal[0],radius*2.25);
      line(pts.map(p=>point(p.x-1,p.y-.35,p.z)),pal[1],radius*1.70);
      line(pts.map(p=>point(p.x-2.1,p.y-.7,p.z)),pal[2],radius*.42);
    }
    function dot(p,r,fill,stroke) {
      const [x,y]=project(p);ctx.beginPath();ctx.arc(x,y,r*cameraScale,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4*cameraScale;ctx.stroke();}
    }
    function label(p,txt,color="#edf8f2",size=15,offX=0,offY=0) {
      const [x,y]=project(p);ctx.font=`600 ${Math.max(11, size * Math.min(1.3,cameraScale))}px -apple-system, sans-serif`;
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=3;ctx.strokeStyle="#183235";ctx.strokeText(txt,x+offX*cameraScale,y+offY*cameraScale);
      ctx.fillStyle=color;ctx.fillText(txt,x+offX*cameraScale,y+offY*cameraScale);
    }
    function rod(u, side, id, pairOffset, sisterOffset) {
      const v = 2*u-1;
      return point(side*pairOffset + id*(4+18*Math.pow(Math.abs(v),.85)+sisterOffset) + 5*Math.sin(v*2.7),
        v*82, 5*Math.cos(u*4.7)+id*2);
    }
    function structure(){
      const d=smooth(t,0,.58), e=smooth(t,.42,1);
      for (const side of [-1,1]) {
        const pal=side<0?palette.blue:palette.red;
        const fn = id=>u=>rod(u,side,id,mix(28,105,d),27*e);
        const c1=fn(-1)(.5),c2=fn(1)(.5);
        ctx.setLineDash(e>0?[4,4]:[]);line([c1,c2],"#a99b63",1.7);ctx.setLineDash([]);
        for(const id of [-1,1]){tube(fn(id),pal,5.4);dot(fn(id)(.5),3.6,"#f4d98e","#766a43");}
        
      }
      if(t>.83)label(point(0,109),"教学拆解 · 四条染色单体", "#e0e8d6",14);
    }
    function dna(){
      const end = 160, fork = mix(-end-35,end+40,t);
      const strand = (branch,original)=>(x)=>{
        const opened=smooth(fork-x,0,42);
        const wave=x/12.5;
        const handedness= original?branch:-branch;
        return point(x, branch*44*opened+handedness*Math.cos(wave)*10, handedness*Math.sin(wave)*13);
      };
      const oldLeft = strand(-1,true), oldRight = strand(1,true), newLeft = strand(-1,false), newRight=strand(1,false);
      for(let x=-end;x<=end;x+=4.8) {
        if(x<fork-5) {
          for(const [a,b] of [[oldLeft,newLeft],[oldRight,newRight]]) line([a(x),b(x)],"#9ec8b6",1.6);
        } else if(x>fork+1)line([oldLeft(x),oldRight(x)],"#8fb8b0",1.75);
      }
      function helix(fn, color, limit) {
        for(let x=-end;x<limit;x+=2.9){
          const a=fn(x), b=fn(Math.min(x+3.05,limit));
          line([a,b],a.z>1?color[2]:a.z>-5?color[1]:color[0],3.9);
        }
      }
      for(const fn of [oldLeft,oldRight])helix(fn,palette.old,end);
      for(const fn of [newLeft,newRight])helix(fn,palette.fresh,clamp(fork-4,-end,end));
      if(fork>=-end&&fork<=end){const p=point(fork,0);ctx.setLineDash([3,3]);line([point(fork,-66),p],"#d8e8d4",1);ctx.setLineDash([]);label(point(fork,-77),"复制叉","#d0e8d7",14);}
      if(t>.76){label(point(-112,-77),"子代双链 1", "#d5e8df",14);label(point(-112,82),"子代双链 2","#d5e8df",14);}
    }
    function cross(){
      const contact=smooth(t,.10,.41)*(1-smooth(t,.69,.94));
      const exchange=smooth(t,.43,.69);
      const cut=.64;
      const path=(side,id,u)=>{
        const joint=rod(u,side,id,53,0);
        // Parallel chromatids are spaced apart in this magnified view so gene labels remain distinct.
        joint.x=side*65+id*(20+6*Math.abs(2*u-1));
        const inner=side!==id;
        if(inner) joint.x*=1-contact*Math.exp(-Math.pow((u-cut)/.16,2));
        joint.z=inner?side*contact*3*Math.sin((u-cut)*15):0;
        return joint;
      };
      for(const side of [-1,1]) {
        const pal=side<0?palette.blue:palette.red;
        for(const id of [-1,1]){
          const inner=side!==id;
          const stem=u=>path(side,id,u);
          const tail=u=>{
            const a=stem(u);
            if(!inner)return a;
            const b=path(-side,-id,u);
            return point(mix(a.x,b.x,exchange),a.y,mix(a.z,b.z,exchange)+side*Math.sin(exchange*Math.PI)*Math.max(0,(u-cut)*64));
          };
          tube(stem,pal,5.6,0,cut);tube(tail,pal,5.6,cut,1);
          dot(stem(.43),3.7,"#f2ce82","#9d8459");
          label(stem(.17),side<0?"A":"a",pal[2],17,id*15);
          if(exchange<.25||exchange>.75) label(tail(.86),side<0?"B":"b",pal[2],17,(inner&&exchange>.5?-id:id)*15);
        }
        line([path(side,-1,.43),path(side,1,.43)],"#e9c77a",1.3);
      }
      if(t>.90){
        ["AB","Ab","aB","ab"].forEach((txt,i)=>label(point([-90,-40,40,90][i],101),txt,"#f2ecd6",16));
      }else if(contact>.90){label(point(0,106),"对应片段在两个位点之间交换","#e8e0c4",14);}
    }
    function draw(){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      width=rect.width;height=rect.height;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
      ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
      ctx.clearRect(0,0,width,height);
      cameraScale=Math.min(width/(topic==="structure"?440:390),height/248)*zoom;
      shift=topic==="dna"?0:1;
      if(topic==="structure")structure();else if(topic==="dna")dna();else cross();
      slider.value=String(Math.round(1000*t));out.textContent=Math.round(t*100)+"%";
      const note=t<.18?0:t<.82?1:2;
      if(lastNote!==note){el(".ml-note").textContent=topics[topic].notes[note];lastNote=note;}
    }
    function stop(){
      playing=false;previous=0;cancelAnimationFrame(frame);play.textContent=t>=1?"重播":"播放";
    }
    function tick(now){
      if(!playing || !root.isConnected){stop();return;}
      if(previous)t=clamp(t+Math.min(now-previous,100)/10000);previous=now;draw();
      if(t>=1)stop();else frame=requestAnimationFrame(tick);
    }
    function switchTopic(key) {
      topic=key;t=0;zoom=1;yaw=-.13;pitch=.05;lastNote=-1;stop();
      root.querySelectorAll("[data-topic]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.topic===topic)));
      const info=topics[topic];slider.setAttribute("aria-label",info.axis);canvas.setAttribute("aria-label", info.label+"动态模型");
      el(".ml-legend").textContent=info.legend;el(".ml-hint").textContent=info.left+" 至 "+info.right+" · 拖动滑块可倒放，拖动图像可旋转。"+(topic==="structure"?"这里展示教学拆解。":"");
      el(".ml-details").innerHTML=info.terms.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join("");
      draw();
    }
    root.addEventListener("click",e=>{
      const b=e.target.closest("button");if(!b)return;
      if(b.dataset.topic)switchTopic(b.dataset.topic);
      else if(b===play){if(playing)stop();else{if(t>=1)t=0;playing=true;play.textContent="暂停";frame=requestAnimationFrame(tick);}}
      else if(b.dataset.zoom){zoom=clamp(zoom*(b.dataset.zoom==="up"?1.15:1/1.15),.7,1.75);draw();}
      else if(b.hasAttribute("data-reset")){yaw=-.13;pitch=.05;zoom=1;draw();}
    });
    slider.oninput=()=>{t=Number(slider.value)/1000;stop();draw();};
    canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);};
    canvas.onpointermove=e=>{
      const old=pointers.get(e.pointerId);if(!old)return;
      const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1];
      if(other){const dist=pt=>Math.hypot(pt[0]-other[0],pt[1]-other[1]);zoom=clamp(zoom*dist([e.clientX,e.clientY])/Math.max(1,dist(old)),.7,1.75);}
      else{yaw=clamp(yaw+(e.clientX-old[0])*.008,-1.12,1.12);pitch=clamp(pitch+(e.clientY-old[1])*.008,-.85,.85);}
      pointers.set(e.pointerId,[e.clientX,e.clientY]);draw();
    };
    canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>pointers.delete(e.pointerId);
    const observer=new ResizeObserver(draw);observer.observe(canvas);
    switchTopic(topic);
    cleanup=()=>{stop();observer.disconnect();root.remove();cleanup=()=>{};};
    return cleanup;
  }
  window.Lens={mount,unmount:()=>cleanup()};
})();
