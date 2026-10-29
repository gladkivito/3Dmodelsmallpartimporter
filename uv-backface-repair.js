// Some GLBs contain a second, inward-facing shell whose UVs are collapsed to
// one atlas corner. Remove it only when the geometry strongly confirms that
// pattern; normal interior and untextured surfaces remain untouched.
export function repairCollapsedUVBackfaces(mesh){
 const g=mesh.geometry,uv=g.attributes.uv,pos=g.attributes.position;
 if(!uv||!pos||!mesh.material||!(Array.isArray(mesh.material)?mesh.material.some(m=>m.map):mesh.material.map))return 0;
 const index=g.index,count=index?index.count:pos.count;if(count<600)return 0;
 const groups=g.groups.length?g.groups:[{start:0,count,materialIndex:0}];
 const triangles=[],good=[],bad=[];
 for(const group of groups)for(let i=group.start;i+2<Math.min(count,group.start+group.count);i+=3){
  const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),v=ids.map(id=>[pos.getX(id),pos.getY(id),pos.getZ(id)]),u=ids.map(id=>[uv.getX(id),uv.getY(id)]);
  const uvArea=Math.abs((u[1][0]-u[0][0])*(u[2][1]-u[0][1])-(u[2][0]-u[0][0])*(u[1][1]-u[0][1]))/2;
  const a=v[1].map((x,k)=>x-v[0][k]),b=v[2].map((x,k)=>x-v[0][k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n)||1;
  const tri={ids,group,center:v[0].map((x,k)=>(x+v[1][k]+v[2][k])/3),normal:n.map(x=>x/len),uvArea};triangles.push(tri);
  if(uvArea<1e-8)bad.push(tri);else if(uvArea>1e-6)good.push(tri);
 }
 if(bad.length<100||bad.length/triangles.length<.35||bad.length/triangles.length>.85||good.length<100)return 0;
 g.computeBoundingBox();const box=g.boundingBox,cell=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z)*.0025;if(!cell)return 0;
 const key=(x,y,z)=>`${x},${y},${z}`,coords=p=>p.map(x=>Math.floor(x/cell)),buckets=new Map();
 for(const tri of good){const c=coords(tri.center),k=key(...c);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(tri)}
 let paired=0,sampled=0,step=Math.max(1,Math.floor(bad.length/2000));
 for(let i=0;i<bad.length;i+=step){sampled++;const tri=bad[i],c=coords(tri.center);let match=false;
  for(let x=-1;x<=1&&!match;x++)for(let y=-1;y<=1&&!match;y++)for(let z=-1;z<=1&&!match;z++)for(const other of buckets.get(key(c[0]+x,c[1]+y,c[2]+z))||[]){
   const d=tri.center.reduce((s,v,k)=>s+(v-other.center[k])**2,0),dot=tri.normal.reduce((s,v,k)=>s+v*other.normal[k],0);
   if(d<cell*cell&&dot<-.8){match=true;break}
  }if(match)paired++;
 }
 if(paired/sampled<.65)return 0;
 const indices=[],newGroups=[];for(const group of groups){const start=indices.length;for(const tri of triangles)if(tri.group===group&&tri.uvArea>=1e-8)indices.push(...tri.ids);newGroups.push({start,count:indices.length-start,materialIndex:group.materialIndex})}
 g.setIndex(indices);g.clearGroups();for(const group of newGroups)g.addGroup(group.start,group.count,group.materialIndex);
 mesh.userData.uvRepairCount=bad.length;return bad.length;
}
