// Orthographic drawing of the same world-space geometry, including the cytokinetic furrow.
(() => {
  const tau=2*Math.PI;
  function prepare(canvas){
    const w=canvas.clientWidth||300,h=canvas.clientHeight||180,d=Math.min(2,window.devicePixelRatio||1);
    if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
    const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    return {ctx,w,h};
  }
  function draw(canvas,scene,cam={}){
    const {ctx,w,h}=prepare(canvas), yaw=cam.yaw||0,pitch=cam.pitch||0, roll=cam.roll||0;
    const target=cam.target||[0,0,0], k=h*(cam.zoom||1)/(cam.span||6.7);
    const proj=p=>{
      const [x,y,z]=p.map((v,i)=>v-target[i]);
      const a=x*Math.cos(yaw)-z*Math.sin(yaw), b=x*Math.sin(yaw)+z*Math.cos(yaw);
      const c=y*Math.cos(pitch)-b*Math.sin(pitch);
      return [w/2+(a*Math.cos(roll)-c*Math.sin(roll))*k,h/2-(a*Math.sin(roll)+c*Math.cos(roll))*k,b*Math.cos(pitch)+y*Math.sin(pitch)];
    };
    function line(pts,color,width,alpha=1){if(!pts.length)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p.slice(0,2)):ctx.moveTo(...p.slice(0,2)));ctx.stroke();}
    ctx.lineJoin=ctx.lineCap='round';
    scene.shells.forEach(s=>{
      const cap=s.cap,axis=s.axis||0,b=1-axis, points=[];
      // Viewed from the fixed textbook side, outline both possible division axes.
      for(let half of [1,-1])for(let j=0;j<=48;j++){
        const u=half===1?j/48:1-j/48,ang=u*Math.PI;
        const p=s.center.slice();
        if(cap){const q=cap.split+(cap.sign-cap.split)*u,q2=-cap.sign*Math.cos(ang),v=cap.progress;
          p[axis]=(cap.origin[axis]+q*cap.parentR[axis])*(1-v)+(s.center[axis]+q2*s.radii[axis])*v;
          p[b]=(cap.origin[b]+half*cap.parentR[b]*Math.sqrt(Math.max(0,1-q*q)))*(1-v)+(s.center[b]+half*s.radii[b]*Math.sin(ang))*v;
        }else{p[axis]+=Math.cos(ang)*s.radii[axis];p[b]+=half*Math.sin(ang)*s.radii[b];}
        points.push(proj(p));
      }
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=s.color;ctx.globalAlpha=s.alpha*.22;ctx.fill();
      ctx.setLineDash(s.nuclear?[4,4]:[]);line(points,s.color,s.nuclear?1:1.7,Math.min(.95,s.alpha*2));ctx.setLineDash([]);
    });
    scene.planes.forEach(p=>{
      let a=p.center.slice(),b=a.slice();a[1-p.axis]-=p.radius;b[1-p.axis]+=p.radius;
      ctx.setLineDash([4,5]);line([proj(a),proj(b)],'#9fd9ad',1,.7);ctx.setLineDash([]);
    });
    [...scene.paths].sort((a,b)=>a.radius-b.radius).forEach(p=>line(p.points.map(proj),p.color,Math.max(.7,2*p.radius*k),p.alpha??1));
    scene.beads.forEach(b=>{const [x,y]=proj(b.center);ctx.fillStyle=b.color;ctx.globalAlpha=b.alpha??1;ctx.beginPath();ctx.arc(x,y,Math.max(1,b.radii[0]*k),0,tau);ctx.fill();});
    ctx.globalAlpha=1;return proj;
  }
  window.Diagram={draw,prepare};
})();
