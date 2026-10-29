/* Conservative multi-view visibility. Glass never hides the interior behind it. */
import {sampleMaterial} from './surface-color.js';
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
export function exposedTriangles(data,onProgress=()=>{}){
 const tr=data.triangles,stride=data.vertexStride||11,count=data.mids.length,visible=new Uint8Array(count),faces=[],vertices=[];
 for(let i=0;i<count;i++){const p=[];for(let k=0;k<3;k++){const o=(i*3+k)*stride;p.push(Array.from(tr.subarray(o,o+3)))}vertices.push(p);if(data.materials[data.mids[i]].glass)visible[i]=1}
 for(const direction of [[1,0,0],[0,1,0],[0,0,1],[1,.45,1],[1,.45,-1],[-1,.45,1],[-1,.45,-1]]){
  const n=unit(direction),u=unit(cross(Math.abs(n[1])<.9?[0,1,0]:[1,0,0],n)),v=cross(n,u);let min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const p of vertices)for(const q of p){const x=dot(q,u),y=dot(q,v);min[0]=Math.min(min[0],x);min[1]=Math.min(min[1],y);max[0]=Math.max(max[0],x);max[1]=Math.max(max[1],y)}
  const cell=Math.max(max[0]-min[0],max[1]-min[1])/256,w=Math.ceil((max[0]-min[0])/cell)+1,h=Math.ceil((max[1]-min[1])/cell)+1,lo=new Float32Array(w*h).fill(Infinity),hi=new Float32Array(w*h).fill(-Infinity),lid=new Int32Array(w*h).fill(-1),hid=new Int32Array(w*h).fill(-1),projected=[];
  for(let i=0;i<count;i++){
   const mat=data.materials[data.mids[i]],p=vertices[i].map(q=>[(dot(q,u)-min[0])/cell,(dot(q,v)-min[1])/cell,dot(q,n)]);projected.push(p);if(mat.glass)continue;const[a,b,c]=p,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)continue;
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(w-1,Math.floor(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(h-1,Math.floor(Math.max(a[1],b[1],c[1])));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const xx=x+.5,yy=y+.5,l0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den,l1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den,l2=1-l0-l1;if(Math.min(l0,l1,l2)<-1e-7)continue;
    // Alpha cutouts and decals must not act as opaque walls.
    if(mat.opacity<.99||mat.alphaTest||mat.texture){const uv=[0,0],uv1=[0,0],vc=[0,0,0],ws=[l0,l1,l2];for(let k=0;k<3;k++){const o=(i*3+k)*stride;for(let j=0;j<2;j++){uv[j]+=tr[o+6+j]*ws[k];uv1[j]+=(stride>=13?tr[o+8+j]:tr[o+6+j])*ws[k]}for(let j=0;j<3;j++)vc[j]+=tr[o+stride-3+j]*ws[k]}const sample=sampleMaterial(mat,uv,uv1,vc);if(!sample||sample.alpha<.95)continue}
    const id=y*w+x,z=a[2]*l0+b[2]*l1+c[2]*l2;if(z<lo[id]){lo[id]=z;lid[id]=i}if(z>hi[id]){hi[id]=z;hid[id]=i}
   }
  }
  for(const ids of[lid,hid])for(const id of ids)if(id>=0)visible[id]=1;
  // Keep subpixel triangles and boundaries conservatively if their sampled depth is exposed.
  for(let i=0;i<count;i++){if(visible[i])continue;const p=projected[i];for(const ws of [[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]]){const q=[0,0,0];for(let k=0;k<3;k++)for(let j=0;j<3;j++)q[j]+=p[k][j]*ws[k];const x=Math.max(0,Math.min(w-1,Math.floor(q[0]))),y=Math.max(0,Math.min(h-1,Math.floor(q[1]))),id=y*w+x;if(q[2]<=lo[id]+cell*.65||q[2]>=hi[id]-cell*.65){visible[i]=1;break}}}
  onProgress({type:'progress',value:1+faces.length,text:`Checking enclosed surfaces · view ${faces.length+1}/7`});faces.push(direction);
 }
 return visible;
}
