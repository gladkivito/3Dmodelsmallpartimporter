// Detect an inverted, solid-black offset copy of another textured mesh. This
// is a common toon-outline technique: backface culling reveals only its rim.
// SmallParts are solid, so building the whole shell would cover the colors.
function blackMaterial(mat){
 if(!mat||mat.side!==0||mat.transparent||mat.opacity<.99||Math.max(mat.emissive?.r||0,mat.emissive?.g||0,mat.emissive?.b||0)>.03)return false;
 if(mat.color?.r<.03&&mat.color?.g<.03&&mat.color?.b<.03)return true;
 const im=mat.map?.image;if(!im?.width||!im?.height)return false;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});try{ctx.drawImage(im,0,0,8,8);const px=ctx.getImageData(0,0,8,8).data;for(let i=0;i<px.length;i+=4)if(px[i]>24||px[i+1]>24||px[i+2]>24||px[i+3]<200)return false;return true}catch{return false}
}
function triangles(mesh){const g=mesh.geometry,p=g.attributes.position,idx=g.index,count=idx?idx.count:p.count,out=[];
 for(let i=0;i+2<count;i+=3){const v=[0,1,2].map(k=>{const j=idx?idx.getX(i+k):i+k;return[p.getX(j),p.getY(j),p.getZ(j)]}),a=v[1].map((x,k)=>x-v[0][k]),b=v[2].map((x,k)=>x-v[0][k]);const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n)||1;out.push({c:v[0].map((x,k)=>(x+v[1][k]+v[2][k])/3),n:n.map(x=>x/len)})}return out}
function invertedCopy(base,shell){
 if(base.parent!==shell.parent||!base.matrix.equals(shell.matrix))return false;
 const count=m=>(m.geometry.index?.count||m.geometry.attributes.position.count)/3;
 if(count(base)<100||Math.abs(count(base)-count(shell))/count(base)>.05)return false;
 base.geometry.computeBoundingBox();const bb=base.geometry.boundingBox,cell=Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z)*.015;if(!cell)return false;
 const key=(x,y,z)=>`${x},${y},${z}`,grid=new Map(),q=p=>p.map(x=>Math.floor(x/cell));
 for(const t of triangles(base)){const k=key(...q(t.c));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(t)}
 const all=triangles(shell),step=Math.max(1,Math.floor(all.length/1000));let matches=0,samples=0;
 for(let i=0;i<all.length;i+=step){samples++;const t=all[i],c=q(t.c);let found=false;
  for(let x=-1;x<=1&&!found;x++)for(let y=-1;y<=1&&!found;y++)for(let z=-1;z<=1&&!found;z++)for(const other of grid.get(key(c[0]+x,c[1]+y,c[2]+z))||[]){
   const d=t.c.reduce((s,v,k)=>s+(v-other.c[k])**2,0),dot=t.n.reduce((s,v,k)=>s+v*other.n[k],0);
   if(d<cell*cell&&dot<-.8){found=true;break}
  }if(found)matches++;
 }return matches/samples>.8;
}
export function markInvertedOutlineShells(meshes){let count=0;
 for(const shell of meshes){const mat=Array.isArray(shell.material)?null:shell.material;if(!blackMaterial(mat))continue;
  for(const base of meshes){if(base===shell||base.parent!==shell.parent)continue;
   if(invertedCopy(base,shell)){shell.userData.outlineShell=true;count++;break}
  }
 }return count;
}
