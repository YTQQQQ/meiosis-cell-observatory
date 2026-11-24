// Time is measured in lesson units. Every frame is a pure function of time and options.
(() => {
  const clamp = (x,a=0,b=1)=> Math.min(b,Math.max(a,x));
  const blend=(a,b,u)=>a+(b-a)*u;
  const mix=(a,b,u)=>a.map((v,i)=>blend(v,b[i],u));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const ramp=(t,a,b)=>smooth((t-a)/(b-a));
  const palette=['#74baff','#ff9297'];
  const colors={mem:'#72bdb7',nuc:'#abb4e7',fiber:'#80c3bd',pole:'#f5bf70',eq:'#67c5b3'};
  const zero=[0,0,0], R=2.38;
  const ball=(center,r)=>({center,radii:[r,r*.97,r*.94],r});
  const sphere=(g,color,alpha,extra={})=>({center:g.center,radii:g.radii,color,alpha,...extra});
  function family(egg){
    const root=ball(zero,R);
    const mid=egg?[ball([-.8,0,0],2.12),ball([2.46,0,0],.91)]:
      [ball([-1.94,0,0],1.79),ball([1.94,0,0],1.79)];
    const end=mid.flatMap((g,i)=>{
      const [x]=g.center;
      if(egg && i===0) return [ball([x,-.67,0],1.93),ball([x,2.06,0],.72)];
      return [-1,1].map(s=>ball([x,s*g.r*.85,0],g.r*.75));
    });
    return {root,mid,end};
  }
  function count(t){
    if(t<1) return [4,4,0,2];
    if(t<2 && t>1) return ['4','4→8','形成中','2'];
    if(t===1) return [4,4,0,2];
    if(t<7) return [4,8,8,2];
    if(t<10.14) return [2,4,4,1];
    if(t<12) return [4,4,0,2];
    if(t<13.78) return [2,2,0,1];
    return [4,4,0,2];
  }
  function atFrames(t,keys){
    for(let i=1;i<keys.length;i++) if(t<=keys[i][0])
      return mix(keys[i-1][1],keys[i][1],ramp(t,keys[i-1][0],keys[i][0]));
    return keys[keys.length-1][1];
  }
  function gene(pair,origin,sister,t,opt){
    if(opt.example==='independent')return pair?(origin?'b':'B'):(origin?'a':'A');
    if(pair)return '';
    const swapped=opt.cross && sister===1-origin && t>=3.68;
    return (origin?'a':'A')+((swapped?1-origin:origin)?'b':'B');
  }
  function body(g,t,options,stage){
    const {root,mid,end}=g, list=[],alpha=options.opacity*.70;
    const shell=(geo,extra={})=>list.push(sphere(geo,colors.mem,alpha,extra));
    const divide=(parent,children,axis,split,p)=>{
      children.forEach((child,i)=>shell(child,{axis,cap:{sign:i?1:-1,origin:parent.center,parentR:parent.radii,split,progress:p}}));
    };
    if(t<6)shell(root);
    else if(t<7)divide(root,mid,0,options.egg?.65:0,ramp(t,6,7));
    else if(t<11)mid.forEach(x=>shell(x));
    else if(t<12)mid.forEach((x,i)=>divide(x,end.slice(i*2,i*2+2),1,options.egg&&i===0?.65:0,ramp(t,11,12)));
    else end.forEach((x,i)=>{const u=options.egg?0:ramp(t,12.12,12.94); shell({...x,radii:mix(x.radii,[.48,.57,.38],u)});});
    const nuclei=t<6?[root]:t<7?[]:t<11?mid:t<12?[]:end;
    const f=t<6?1-ramp(t,2.36,3.35):t<11?(1-ramp(t,8,8.7))*ramp(t,7,7.35):ramp(t,12,12.38);
    nuclei.forEach(x=>{if(f>.01){const size=t>=12&&!options.egg?blend(.64,.25,ramp(t,12.12,12.94)):.68;
      list.push(sphere({...x,radii:x.radii.map(z=>z*size)},colors.nuc,.25*f,{nuclear:true}));}});
    return list;
  }
  function scene(t,o){
    if(t>=13) return fertilize(t,o);
    const g=family(o.egg), shells=body(g,t,o),paths=[],beads=[],planes=[],labels=[],items=[];
    const condensed=ramp(t,2,2.92)*(1-.66*ramp(t,6.78,7.30)*(1-ramp(t,8,8.76)))*(1-.87*ramp(t,11.42,12.05));
    const spindleI=ramp(t,2.7,4.2)*(1-ramp(t,5.87,6.87));
    const spindleII=ramp(t,8.05,9.1)*(1-ramp(t,10.83,11.87));
    const addPath=(points,radius,color,alpha=1)=>paths.push({points,radius,color,alpha});
    const bead=(center,radii,color,alpha=1)=>beads.push({center,radii,color,alpha});
    function spindle(geo,axis,active,plate){
      if(active<.01)return;
      [-1,1].forEach(sign=>{
        const p=geo.center.slice();p[axis]+=sign*geo.r*.81;
        bead(p,[.095,.056,.065].map(x=>x*geo.r/1.8),colors.pole,active);
        for(let k=0;k<6;k++){
          const q=p.slice(), a=k*Math.PI/3;q[1-axis]+=.13*Math.sin(a);q[2]+=.12*Math.cos(a);q[axis]+=.18*sign;
          addPath([p,q],.012,colors.pole,active*.7);
        }
      });
      if(plate>.01)planes.push({center:geo.center,axis,radius:geo.r*.78,color:colors.eq,alpha:plate*.14});
    }
    spindle(g.root,0,spindleI,ramp(t,3.85,4.3)*(1-ramp(t,5,5.45)));
    g.mid.forEach(geo=>spindle(geo,1,spindleII,ramp(t,8.86,9.22)*(1-ramp(t,10,10.48))));
    for(let pair=0;pair<2;pair++)for(let h=0;h<2;h++)for(let s=0;s<2;s++){
      const copy=s?ramp(t,1,2):1;
      if(copy<=.001)continue;
      const branch=h^(pair && o.flip?1:0),child=branch*2+s,side=branch?1:-1,sg=s?1:-1;
      const m=g.mid[branch], e=g.end[child], dir=pair?1:-1;
      const early=[(h?1:-1)*(pair?.83:.64),dir*.60,(h-.5)*.40+dir*.15];
      const syn=[(h-.5)*.59,dir*.61,dir*.34];
      const meta=[side*.38,dir*.61,dir*.32];
      const pole=[side*1.40,dir*.51,dir*.16];
      const midpos=[m.center[0]+dir*m.r*.22,m.center[1]+dir*.12,dir*.15*m.r];
      const metaII=[m.center[0]+dir*m.r*.33,0,dir*.12*m.r];
      const late=[m.center[0]+dir*m.r*.23,sg*m.r*.6,dir*m.r*.12];
      const last=[e.center[0]+dir*e.r*.20,e.center[1]+dir*e.r*.08,dir*e.r*.08];
      const position=atFrames(t,[[0,early],[2,early],[2.97,syn],[3.78,syn],[4.66,meta],[5,meta],[5.87,pole],[7,midpos],[8,midpos],[9.35,metaII],[10.14,metaII],[10.94,late],[12,last],[13,last]]);
      const scale=blend(1,m.r/1.65,ramp(t,5.75,7))*(1-ramp(t,11.04,12)*(1-e.r/m.r));
      const form=o.egg?0:ramp(t,12.12,12.94);
      if(form>0){position[0]=blend(position[0],e.center[0]+dir*.08,form);position[1]=blend(position[1],e.center[1],form);}
      const length=(pair?.47:.63)*scale*(1-form*.60);
      const rot=(.12*dir + ramp(t,7.7,9.05)*1.32);
      const id=(pair?'S':'L')+(h?'m':'p'), selected=o.track===id&&(o.trackS==null||t<10.14||o.trackS===s);
      const parentColor=x=>o.color?palette[x]:'#c0cbd0';
      const tint=x=>o.track&&!selected?(o.color?['#60839f','#aa7c81'][x]:'#879393'):parentColor(x);
      const cross=o.example==='linked'&&o.cross&&pair===0&&s===1-h;
      const exchange=ramp(t,3.23,3.68);
      const sisterSpread=ramp(t,1,2)*(1-ramp(t,10.14,10.84));
      function point(v){
        const split=sg*(.024+.18*Math.abs(v)**1.45)*sisterSpread;
        let dx=split*scale,dy=v*length,dz=.08*Math.sin(v*2.3+pair)*scale;
        const wave=(1-condensed)*scale*(1-form*.86);
        dx+=wave*(.21*Math.sin(v*7+pair+2*h)+.13*Math.sin(13*v+h));
        dz+=wave*.21*Math.sin(v*8+pair*2+h);
        dy+=wave*.047*Math.sin(v*10+h);
        const unit=[position[0]+dx*Math.cos(rot)-dy*Math.sin(rot),position[1]+dx*Math.sin(rot)+dy*Math.cos(rot),position[2]+dz];
        // The two inner non-sisters contact at the exchange site, then recoil.
        if(cross)unit[0]+=(h?-1:1)*.26*Math.max(0,(v-.08)/.92)*Math.sin(Math.PI*ramp(t,3.02,3.95));
        return unit;
      }
      const points=Array.from({length:25},(_,i)=>point(i/12-1)),rad=scale*blend(.028,.091,condensed)*(.86+.14*copy)*(1-form*.5);
      const normal=tint(h), donor=tint(1-h);
      addPath(points.slice(0,16),rad,normal,copy);
      const distal=points.slice(15);
      addPath(distal,rad,normal,copy*(cross?1-exchange:1));
      if(cross&&exchange>0)addPath(distal,rad,donor,copy*exchange);
      if(selected){for(const v of [-.95,.07,.94])bead(point(v),[rad*1.15,rad*1.15,rad*1.15],'#ffdb83',copy);}
      const center=point(0);bead(center,[rad*1.1,rad*.9,rad*1.05],o.color?(h?'#c2667a':'#4b91c4'):'#9daeb5',copy);
      const sequence=gene(pair,h,s,t,o);
      const geneLabels=o.example==='independent'?[[.67,sequence]]:pair?[]:[[-.61,sequence[0]],[.81,sequence[1]]];
      if(o.genes&&(!s||ramp(t,10.14,10.84)>.4||cross&&exchange>.6))
        geneLabels.forEach(([v,letter])=>labels.push({at:point(v),text:letter,kind:'gene',color:'#fff0ca'}));
      if(!s||t>10.3)labels.push({at:point(-.98),text:(pair?'短':'长')+(h?'母':'父')+(t>10.3?(s?'②':'①'):''),kind:'id',color:parentColor(h)});
      items.push({id,pair,h,s,center,points,branch,child,sequence});
      if(spindleI>.01 && !s){
        const p=[side*g.root.r*.81,0,0];
        for(let f=-1;f<=1;f++){
          const fiber=Array.from({length:8},(_,n)=>{const u=n/7,v=mix(p,center,u);
            v[1]+=Math.sin(Math.PI*u)*(.08*dir+f*.08);v[2]+=Math.sin(Math.PI*u)*f*.07;return v;});
          addPath(fiber,.012,colors.fiber,spindleI*(f===0?.94:.51));
        }
      }
      if(spindleII>.01){const p=m.center.slice();p[1]+=sg*m.r*.81;
        addPath([p,mix(p,center,.52),center],.012,colors.fiber,spindleII);}
    }
    if(!o.egg && t>12.12){const u=ramp(t,12.12,12.94);
      g.end.forEach((e,i)=>{const pts=Array.from({length:25},(_,j)=>{let v=j/24;return [e.center[0]+v*1.55*u,e.center[1]-.22*u+Math.sin(v*7-t*9+i)*.17*v*u,e.center[2]-.1*v]});addPath(pts,.031,'#8ed4cb',u);});}
    return {shells,paths,beads,planes,labels,items,g};
  }
  function fertilize(t,o){
    const u=ramp(t,13,13.76),f=ramp(t,13.5,13.78);
    const centers=[[-1.92+1.48*u,0,0],[1.92-1.48*u,0,0]];
    const shells=[],paths=[],beads=[],labels=[],items=[];
    centers.forEach((c,i)=>{if(f<1)shells.push(sphere(ball(c,(o.egg?i:1-i)?.76:1.37),colors.mem,o.opacity*.62*(1-f)));});
    if(f>0)shells.push(sphere(ball(zero,1.57),colors.mem,o.opacity*.67*f));
    centers.forEach((c,i)=>{for(let p=0;p<2;p++){
      const h=p&&o.flip?1:0;const id=i?'other'+p:(p?'S':'L')+(h?'m':'p');
      const x=c[0]+(p-.5)*.37, y=(p-.5)*.46;
      const pts=Array.from({length:22},(_,j)=>{const v=j/21;return [x+.09*Math.sin(v*12+p),y+(v-.5)*(p?.56:.88),.13*Math.cos(v*10)]});
      const col=o.color?(i?'#c5abeb':palette[h]):'#bcc6d0';
      if(o.track===id)beads.push({center:pts[10],radii:[.07,.07,.07],color:'#ffdb83'});
      const sc=.047;paths.push({points:pts,radius:sc,color:col});
      if(!p&&!i&&o.example==='linked'&&o.cross&&h===1) paths.push({points:pts.slice(14),radius:sc*1.1,color:palette[1-h]});
      labels.push({at:pts[20],text:i?('另一亲本·'+(p?'短':'长')):(p?'短':'长')+(h?'母':'父'),kind:'id',color:col});
      items.push({id,points:pts,center:pts[10],pair:p,h,s:0,branch:0,child:0,sequence:''});
    }});
    return {shells,paths,beads,labels,items,planes:[],g:family(o.egg)};
  }
  window.Biology={scene,count,family,gene,ramp,clamp};
})();
