// Cluster over-tessellated mesh vertices in world space before surface sampling.
// Faces whose three corners no longer form an area are omitted; kept faces use
// shared centroids, avoiding cracks between adjacent tiny triangles.
export function clusterWorldVertices(mesh,step,THREE){
 const count=mesh.geometry.attributes.position.count,ids=new Uint32Array(count),centers=[],byCell=new Map(),p=new THREE.Vector3();
 for(let i=0;i<count;i++){
  mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);
  const key=`${Math.round(p.x/step)},${Math.round(p.y/step)},${Math.round(p.z/step)}`;
  let id=byCell.get(key);if(id===undefined){id=centers.length;byCell.set(key,id);centers.push({x:0,y:0,z:0,count:0})}
  const c=centers[id];c.x+=p.x;c.y+=p.y;c.z+=p.z;c.count++;ids[i]=id;
 }
 const position=new Float32Array(count*3);
 for(let i=0;i<count;i++){const c=centers[ids[i]],o=i*3;position[o]=c.x/c.count;position[o+1]=c.y/c.count;position[o+2]=c.z/c.count}
 return{ids,position,keeps(a,b,c){if(ids[a]===ids[b]||ids[b]===ids[c]||ids[a]===ids[c])return false;const i=a*3,j=b*3,k=c*3,ux=position[j]-position[i],uy=position[j+1]-position[i+1],uz=position[j+2]-position[i+2],vx=position[k]-position[i],vy=position[k+1]-position[i+1],vz=position[k+2]-position[i+2];return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-8}};
}
