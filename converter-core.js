/* Oriented surface sampling. Depth layers stay independent; no budget-driven deletion. */
import {planScaledParts} from './size-limits.js';
import {sampleMaterial} from './surface-color.js';
import {exposedTriangles} from './surface-visibility.js';
import {choosePlateRectangle} from './plate-packing.js';
import {lineParts} from './thin-lines.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function clipped(poly,x0,y0,x1,y1){let result=poly;for(const[axis,value,sign]of [[0,x0,1],[1,y0,1],[0,x1,-1],[1,y1,-1]]){const next=[];for(let i=0,j=result.length-1;i<result.length;j=i++){const a=result[j],b=result[i],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if((da>=0)!==(db>=0)){const t=da/(da-db);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}if(db>=0)next.push(b)}result=next;if(!result.length)break}return result}
function polygon(poly){let area=0,x=0,y=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const k=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];area+=k;x+=(poly[j][0]+poly[i][0])*k;y+=(poly[j][1]+poly[i][1])*k}return Math.abs(area)<1e-14?null:{area:Math.abs(area)/2,x:x/(3*area),y:y/(3*area)}}
export function fitSurface(data,onProgress=()=>{}){
 const {settings:s,materials}=data,tr=data.triangles,stride=data.vertexStride||11,faceStride=stride*3;
 if(data.mids.length>400000)throw Error('This model exceeds 400,000 triangles. Simplify its geometry before converting.');
 // Resolve at usable surface footprints, never at individual texture texels or below the part minimum.
 const adaptive=s.surfaceMode==='adaptive',smooth=s.surfaceMode==='smooth'||adaptive,quality=(s.resolution||384)/384,cell=Math.max(.1,data.bounds.maxSize/(128*quality))*Math.sqrt(Math.max(.1,s.thickness)/.1),edgeFitError=Math.max(.015,s.thickness*.5),fitError=smooth?Math.max(.015,s.thickness*.85):edgeFitError,layerError=cell;
 let minimum=data.bounds.min,maximum=data.bounds.max;if(!minimum||!maximum){minimum=[Infinity,Infinity,Infinity];maximum=[-Infinity,-Infinity,-Infinity];for(let i=0;i<tr.length;i+=stride)for(let j=0;j<3;j++){minimum[j]=Math.min(minimum[j],tr[i+j]);maximum[j]=Math.max(maximum[j],tr[i+j])}}const faces=[];
 for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){const u=(axis+1)%3,v=(axis+2)%3;faces.push({axis,sign,u,v,w:Math.max(1,Math.ceil((maximum[u]-minimum[u])/cell)),h:Math.max(1,Math.ceil((maximum[v]-minimum[v])/cell)),cells:new Map()})}
 const exposed=s.keepEnclosed!==false?null:(data.exposed||exposedTriangles(data,onProgress));const seen=new Set();let duplicates=0,surfaceTriangles=0,coveredTriangles=0;
 onProgress({type:'progress',value:4,text:'Sampling oriented surfaces and separate depth layers…'});
 for(let ti=0;ti<data.mids.length;ti++){
  if(exposed&&!exposed[ti])continue;
  const start=ti*faceStride,p=[],uv=[],uv1=[],vc=[];for(let k=0;k<3;k++){const o=start+k*stride;p.push(Array.from(tr.subarray(o,o+3)));uv.push([tr[o+6],tr[o+7]]);uv1.push(stride>=13?[tr[o+8],tr[o+9]]:uv[k]);vc.push(Array.from(tr.subarray(o+stride-3,o+stride)))}
  const norm=cross(sub(p[1],p[0]),sub(p[2],p[0]));if(Math.hypot(...norm)<1e-10)continue;surfaceTriangles++;const n=unit(norm),mid=data.mids[ti],mesh=data.meshIds?.[ti]||0,mat=materials[mid];
  // Exact coincident copies (e.g. camera-only duplicate hood) contribute one surface.
  const key=mid+'|'+p.map((q,k)=>q.map(x=>x.toFixed(5)).concat(uv[k].map(x=>x.toFixed(5)),uv1[k].map(x=>x.toFixed(5)),vc[k].map(x=>x.toFixed(4))).join(',')).sort().join('|');if(seen.has(key)){duplicates++;continue}seen.add(key);
  let axis=0;if(Math.abs(n[1])>Math.abs(n[axis]))axis=1;if(Math.abs(n[2])>Math.abs(n[axis]))axis=2;const sign=n[axis]>0?1:-1,f=faces[axis*2+(sign===1?1:0)],{u,v,w,h}=f,xy=p.map(q=>[(q[u]-minimum[u])/cell,(q[v]-minimum[v])/cell]),[a,b,c]=xy,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  const x0=clamp(Math.floor(Math.min(...xy.map(q=>q[0]))),0,w-1),x1=clamp(Math.floor(Math.max(...xy.map(q=>q[0]))),0,w-1),y0=clamp(Math.floor(Math.min(...xy.map(q=>q[1]))),0,h-1),y1=clamp(Math.floor(Math.max(...xy.map(q=>q[1]))),0,h-1);let touched=false,hasCenter=false;for(let yy=y0;yy<=y1&&!hasCenter;yy++)for(let xx=x0;xx<=x1;xx++){const qx=xx+.5,qy=yy+.5,aa=((b[1]-c[1])*(qx-c[0])+(c[0]-b[0])*(qy-c[1]))/den,bb=((c[1]-a[1])*(qx-c[0])+(a[0]-c[0])*(qy-c[1]))/den;if(Math.min(aa,bb,1-aa-bb)>=-1e-6){hasCenter=true;break}}const fallbackX=Math.floor((a[0]+b[0]+c[0])/3),fallbackY=Math.floor((a[1]+b[1]+c[1])/3);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const qx=x+.5,qy=y+.5,aa=((b[1]-c[1])*(qx-c[0])+(c[0]-b[0])*(qy-c[1]))/den,bb=((c[1]-a[1])*(qx-c[0])+(a[0]-c[0])*(qy-c[1]))/den;if(hasCenter?Math.min(aa,bb,1-aa-bb)<-1e-6:x!==fallbackX||y!==fallbackY)continue;const poly=clipped(xy,x,y,x+1,y+1),hit=polygon(poly);if(!hit)continue;const extent=hasCenter?[[x,y],[x+1,y+1]]:poly;
   const l0=((b[1]-c[1])*(hit.x-c[0])+(c[0]-b[0])*(hit.y-c[1]))/den,l1=((c[1]-a[1])*(hit.x-c[0])+(a[0]-c[0])*(hit.y-c[1]))/den,weights=[l0,l1,1-l0-l1],position=[0,0,0],tuv=[0,0],tuv1=[0,0],color=[0,0,0];
   for(let k=0;k<3;k++){for(let j=0;j<3;j++){position[j]+=p[k][j]*weights[k];color[j]+=vc[k][j]*weights[k]}for(let j=0;j<2;j++){tuv[j]+=uv[k][j]*weights[k];tuv1[j]+=uv1[k][j]*weights[k]}}
   const sample=sampleMaterial(mat,tuv,tuv1,color);if(!sample)continue;touched=true;
   const id=y*w+x;let layers=f.cells.get(id);if(!layers)f.cells.set(id,layers=[]);
   // Keep overlapping interior/glass/material layers. Only coplanar samples may share a footprint.
   let q=layers.find(q=>q.mid===mid&&q.mesh===mesh&&Math.abs(dot(sub(position,q.p),q.n))<layerError);
   if(!q){q={p:position,n:[...n],mid,mesh,color:sample.color,alpha:sample.alpha,weight:hit.area,colors:[{c:sample.color,w:hit.area}],min:[Math.min(...extent.map(p=>p[0])),Math.min(...extent.map(p=>p[1]))],max:[Math.max(...extent.map(p=>p[0])),Math.max(...extent.map(p=>p[1]))]};layers.push(q)}else{const total=q.weight+hit.area;for(let j=0;j<3;j++){q.p[j]=(q.p[j]*q.weight+position[j]*hit.area)/total;q.n[j]=(q.n[j]*q.weight+n[j]*hit.area)/total}q.n=unit(q.n);q.alpha=(q.alpha*q.weight+sample.alpha*hit.area)/total;q.weight=total;q.colors.push({c:sample.color,w:hit.area});for(let j=0;j<2;j++){q.min[j]=Math.min(q.min[j],...extent.map(p=>p[j]));q.max[j]=Math.max(q.max[j],...extent.map(p=>p[j]))}}
  }
  if(touched)coveredTriangles++;
  if(ti%2000===0)onProgress({type:'progress',value:5+ti/data.mids.length*65,text:`Sampling surface ${ti.toLocaleString()}/${data.mids.length.toLocaleString()}`});
 }
 seen.clear();
 // Area-weighted dominant source color avoids inventing intermediate colors across texture edges.
 for(const f of faces)for(const layers of f.cells.values())for(const q of layers){let best=q.colors[0],bestWeight=0;const tol=Math.max(1,s.tolerance||0);for(const c of q.colors){let weight=0;for(const b of q.colors)if(Math.max(...c.c.map((v,j)=>Math.abs(v-b.c[j])))<=tol)weight+=b.w;if(weight>bestWeight){best=c;bestWeight=weight}}q.color=best.c;delete q.colors}
 if(s.surfaceMode==='voxel'){
  const occupied=new Map();for(const f of faces)for(const layers of f.cells.values())for(const q of layers){const ijk=q.p.map((v,i)=>Math.floor((v-minimum[i])/cell)),key=`${q.mesh}|${q.mid}|${ijk.join(',')}`,old=occupied.get(key);if(!old||q.weight>old.weight)occupied.set(key,{q,ijk,weight:q.weight})}
  const parts=[];let glass=0;for(const {q,ijk} of occupied.values()){
   const mat=materials[q.mid];if(mat.glass)glass++;
   parts.push({p:ijk.map((v,i)=>minimum[i]+(v+.5)*cell),s:[cell,cell,cell],basis:[1,0,0,0,1,0,0,0,1],c:q.color,a:q.alpha,mat:mat.glass?'g':mat.mat||'s',meshId:q.mesh,patchId:parts.length});
  }
  if(!parts.length)throw Error('No visible surfaces were found. Check mesh visibility and material opacity.');
  return{parts,expectedCount:planScaledParts(parts,s.scale||100).count,resolution:s.resolution||384,cell,stats:{inputTriangles:data.mids.length,denseRemoved:data.denseRemoved||0,denseStepUsed:data.denseStepUsed||0,surfaceTriangles,coveredTriangles,duplicateTriangles:duplicates,patches:parts.length,glassPieces:glass,method:'voxel-surface'}};
 }
 const parts=[];let glass=0,packingSaved=0,optimizedFaces=0;
 for(const f of faces){const{axis,sign,u,v,w,h,cells}=f,frontAxis=s.front?.includes('x')?0:2,frontSign=s.front?.startsWith('-')?-1:1,tolerance=Math.max(1,s.tolerance||0)*(s.detail&&axis===frontAxis&&sign===frontSign?.7:1);
  const pack=mode=>{for(const layers of cells.values())for(const q of layers)q.used=false;const fitted=[];let glassCount=0;
  const plan=(x,y,base)=>{const n=base.n,du=[0,0,0],dv=[0,0,0];du[u]=1;du[axis]=-n[u]/n[axis];dv[v]=1;dv[axis]=-n[v]/n[axis];const dl=Math.hypot(...du),xx=du.map(q=>q/dl),yy=cross(n,xx),shear=Math.abs(dot(dv,xx)),vy=Math.abs(dot(dv,yy)),cos=Math.cos(Math.min(smooth?.6:.45,(smooth?.32:.2)*Math.sqrt(s.thickness/.1)));
   const samePaint=q=>{const a=materials[base.mid],b=materials[q.mid];return q.mid===base.mid||smooth&&a.glass===b.glass&&(a.mat||'s')===(b.mat||'s')};
   const compatible=q=>q&&!q.used&&q.mesh===base.mesh&&samePaint(q)&&Math.max(...q.color.map((c,i)=>Math.abs(c-base.color[i])))<=tolerance&&Math.abs(q.alpha-base.alpha)<.08&&dot(q.n,n)>cos&&Math.abs(dot(sub(q.p,base.p),n))<=fitError;
   const find=(x,y)=>(cells.get(y*w+x)||[]).find(compatible);let rw=1,rh=1;
   if(mode!=='row')[rw,rh]=choosePlateRectangle(x,y,w,h,cell,dl,shear,vy,find);
   else{while(x+rw<w&&cell*((rw+1)*dl+shear)<=2.49&&find(x+rw,y))rw++;
    outer:while(y+rh<h&&cell*(rw*dl+(rh+1)*shear)<=2.49&&cell*(rh+1)*vy<=2.49){for(let i=0;i<rw;i++)if(!find(x+i,y+rh))break outer;rh++}}
   return{n,xx,yy,dl,shear,vy,find,rw,rh};
  };
  const emit=(x,y,base)=>{if(base.used)return;const {n,xx,yy,dl,shear,vy,find,rw,rh}=plan(x,y,base);
   const used=[];for(let j=0;j<rh;j++)for(let i=0;i<rw;i++){const q=i===0&&j===0?base:find(x+i,y+j);q.used=true;used.push(q)}
   // Fit to actual clipped extents at single-cell edges; don't turn a tiny triangle into a full cell.
   const bx0=Math.min(...used.map(q=>q.min[0])),by0=Math.min(...used.map(q=>q.min[1])),bx1=Math.max(...used.map(q=>q.max[0])),by1=Math.max(...used.map(q=>q.max[1])),cx=(bx0+bx1)/2,cy=(by0+by1)/2;
   const position=[...base.p];position[u]=minimum[u]+cx*cell;position[v]=minimum[v]+cy*cell;position[axis]=base.p[axis]-(n[u]*(position[u]-base.p[u])+n[v]*(position[v]-base.p[v]))/n[axis];for(let k=0;k<3;k++)position[k]-=n[k]*s.thickness*.5;
   const sx=1.012*cell*((bx1-bx0)*dl+(by1-by0)*shear),sy=1.012*cell*(by1-by0)*vy,mat=materials[base.mid];if(mat.glass)glassCount++;
   fitted.push({p:position.map(v=>+v.toFixed(6)),s:[sx,sy,s.thickness].map((v,i)=>Math.max(1e-6,+(i<2&&v>2.5&&v<=2.5+edgeFitError*3?2.5:v).toFixed(6))),basis:[...xx,...yy,...n],c:base.color,a:base.alpha,mat:mat.glass?'g':mat.mat||'s',meshId:base.mesh,patchId:0});
   if(parts.length+fitted.length>120000)throw Error('This detail setting produces over 120,000 source pieces. Increase plate thickness or use Draft surface accuracy. No partial build was kept.');
  };
   if(mode==='global'){
    // Consider the largest covered rectangles first. This keeps sparse or
    // irregular regions from being fragmented by a row-first decision.
    const candidates=[];for(const [key,layers] of cells)for(const base of layers){const x=key%w,y=Math.floor(key/w),{rw,rh}=plan(x,y,base);candidates.push({x,y,base,score:rw*rh})}
    candidates.sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);
    for(const {x,y,base} of candidates)emit(x,y,base);
   }else for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const base of cells.get(y*w+x)||[])emit(x,y,base);
   return{parts:fitted,glass:glassCount};
  };
  const baseline=pack('row'),better=s.efficientPacking===false?null:pack('rectangle'),global=adaptive?pack('global'):null,oldCount=planScaledParts(baseline.parts,s.scale||100).count,newCount=better?planScaledParts(better.parts,s.scale||100).count:Infinity,globalCount=global?planScaledParts(global.parts,s.scale||100).count:Infinity;
  const chosen=globalCount<Math.min(oldCount,newCount)?global:newCount<oldCount?better:baseline;if(chosen!==baseline){packingSaved+=oldCount-(chosen===global?globalCount:newCount);optimizedFaces++}
  glass+=chosen.glass;for(const part of chosen.parts){part.patchId=parts.length;parts.push(part)}
  onProgress({type:'progress',value:75+faces.indexOf(f)*3,text:`Merging compatible surface plates · ${parts.length.toLocaleString()} pieces`});
 }
 if(!parts.length)throw Error('No visible surfaces were found. Check mesh visibility and material opacity.');
 return{parts,expectedCount:planScaledParts(parts,s.scale||100).count,resolution:s.resolution||384,cell,stats:{inputTriangles:data.mids.length,denseRemoved:data.denseRemoved||0,denseStepUsed:data.denseStepUsed||0,surfaceTriangles,coveredTriangles,duplicateTriangles:duplicates,patches:parts.length,glassPieces:glass,fitError,edgeError:cell,packingSaved,optimizedFaces,method:adaptive?'adaptive-surface':smooth?'smooth-budget-surface':'layered-oriented-surface'}};
}

export function convertSurface(data,onProgress=()=>{}){
 // Opt-in: sample at the physical target size, then store plates in source
 // coordinates so the existing editor and 5–200% resize path still work.
 // This lets the 0.1-stud floor eliminate sub-minimum detail on tiny builds.
 const scale=(data.settings.scale||100)/100;
 if(data.settings.scaleAware&&Math.abs(scale-1)>1e-8){
  const triangles=new Float32Array(data.triangles),stride=data.vertexStride||11;
  for(let i=0;i<triangles.length;i+=stride){triangles[i]*=scale;triangles[i+1]*=scale;triangles[i+2]*=scale}
  const bounds={...data.bounds,maxSize:data.bounds.maxSize*scale};
  for(const key of ['min','max'])if(bounds[key])bounds[key]=bounds[key].map(v=>v*scale);
  const settings={...data.settings,scale:100,scaleAware:false,height:data.settings.height*scale,zones:data.settings.zones?.map(z=>({...z,center:z.center.map(v=>v*scale),size:z.size.map(v=>v*scale)}))};
  const lineMeshes=data.lineMeshes?.map(line=>({...line,points:line.points.map(p=>p.map(v=>v*scale)),width:line.width*scale}));
  const result=convertSurface({...data,triangles,bounds,lineMeshes,settings},onProgress);
  for(const part of result.parts){part.p=part.p.map(v=>v/scale);part.s=part.s.map(v=>v/scale)}
  result.expectedCount=planScaledParts(result.parts,data.settings.scale).count;
  result.stats={...result.stats,scaleAware:true,targetScale:data.settings.scale};
  return result;
 }
 if(data.lineMeshes?.length){
  const cables=lineParts(data.lineMeshes,data.materials),cableCount=planScaledParts(cables,data.settings.scale||100).count;
  const body=data.mids.length?convertSurface({...data,lineMeshes:null,settings:{...data.settings,budget:Math.max(1,data.settings.budget-cableCount)}},onProgress):{parts:[],stats:{inputTriangles:0,denseRemoved:data.denseRemoved||0,method:'thin-lines'},resolution:data.settings.resolution||384};
  for(const part of cables){part.patchId=body.parts.length;body.parts.push(part)}
  body.expectedCount=planScaledParts(body.parts,data.settings.scale||100).count;
  body.stats={...body.stats,cableMeshes:data.lineMeshes.length,cableParts:cables.length};
  return body;
 }
 if(data.settings.zones?.length)return convertRegions(data,onProgress);
 if(data.settings.resolution!==0)return fitSurface(data,onProgress);
 const settings=data.settings,prepared={...data,exposed:settings.keepEnclosed===false?exposedTriangles(data,onProgress):null};let best=null,smallest=null,last=512,passes=0;
 const run=resolution=>{passes++;onProgress({type:'progress',value:Math.min(90,5+passes*7),text:`Fitting budget · surface resolution ${resolution} · plates remain ${settings.thickness} studs`});const r=fitSurface({...prepared,settings:{...settings,resolution}},()=>{});if(!smallest||r.expectedCount<smallest.expectedCount)smallest=r;return r};
 for(const resolution of[384,288,224,176,144,112,96,80,64]){const r=run(resolution);if(r.expectedCount<=settings.budget){best=r;let lo=resolution,hi=last;for(let i=0;i<4&&hi-lo>4;i++){const mid=Math.round((lo+hi)/2),q=run(mid);if(q.expectedCount<=settings.budget){best=q;lo=mid}else hi=mid}break}last=resolution}
 const result=best||smallest;result.stats.autoBudget=true;result.stats.budgetFit=!!best;result.stats.passes=passes;return result;
}

// Whole triangles are assigned to one local sampling grid, so region boundaries
// cannot silently delete surfaces. The default, zone-free converter is unchanged.
function convertRegions(data,onProgress){
 const zones=data.settings.zones.filter(z=>z.detail>=.35&&z.detail<=3&&z.size.every(n=>n>0));
 if(!zones.length)return convertSurface({...data,settings:{...data.settings,zones:[]}},onProgress);
 const stride=data.vertexStride||11,faceStride=stride*3,buckets=Array.from({length:zones.length+1},()=>({triangles:[],mids:[],meshIds:[],exposed:[]}));
 const exposure=data.settings.keepEnclosed===false?exposedTriangles(data,onProgress):null;
 for(let i=0;i<data.mids.length;i++){
  if(exposure&&!exposure[i])continue;
  const base=i*faceStride,center=[0,1,2].map(j=>(data.triangles[base+j]+data.triangles[base+stride+j]+data.triangles[base+2*stride+j])/3);
  let bucket=0;for(let j=0;j<zones.length;j++)if(center.every((n,k)=>Math.abs(n-zones[j].center[k])<=zones[j].size[k]/2))bucket=j+1;
  const target=buckets[bucket];for(let k=0;k<faceStride;k++)target.triangles.push(data.triangles[base+k]);target.mids.push(data.mids[i]);target.meshIds.push(data.meshIds?.[i]||0);if(exposure)target.exposed.push(exposure[i]);
 }
 const prepared=buckets.map(b=>({...data,triangles:new Float32Array(b.triangles),mids:new Int32Array(b.mids),meshIds:new Int32Array(b.meshIds),exposed:exposure?new Uint8Array(b.exposed):null}));
 const settings=data.settings;let passes=0,best=null,smallest=null,last=512;
 const run=resolution=>{
  passes++;onProgress({type:'progress',value:Math.min(90,5+passes*6),text:`Balancing local detail · pass ${passes} · resolution ${resolution}`});
  const results=[];for(let i=0;i<prepared.length;i++)if(prepared[i].mids.length){const quality=i?zones[i-1].detail:1;results.push(fitSurface({...prepared[i],settings:{...settings,keepEnclosed:true,resolution:Math.max(24,Math.round(resolution*quality)),zones:[]}},()=>{}))}
  const parts=results.flatMap(r=>r.parts);parts.forEach((p,i)=>p.patchId=i);
  const stats={...results[0]?.stats};for(const key of ['surfaceTriangles','coveredTriangles','duplicateTriangles','glassPieces','packingSaved','optimizedFaces'])stats[key]=results.reduce((n,r)=>n+(r.stats[key]||0),0);
  const result={parts,expectedCount:planScaledParts(parts,settings.scale||100).count,resolution,cell:null,stats:{...stats,regions:zones.length,passes}};
  if(!smallest||result.expectedCount<smallest.expectedCount)smallest=result;return result;
 };
 if(settings.resolution!==0)return run(settings.resolution);
 for(const resolution of [384,288,224,176,144,112,96,80,64,48,32]){const r=run(resolution);if(r.expectedCount<=settings.budget){best=r;let lo=resolution,hi=last;for(let i=0;i<4&&hi-lo>4;i++){const mid=Math.round((lo+hi)/2),q=run(mid);if(q.expectedCount<=settings.budget){best=q;lo=mid}else hi=mid}break}last=resolution}
 const result=best||smallest;result.stats.autoBudget=true;result.stats.budgetFit=!!best;result.stats.passes=passes;return result;
}
