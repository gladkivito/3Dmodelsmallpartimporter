// Some GLBs contain both a detailed mesh and a coarse VLO copy at the same
// position. Keeping both spends SmallParts on two versions of one surface.
export function duplicateVLOIndices(meshes){
 const names=new Set(meshes.map(m=>m.name.toLowerCase()));const skip=[];
 for(let i=0;i<meshes.length;i++){
  const name=meshes[i].name.toLowerCase();if(!/(?:^|[_. -])vlo(?=[_. -]|$)/.test(name))continue;
  const detailed=name.replace(/(^|[_. -])vlo(?=[_. -]|$)/,'$1').replace(/__+/g,'_');
  if(names.has(detailed))skip.push(i);
 }
 return skip;
}
