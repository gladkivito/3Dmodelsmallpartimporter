// Metadata-only checks. Never reads or uploads model bytes outside the browser.
export function inspectModelColors(meshes,{repairedFaces=0,outlineShells=0}={}){
 const checks=[],rows=[];let textureCount=0,missingUV=0,missingImage=0,transparent=0,tinted=0,vertexColored=0;
 for(const mesh of meshes){
  const g=mesh.geometry,materials=mesh.userData.sourceMaterials||(Array.isArray(mesh.material)?mesh.material:[mesh.material]);
  const row={name:mesh.name||'Unnamed mesh',triangles:Math.round((g.index?.count||g.attributes.position.count)/3),hidden:!mesh.visible,outline:!!mesh.userData.outlineShell,removedReverseFaces:mesh.userData.uvRepairCount||0,materials:[]};
  for(const mat of materials){if(!mat)continue;const maps=[mat.map,mat.emissiveMap].filter(Boolean);let details={name:mat.name||'Unnamed material',textures:maps.map(t=>({width:t.image?.width||0,height:t.image?.height||0,channel:t.channel||0})),opacity:mat.opacity??1,transparent:!!mat.transparent,vertexColors:!!mat.vertexColors,tint:mat.color?.toArray?.()||[1,1,1]};row.materials.push(details);
   if(maps.length){textureCount+=maps.length;if(!g.attributes.uv)missingUV++;for(const map of maps){if(!map.image?.width||!map.image?.height)missingImage++;if((map.channel||0)===1&&!g.attributes.uv1)checks.push({level:'warning',text:`${row.name}: a texture requests UV set 2, but this mesh has no second UV set.`})}}
   if(details.transparent||details.opacity<.99)transparent++;
   if(maps.length&&details.tint.some(x=>x<.95))tinted++;
   if(details.vertexColors)vertexColored++;
  }rows.push(row)
 }
 if(repairedFaces)checks.push({level:'fixed',text:`Removed ${repairedFaces.toLocaleString()} UV-collapsed reverse faces that covered textured surfaces.`});
 if(outlineShells)checks.push({level:'fixed',text:`Excluded ${outlineShells} inverted black outline shell${outlineShells===1?'':'s'} from solid SmallParts.`});
 if(missingUV)checks.push({level:'warning',text:`${missingUV} textured material assignment${missingUV===1?' has':'s have'} no UV coordinates. Re-export the GLB with UVs.`});
 if(missingImage)checks.push({level:'warning',text:`${missingImage} texture${missingImage===1?' is':'s are'} missing or unreadable. Export embedded PNG/JPEG textures.`});
 if(!textureCount)checks.push({level:'info',text:'No embedded image textures found. Colors come from material and vertex colors.'});
 if(tinted)checks.push({level:'info',text:`${tinted} textured material${tinted===1?' has':'s have'} a color tint. The rendered color can differ from the texture image alone.`});
 if(vertexColored)checks.push({level:'info',text:`${vertexColored} material${vertexColored===1?' uses':'s use'} vertex colors in addition to textures or material color.`});
 if(transparent)checks.push({level:'info',text:`${transparent} transparent material${transparent===1?' may':'s may'} look different after Plane Crazy's glass material is applied.`});
 if(!checks.length)checks.push({level:'ok',text:'No obvious texture or geometry problem detected. Compare Original and SmallParts from the same angle.'});
 return {checks,rows,textureCount};
}
