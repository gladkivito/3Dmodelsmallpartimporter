// Drop only physical minimum-size plates fully covered by another plate of the
// same visible appearance and source mesh. The original editable parts stay intact.
export function removeCoveredMinimumParts(physical,source,scale=1){
 const cell=2.5,key=p=>[p.meshId,p.mat||'s',p.c.join(','),(p.a??1).toFixed(5),...p.basis.map(n=>n.toFixed(4))].join('|');
 const bins=new Map(),positionKey=p=>p.p.map(n=>Math.floor(n/cell)),bucket=(group,x,y,z)=>`${group}@${x},${y},${z}`;
 physical.forEach((p,i)=>{const[x,y,z]=positionKey(p),id=bucket(key(p),x,y,z);if(!bins.has(id))bins.set(id,[]);bins.get(id).push(i)});
 const kept=[];let removed=0;
 for(let i=0;i<physical.length;i++){
  const p=physical[i],original=source[p.sourceIndex];
  if(!original||!original.s.some((n,axis)=>n*scale<.1-1e-6&&p.s[axis]<=.100001)){kept.push(p);continue}
  const [x,y,z]=positionKey(p),group=key(p),volume=p.s[0]*p.s[1]*p.s[2];let covered=false;
  for(let dx=-1;dx<=1&&!covered;dx++)for(let dy=-1;dy<=1&&!covered;dy++)for(let dz=-1;dz<=1&&!covered;dz++){
   for(const j of bins.get(bucket(group,x+dx,y+dy,z+dz))||[]){if(j===i)continue;const q=physical[j],other=q.s[0]*q.s[1]*q.s[2];if(other<volume-1e-8||Math.abs(other-volume)<1e-8&&j>i)continue;
    const delta=p.p.map((n,k)=>n-q.p[k]);let contains=true;
    for(let axis=0;axis<3;axis++){
     const b=q.basis.slice(axis*3,axis*3+3),center=Math.abs(delta.reduce((n,v,k)=>n+v*b[k],0));
     let radius=0;for(let own=0;own<3;own++){const a=p.basis.slice(own*3,own*3+3);radius+=Math.abs(a.reduce((n,v,k)=>n+v*b[k],0))*p.s[own]/2}
     if(center+radius>q.s[axis]/2+1e-5){contains=false;break}
    }
    if(contains){covered=true;break}
   }
  }
  if(covered)removed++;else kept.push(p);
 }
 return{parts:kept,removed};
}
