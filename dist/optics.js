/* Orthographic life-science renderer. All inputs are in the model's world units. */
(function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const origin = [0, 0, 0];
  const white = [1, 1, 1];
  const colorCache = new Map();
  function colorOf(hex) {
    if (!hex) return white;
    if (colorCache.has(hex)) return colorCache.get(hex);
    let digits = hex.replace('#', '');
    if (digits.length === 3) digits = digits.split('').map(x => x + x).join('');
    const n = Number.parseInt(digits, 16);
    const c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    colorCache.set(hex,c);
    return c;
  }
  const norm = a => {
    const length = Math.hypot(...a) || 1;
    return [a[0]/length,a[1]/length,a[2]/length];
  };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const mix = (a,b,t) => a + (b-a)*t;
  function cameraFor(canvas,opts) {
    const width = Math.max(1,canvas.clientWidth || canvas.width);
    const height = Math.max(1,canvas.clientHeight || canvas.height);
    const ratio = Math.min(2,Math.max(1,window.devicePixelRatio||1),2300/Math.max(width,height))*(opts.quality||1);
    const w = Math.max(1,Math.round(width*ratio)), h = Math.max(1,Math.round(height*ratio));
    if (w !== canvas.width || h !== canvas.height) { canvas.width=w;canvas.height=h; }
    const cy = Math.cos(opts.yaw||0), sy = Math.sin(opts.yaw||0);
    const cp = Math.cos(opts.pitch||0), sp = Math.sin(opts.pitch||0);
    const right = [cy,0,-sy], up = [-sy*sp,cp,-cy*sp], front = [sy*cp,sp,cy*cp];
    const target = opts.target||origin, span = Math.max(0.001,(opts.span||8)/(opts.zoom||1));
    const sx = 2*height/(width*span), sy2 = 2/span, sz = -1/Math.max(64,span*8);
    const clip = new Float32Array([
      right[0]*sx,up[0]*sy2,front[0]*sz,0,
      right[1]*sx,up[1]*sy2,front[1]*sz,0,
      right[2]*sx,up[2]*sy2,front[2]*sz,0,
      -dot(right,target)*sx,-dot(up,target)*sy2,-dot(front,target)*sz,1
    ]);
    const pixels = height/span;
    const project = p => {
      const v = sub(p,target);
      return [width*.5+dot(v,right)*pixels,height*.5-dot(v,up)*pixels,dot(v,front)];
    };
    const light = norm(front.map((v,i)=>.85*v-.54*right[i]+.72*up[i]));
    return {clip,width,height,front,right,up,light,project,pixels,ratio,cut:opts.cut};
  }

  // Two daughter poles may be separated in the final layout. First weld the
  // shrinking furrow to one shared rim, then let the sealed poles move apart.
  function weldOffsets(shells) {
    const groups=new Map(), offsets=new Map();
    for(const s of shells){
      if(!s.cap)continue;
      const key=s.cap.origin.join(',')+'/'+s.axis+'/'+s.cap.split;
      const pair=groups.get(key)||[];
      pair.push(s);groups.set(key,pair);
    }
    for(const pair of groups.values()){
      if(pair.length!==2)continue;
      const poles=pair.map(s=>s.center.map((x,i)=>x-(i===s.axis?s.cap.sign*s.radii[i]:0)));
      pair.forEach((s,i)=>offsets.set(s,poles[i].map((x,k)=>(poles[1-i][k]-x)*.5)));
    }
    return offsets;
  }
  const shellVertex = `
    precision highp float;
    attribute vec3 aParam;
    uniform mat4 uClip;
    uniform vec3 uCenter,uRadii,uOrigin,uParent,uWeld;
    uniform float uAxis,uNeck,uBias,uCap,uSplit,uProgress;
    varying mediump vec3 vNormal,vLocal,vRadial;
    vec3 rotateAxis(vec3 v) {return uAxis<0.5 ? vec3(v.y,-v.x,v.z):v;}
    void main(){
      float u=aParam.z;
      float thetaSign = uCap>0.5 ? -1.0:1.0;
      vec3 er=rotateAxis(vec3(aParam.x,0.0,aParam.y*thetaSign));
      vec3 et=rotateAxis(vec3(-aParam.y,0.0,aParam.x*thetaSign));
      vec3 ea=rotateAxis(vec3(0.0,1.0,0.0));
      float phi=u*3.14159265;
      float y=cos(phi), r=sin(phi);
      vec3 P, Du, Dt;
      if(abs(uCap)>0.5){
        float q=mix(uSplit,uCap,u),dq=uCap-uSplit;
        float rp=sqrt(max(0.0,1.0-q*q));
        float drp=-q*dq/max(0.0001,rp);
        float q2=-uCap*y;
        float morph=min(1.0,uProgress/.90);
        float amp=exp(-u*u*28.0)*(1.0-smoothstep(.90,1.0,uProgress));
        vec3 parentPos=uOrigin+uParent*(ea*q+er*rp);
        vec3 daughterPos=uCenter+uRadii*(ea*q2+er*r)+uWeld*amp;
        P=mix(parentPos,daughterPos,morph);
        Du=mix(uParent*(ea*dq+er*drp),uRadii*(ea*uCap*r+er*y)*3.14159265-uWeld*(56.0*u*amp),morph);
        Dt=et*mix(uParent*max(0.0001,rp),uRadii*max(0.0001,r),morph);
      }else{
        float k=0.31, v=(y-uBias)/k;
        float notch=clamp(uNeck,0.0,.995)*exp(-v*v);
        float g=1.0-notch, dg=2.0*v*notch/k;
        P=uCenter+uRadii*(ea*y+er*r*g);
        Du=uRadii*(-ea*r+er*(y*g-r*r*dg));
        Dt=et*uRadii;
      }
      vNormal=normalize(cross(Dt,Du));
      vLocal=er*r+ea*y;
      vRadial=P-mix(uCenter,mix(uOrigin,uCenter,uProgress),step(.5,abs(uCap)));
      gl_Position=uClip*vec4(P,1.0);
    }`;
  const shellFragment = `
    precision mediump float;
    uniform vec3 uColor,uFront,uLight;
    uniform float uAlpha,uKind,uCut;
    varying mediump vec3 vNormal,vLocal,vRadial;
    void main(){
      vec3 n=normalize(vNormal);
      float lam=max(0.,dot(n,uLight));
      float nv=abs(dot(n,uFront));
      float rim=pow(1.0-nv,2.2);
      float shine=pow(max(0.,dot(n,normalize(uLight+uFront))),26.0);
      if(uKind<.5){
        gl_FragColor=vec4(uColor*(.44+.60*lam)+shine*.32+uColor*rim*.13,uAlpha);
        return;
      }
      float cutDepth=dot(normalize(vRadial+vec3(.00001)),uFront);
      if(uCut>.5 && cutDepth>.12)discard;
      float cutEdge=uCut*exp(-abs(cutDepth-.12)*80.);
      float band=sin(vLocal.x*27.+vLocal.y*8.+vLocal.z*12.+sin(vLocal.z*19.)*.5);
      float fine=sin(91.*vLocal.y+cos(vLocal.z*40.))*sin(75.*vLocal.x);
      float pore=.5+.5*band;
      float glass=.14+rim*.76+shine*.12+cutEdge*.34;
      if(!gl_FrontFacing)glass*=.55;
      vec3 hue=uColor*(.32+.40*lam+.46*rim+.05*pore)+vec3(.70,.92,.92)*(.16*rim+.16*shine+.18*cutEdge);
      hue+=uColor*(.014*fine+.022*band);
      if(uKind>1.5){hue=mix(hue,vec3(.73,.85,1.),.11);glass*=.9;}
      gl_FragColor=vec4(hue,clamp(glass*uAlpha,0.,.97));
    }`;
  const tubeVertex = `
    precision highp float;
    attribute vec3 aPosition,aNormal;
    attribute vec4 aColor;
    attribute float aAlong;
    uniform mat4 uClip;
    varying mediump vec3 vN; varying mediump vec4 vCol; varying mediump float vAlong;
    void main(){vN=aNormal;vCol=aColor;vAlong=aAlong;gl_Position=uClip*vec4(aPosition,1.0);}`;
  const tubeFragment = `
    precision mediump float;
    uniform vec3 uLight,uFront;
    varying mediump vec3 vN;varying mediump vec4 vCol;varying mediump float vAlong;
    void main(){
      vec3 n=normalize(vN);
      float lam=max(0.,dot(n,uLight));
      float glint=pow(max(0.,dot(n,normalize(uLight+uFront))),26.);
      float rim=pow(1.-abs(dot(n,uFront)),2.);
      float ridges=.026*cos(vAlong*6.4+dot(n,vec3(2.2,1.3,2.8)));
      vec3 color=vCol.rgb*(.47+.58*lam+.12*rim+ridges)+vec3(.23)*glint;
      gl_FragColor=vec4(color,vCol.a);
    }`;

  function program(gl,vert,frag,names) {
    const shaders=[];
    const compile=(type,source)=>{
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      shaders.push(shader);return shader;
    };
    const p=gl.createProgram();
    gl.attachShader(p,compile(gl.VERTEX_SHADER,vert));
    gl.attachShader(p,compile(gl.FRAGMENT_SHADER,frag));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    shaders.forEach(s=>gl.deleteShader(s));
    const locations={};
    for(const name of names.split(' '))locations[name]=name.startsWith('a')?gl.getAttribLocation(p,name):gl.getUniformLocation(p,name);
    return {p,...locations};
  }
  function paramGrid(gl,cols=64,rows=40) {
    const vertices=[], indices=[];
    for(let j=0;j<=rows;j++){
      for(let i=0;i<=cols;i++){
        const a=i/cols*TAU;
        vertices.push(Math.cos(a),Math.sin(a),j/rows);
        if(j<rows&&i<cols){
          const k=j*(cols+1)+i;
          indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
        }
      }
    }
    const vb=gl.createBuffer(),ib=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    return {vb,ib,count:indices.length};
  }

  // Regular path rings use a transported frame so curved threads keep their round cross-section.
  class TubeBatch {
    constructor(gl){
      this.gl=gl;
      this.buffer=gl.createBuffer();this.elements=gl.createBuffer();
      this.values=new Float32Array(11*8192);this.indices=new Uint16Array(48000);
      this.used=0;this.count=0;this.sides=10;
      this.ring=Array.from({length:this.sides},(_,i)=>[Math.cos(TAU*i/this.sides),Math.sin(TAU*i/this.sides)]);
    }
    grow(v,i){
      if(v*11>this.values.length){const x=new Float32Array(Math.max(v*11,2*this.values.length));x.set(this.values);this.values=x;}
      if(i>this.indices.length){const x=new Uint16Array(Math.max(i,2*this.indices.length));x.set(this.indices);this.indices=x;}
    }
    vertex(p,n,c,a,along){
      const k=this.used++*11,v=this.values;
      v[k]=p[0];v[k+1]=p[1];v[k+2]=p[2];v[k+3]=n[0];v[k+4]=n[1];v[k+5]=n[2];
      v[k+6]=c[0];v[k+7]=c[1];v[k+8]=c[2];v[k+9]=a;v[k+10]=along;
    }
    tube(path){
      const input=path.points;
      if(!input||input.length<2||path.radius<=0||path.alpha===0)return;
      const points=[];
      for(const p of input){const prev=points[points.length-1];if(!prev||Math.abs(prev[0]-p[0])+Math.abs(prev[1]-p[1])+Math.abs(prev[2]-p[2])>1e-7) points.push(p);}
      if(points.length<2)return;
      const N=this.sides, r=path.radius,c=colorOf(path.color),alpha=path.alpha??1;
      const rings=points.length+4, first=this.used;
      if(first+rings*N>65000){this.flush();}
      const start=this.used;
      this.grow(start+rings*N,this.count+(rings-1)*N*6);
      let side,along=0;
      const addRing=(pos,t,a,b,scale,offset,angle)=>{
        const ca=Math.cos(angle),sa=Math.sin(angle);
        for(const [x,y] of this.ring){
          const nx=a[0]*x+b[0]*y,ny=a[1]*x+b[1]*y,nz=a[2]*x+b[2]*y;
          this.vertex([pos[0]+r*(nx*scale+t[0]*offset),pos[1]+r*(ny*scale+t[1]*offset),pos[2]+r*(nz*scale+t[2]*offset)],
            [nx*ca+t[0]*sa,ny*ca+t[1]*sa,nz*ca+t[2]*sa],c,alpha,along);
        }
      };
      for(let j=0;j<points.length;j++){
        const p=points[j];
        const t=norm(sub(points[Math.min(points.length-1,j+1)],points[Math.max(0,j-1)]));
        if(!side||Math.abs(dot(t,side))>.995)side=norm(cross(t,Math.abs(t[1])<.86?[0,1,0]:[1,0,0]));
        const other=norm(cross(t,side));
        side=norm(cross(other,t));
        if(j===0){
          addRing(p,t,side,other,.001,-1,-Math.PI/2);
          addRing(p,t,side,other,.70,-.71,-Math.PI/4);
        }else{along+=Math.hypot(...sub(p,points[j-1]))/r;}
        addRing(p,t,side,other,1,0,0);
        if(j===points.length-1){
          addRing(p,t,side,other,.70,.71,Math.PI/4);
          addRing(p,t,side,other,.001,1,Math.PI/2);
        }
      }
      const idx=this.indices;
      for(let j=0;j<rings-1;j++)for(let i=0;i<N;i++){
        const k=start+j*N+i,b=start+j*N+(i+1)%N;
        idx[this.count++]=k;idx[this.count++]=b;idx[this.count++]=k+N;
        idx[this.count++]=b;idx[this.count++]=b+N;idx[this.count++]=k+N;
      }
    }
    disc(plane){
      if(!plane.radius||plane.alpha===0)return;
      const N=48;this.grow(this.used+N+1,this.count+3*N);
      const c=colorOf(plane.color),p=plane.center,a=plane.alpha??.14;
      const n=plane.axis===0?[1,0,0]:[0,1,0];
      const start=this.used;
      this.vertex(p,n,c,a,0);
      for(let i=0;i<N;i++){
        const q=TAU*i/N,b=Math.cos(q)*plane.radius,d=Math.sin(q)*plane.radius;
        this.vertex([p[0]+(plane.axis===0?0:b),p[1]+(plane.axis===0?b:0),p[2]+d],n,c,a,0);
        this.indices[this.count++]=start;this.indices[this.count++]=start+1+i;this.indices[this.count++]=start+1+(i+1)%N;
      }
    }
    flush(){
      if(!this.count)return;
      const gl=this.gl,p=this.program;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,this.values.subarray(0,this.used*11),gl.DYNAMIC_DRAW);
      for(const [loc,size,offset] of [[p.aPosition,3,0],[p.aNormal,3,12],[p.aColor,4,24],[p.aAlong,1,40]]){
        gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,44,offset);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.elements);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.indices.subarray(0,this.count),gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
      [p.aPosition,p.aNormal,p.aColor,p.aAlong].forEach(loc=>gl.disableVertexAttribArray(loc));
      this.used=this.count=0;
    }
  }
  function createGL(gl){
    const shell=program(gl,shellVertex,shellFragment,
      'aParam uClip uCenter uRadii uOrigin uParent uWeld uAxis uNeck uBias uCap uSplit uProgress uColor uFront uLight uAlpha uKind uCut');
    const tube=program(gl,tubeVertex,tubeFragment,'aPosition aNormal aColor aAlong uClip uLight uFront');
    const mainGrid=paramGrid(gl),smallGrid=paramGrid(gl,18,12),batch=new TubeBatch(gl);
    batch.program=tube;
    function bindOptics(p,cam) {
      gl.useProgram(p.p);gl.uniformMatrix4fv(p.uClip,false,cam.clip);
      gl.uniform3fv(p.uLight,cam.light);gl.uniform3fv(p.uFront,cam.front);
    }
    function bindGrid(grid){
      gl.bindBuffer(gl.ARRAY_BUFFER,grid.vb);
      gl.enableVertexAttribArray(shell.aParam);gl.vertexAttribPointer(shell.aParam,3,gl.FLOAT,false,12,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,grid.ib);
    }
    let welds=new Map();
    function sphere(s,kind,cam,grid){
      const cap=s.cap;
      gl.uniform3fv(shell.uWeld,welds.get(s)||origin);
      gl.uniform3fv(shell.uCenter,s.center);gl.uniform3fv(shell.uRadii,s.radii);
      gl.uniform3fv(shell.uOrigin,cap?.origin||origin);gl.uniform3fv(shell.uParent,cap?.parentR||white);
      gl.uniform1f(shell.uAxis,s.axis??1);gl.uniform1f(shell.uBias,s.bias||0);gl.uniform1f(shell.uNeck,s.neck||0);
      gl.uniform1f(shell.uCap,cap?.sign||0);gl.uniform1f(shell.uProgress,cap?.progress||0);gl.uniform1f(shell.uSplit,cap?.split||0);
      gl.uniform3fv(shell.uColor,colorOf(s.color));gl.uniform1f(shell.uAlpha,s.alpha??1);
      gl.uniform1f(shell.uKind,kind);gl.uniform1f(shell.uCut,cam.cut&&kind===1?1:0);
      gl.drawElements(gl.TRIANGLES,grid.count,gl.UNSIGNED_SHORT,0);
    }
    const depthOf=(center,cam)=>dot(center,cam.front);
    return {
      render(scene,cam){
        welds=weldOffsets(scene.shells||[]);
        gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
        gl.clearColor(0,0,0,0);gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        const paths=scene.paths||[],beads=scene.beads||[];
        bindOptics(tube,cam);
        for(const path of paths)if((path.alpha??1)>=.995)batch.tube(path);
        batch.flush();
        bindOptics(shell,cam);bindGrid(smallGrid);
        gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
        for(const b of beads)if((b.alpha??1)>=.995)sphere(b,0,cam,smallGrid);
        gl.depthMask(false);
        const shells=(scene.shells||[]).filter(s=>(s.alpha??1)>.001)
          .slice().sort((a,b)=>depthOf(a.center,cam)-depthOf(b.center,cam));
        bindGrid(mainGrid);gl.cullFace(gl.FRONT);
        for(const s of shells)sphere(s,s.nuclear?2:1,cam,mainGrid);
        gl.disableVertexAttribArray(shell.aParam);
        gl.disable(gl.CULL_FACE);
        bindOptics(tube,cam);
        for(const plane of (scene.planes||[]))batch.disc(plane);
        batch.flush();
        const transparentPaths=paths.filter(p=>(p.alpha??1)<.995&&p.alpha>0&&p.points.length>1);
        transparentPaths.sort((a,b)=>depthOf(a.points[a.points.length>>1],cam)-depthOf(b.points[b.points.length>>1],cam));
        for(const path of transparentPaths)batch.tube(path);
        batch.flush();
        bindOptics(shell,cam);bindGrid(smallGrid);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
        for(const b of beads)if((b.alpha??1)<.995&&b.alpha>0)sphere(b,0,cam,smallGrid);
        bindGrid(mainGrid);
        // Nuclear envelopes lie inside plasma membranes even when their centers coincide.
        for(const nuclear of [true,false])for(const s of shells)if(!!s.nuclear===nuclear)sphere(s,nuclear?2:1,cam,mainGrid);
        gl.disableVertexAttribArray(shell.aParam);
        gl.depthMask(true);gl.disable(gl.CULL_FACE);
      },
      dispose(){
        for(const b of [mainGrid.vb,mainGrid.ib,smallGrid.vb,smallGrid.ib,batch.buffer,batch.elements])gl.deleteBuffer(b);
        gl.deleteProgram(shell.p);gl.deleteProgram(tube.p);
      }
    };
  }

  // The 2D fallback projects the same changing meshes and paths at reduced tessellation.
  // Include both halves of a furrow even when its local axis points out of the screen.
  function shellPoint(s,u,t,weld){
    const co=Math.cos(t),si=Math.sin(t);
    const position=(center,radii,q,radial)=>{
      const p=s.axis===0 ? [q,-co*radial,si*radial]:[co*radial,q,si*radial];
      return center.map((v,i)=>v+radii[i]*p[i]);
    };
    const cap=s.cap,phi=Math.PI*u;
    if(cap){
      const q=mix(cap.split,cap.sign,u);
      const a=position(cap.origin,cap.parentR,q,Math.sqrt(Math.max(0,1-q*q)));
      const b=position(s.center,s.radii,-cap.sign*Math.cos(phi),Math.sin(phi));
      const unseal=clamp((cap.progress-.90)/.1,0,1);
      const amplitude=Math.exp(-28*u*u)*(1-unseal*unseal*(3-2*unseal));
      return a.map((v,i)=>mix(v,b[i]+weld[i]*amplitude,Math.min(cap.progress/.90,1)));
    }
    const q=Math.cos(phi),d=(q-(s.bias||0))/.31;
    return position(s.center,s.radii,q,Math.sin(phi)*(1-(s.neck||0)*Math.exp(-d*d)));
  }
  function createCanvas(ctx){
    function rgba(hex,f,a){const [r,g,b]=colorOf(hex).map(v=>Math.round(clamp(255*v*f,0,255)));return 'rgba('+r+','+g+','+b+','+a+')';}
    const fillPoly=pts=>{ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill();};
    function shellLayers(shell,cam,weld){
      const layers=[[],[]], nu=18,nt=36;
      const grid=Array.from({length:nu+1},(_,j)=>Array.from({length:nt},(_,i)=>shellPoint(shell,j/nu,i*TAU/nt,weld)));
      const projected=grid.map(row=>row.map(cam.project));
      for(let j=0;j<nu;j++)for(let i=0;i<nt;i++){
        const v=(i+1)%nt;
        const a=grid[j][i],b=grid[j][v],c=grid[j+1][v],d=grid[j+1][i];
        const normal=norm(cross(sub(c,a),sub(d,b))).map(n=>shell.cap?.sign===1?-n:n);
        const nv=dot(normal,cam.front),rim=Math.pow(1-Math.abs(nv),1.9);
        const middle=a.map((x,k)=>(x+b[k]+c[k]+d[k])/4);
        const center=shell.cap ? shell.cap.origin.map((x,k)=>mix(x,shell.center[k],shell.cap.progress)):shell.center;
        if(cam.cut&&!shell.nuclear&&dot(norm(sub(middle,center)),cam.front)>.12)continue;
        layers[nv>=0?1:0].push({
          points:[projected[j][i],projected[j][v],projected[j+1][v],projected[j+1][i]],
          tone:.60+.35*Math.max(0,dot(normal,cam.light))+.30*rim,
          alpha:(shell.alpha??.5)*(.10+.78*rim)*(nv>=0?1:.5)
        });
      }
      return layers;
    }
    function shellDraw(layer){
      for(const face of layer.faces){
        ctx.fillStyle=rgba(layer.color,face.tone,face.alpha);
        fillPoly(face.points);
      }
    }
    function pathDraw(p,cam){
      const pts=p.points.map(cam.project);
      ctx.lineWidth=Math.max(.55,2*p.radius*cam.pixels);
      ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=rgba(p.color,.86,p.alpha??1);
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();
      if(ctx.lineWidth>2.5){
        const shift=ctx.lineWidth*.13;ctx.translate(-shift,-shift);ctx.lineWidth*=.32;ctx.strokeStyle=rgba(p.color,1.35,(p.alpha??1)*.8);ctx.stroke();ctx.translate(shift,shift);
      }
    }
    return {
      render(s,c){
        ctx.setTransform(c.ratio,0,0,c.ratio,0,0);ctx.clearRect(0,0,c.width,c.height);
        const welds=weldOffsets(s.shells||[]);
        const layers=(s.shells||[]).map(shell=>({color:shell.color,layers:shellLayers(shell,c,welds.get(shell)||origin)}));
        for(const layer of layers)shellDraw({color:layer.color,faces:layer.layers[0]});
        const items=[];
        for(const p of (s.planes||[])){
          const pts=Array.from({length:48},(_,i)=>{
            const a=i*TAU/48,b=Math.cos(a)*p.radius,d=Math.sin(a)*p.radius;
            return c.project([p.center[0]+(p.axis===0?0:b),p.center[1]+(p.axis===0?b:0),p.center[2]+d]);
          });
          items.push({z:dot(p.center,c.front),draw:()=>{ctx.fillStyle=rgba(p.color,1,p.alpha??.12);fillPoly(pts);}});
        }
        for(const p of (s.paths||[]))if(p.points.length>=2 && p.radius>0)items.push({z:dot(p.points[p.points.length>>1],c.front),draw:()=>pathDraw(p,c)});
        for(const b of (s.beads||[])){
          const [x,y,z]=c.project(b.center),r=Math.max(.25,c.pixels*Math.max(...b.radii));
          items.push({z,draw:()=>{const g=ctx.createRadialGradient(x-r*.28,y-r*.3,r*.03,x,y,r);g.addColorStop(0,rgba(b.color,1.32,b.alpha??1));g.addColorStop(.55,rgba(b.color,1,b.alpha??1));g.addColorStop(1,rgba(b.color,.55,b.alpha??1));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}});
        }
        items.sort((a,b)=>a.z-b.z).forEach(item=>item.draw());
        for(const layer of layers)shellDraw({color:layer.color,faces:layer.layers[1]});
      },
      dispose(){}
    };
  }

  window.Optics=function(canvas){
    let camera=cameraFor(canvas,{}), backend=null,gl=null;
    try{gl=canvas.getContext('webgl',{alpha:true,depth:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false});}catch(_){}
    try{if(gl)backend=createGL(gl);}catch(err){console.warn('WebGL shader setup:',err);}
    let fallbackCanvas=null;
    if(!backend){
      let ctx;
      try{ctx=canvas.getContext('2d');}catch(_){}
      if(!ctx){
        fallbackCanvas=document.createElement('canvas');
        Object.assign(fallbackCanvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
        canvas.insertAdjacentElement('afterend',fallbackCanvas);
        ctx=fallbackCanvas.getContext('2d');
      }
      backend=createCanvas(ctx);
    }
    let lastScene,lastOptions;
    function lost(event){event.preventDefault();}
    function restored(){backend=createGL(gl);if(lastScene)api.render(lastScene,lastOptions);}
    if(gl){canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);}
    const api={
      render(scene,options={}){
        lastScene=scene;lastOptions=options;
        camera=cameraFor(canvas,options);
        if(fallbackCanvas && (fallbackCanvas.width!==canvas.width||fallbackCanvas.height!==canvas.height)){
          fallbackCanvas.width=canvas.width;fallbackCanvas.height=canvas.height;
        }
        if(!gl||!gl.isContextLost())backend.render(scene,camera);
      },
      project(point){return camera.project(point);},
      mode:gl&&!fallbackCanvas?'webgl':'canvas',
      dispose(){
        canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
        backend.dispose();fallbackCanvas?.remove();lastScene=null;
      }
    };
    return api;
  };
})();
