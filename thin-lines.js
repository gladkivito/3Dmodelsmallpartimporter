// Fit a thin, open tube as a polyline in world-space studs. A conservative
// cross-section check prevents a bent ribbon or several ropes being flattened
// into one line. The source mesh itself is never changed.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=v=>Math.hypot(...v);
export function fitThinLine(points){
 if(points.length<12)return null;
 const center=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length),cov=Array.from({length:3},()=>[0,0,0]);
 for(const p of points){const d=sub(p,center);for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i][j]+=d[i]*d[j]}
 // Seed with the largest diagonal; power iteration finds the long direction.
 const seed=[0,1,2].reduce((best,i)=>cov[i][i]>cov[best][best]?i:best,0);let axis=[0,1,2].map(i=>i===seed?1:0);
 for(let n=0;n<20;n++){const next=cov.map(row=>dot(row,axis)),norm=length(next);if(norm<1e-12)return null;axis=next.map(x=>x/norm)}
 const projection=points.map(p=>dot(sub(p,center),axis)),low=Math.min(...projection),high=Math.max(...projection),span=high-low;
 if(span<1.2)return null;
 const count=Math.max(2,Math.ceil(span/.55)),bins=Array.from({length:count},()=>({sum:[0,0,0],items:[]}));
 for(let i=0;i<points.length;i++){const b=bins[Math.min(count-1,Math.floor((projection[i]-low)/span*count))];for(let k=0;k<3;k++)b.sum[k]+=points[i][k];b.items.push(i)}
 const centers=bins.map(b=>b.items.length?b.sum.map(x=>x/b.items.length):null);if(!centers[0]||!centers.at(-1))return null;
 for(let i=0;i<centers.length;i++)if(!centers[i]){const start=i-1;while(i<centers.length&&!centers[i])i++;if(i===centers.length||i-start>3)return null;for(let j=start+1;j<i;j++)centers[j]=centers[start].map((v,k)=>v+(centers[i][k]-v)*(j-start)/(i-start))}
 let radius=0;
 for(let j=0;j<bins.length;j++){
  if(!bins[j].items.length)continue;const distances=bins[j].items.map(i=>{const d=sub(points[i],centers[j]),along=dot(d,axis);return Math.sqrt(Math.max(0,dot(d,d)-along*along))}).sort((a,b)=>a-b);
  radius=Math.max(radius,distances[Math.floor((distances.length-1)*.95)]);
 }
 if(radius>.12)return null;
 const sorted=projection.map((u,i)=>[u,i]).sort((a,b)=>a[0]-b[0]),endCount=Math.max(4,Math.floor(points.length*.01));
 const endpoint=list=>[0,1,2].map(k=>list.reduce((s,entry)=>s+points[entry[1]][k],0)/list.length);
 const candidates=[endpoint(sorted.slice(0,endCount)),...centers,endpoint(sorted.slice(-endCount))],path=[candidates[0]];
 for(let i=1;i<candidates.length-1;i++){
  const a=path.at(-1),b=candidates[i],c=candidates[i+1],v=sub(c,a),l2=dot(v,v),t=l2?Math.max(0,Math.min(1,dot(sub(b,a),v)/l2)):0;
  const deviation=length(sub(b,a.map((x,k)=>x+t*v[k])));
  if(deviation>.045||length(v)>2.4)path.push(b);
 }
 path.push(candidates.at(-1));
 if(path.some((p,i)=>i&&length(sub(p,path[i-1]))>2.49))return null;
 // Check the whole surface, including endpoints, before replacing its mesh.
 let maxError=0;for(const p of points){let nearest=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],v=sub(path[i],a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/dot(v,v)));nearest=Math.min(nearest,length(sub(p,a.map((x,k)=>x+t*v[k]))))}maxError=Math.max(maxError,nearest);if(maxError>.1)return null}
 return{points:path,width:Math.max(.1,radius*2),maxError};
}

export function lineParts(lines,materials){const parts=[];
 for(const line of lines){const mat=materials[line.mid],sample=line.color||[255,255,255];for(let i=1;i<line.points.length;i++){
  const a=line.points[i-1],b=line.points[i],dir=sub(b,a),len=length(dir);if(len<1e-5)continue;
  const x=dir.map(n=>n/len),helper=Math.abs(x[1])<.9?[0,1,0]:[0,0,1],z=[x[1]*helper[2]-x[2]*helper[1],x[2]*helper[0]-x[0]*helper[2],x[0]*helper[1]-x[1]*helper[0]],zl=length(z),zn=z.map(n=>n/zl),y=[zn[1]*x[2]-zn[2]*x[1],zn[2]*x[0]-zn[0]*x[2],zn[0]*x[1]-zn[1]*x[0]];
  parts.push({p:a.map((v,k)=>(v+b[k])/2),s:[len,line.width,line.width],basis:[...x,...y,...zn],c:sample,a:line.alpha??1,mat:mat.glass?'g':mat.mat||'s',meshId:line.meshId,patchId:0});
 }}return parts;
}
