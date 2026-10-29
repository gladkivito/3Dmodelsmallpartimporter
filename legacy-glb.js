const EXT='KHR_materials_pbrSpecularGlossiness';
const MAGIC=0x46546c67,JSON_CHUNK=0x4e4f534a;
// Translate only the deprecated spec/gloss materials that GLTFLoader does not handle.
// Diffuse data carries the visible colour. The spec/gloss texture is not a colour map.
export function translateLegacyGLB(buffer){
 const view=new DataView(buffer);if(buffer.byteLength<20||view.getUint32(0,true)!==MAGIC||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)return{buffer,converted:0};
 const chunks=[];for(let at=12;at+8<=buffer.byteLength;){const length=view.getUint32(at,true),type=view.getUint32(at+4,true);if(at+8+length>buffer.byteLength)throw Error('GLB has a truncated chunk.');chunks.push({type,bytes:new Uint8Array(buffer,at+8,length)});at+=8+length;if(at!==buffer.byteLength&&at+8>buffer.byteLength)throw Error('GLB has an invalid chunk boundary.')} 
 if(!chunks.length||chunks[0].type!==JSON_CHUNK)return{buffer,converted:0};
 const gltf=JSON.parse(new TextDecoder().decode(chunks[0].bytes).trim());let converted=0;
 for(const material of gltf.materials||[]){const legacy=material.extensions?.[EXT];if(!legacy)continue;
  const diffuse=legacy.diffuseFactor||[1,1,1,1];
  material.pbrMetallicRoughness={...(material.pbrMetallicRoughness||{}),baseColorFactor:[...diffuse],metallicFactor:0,roughnessFactor:Math.max(0,Math.min(1,1-(legacy.glossinessFactor??1)))};
  if(legacy.diffuseTexture)material.pbrMetallicRoughness.baseColorTexture={...legacy.diffuseTexture};
  delete material.extensions[EXT];if(!Object.keys(material.extensions).length)delete material.extensions;converted++;
 }
 if(!converted)return{buffer,converted:0};
 gltf.extensionsUsed=(gltf.extensionsUsed||[]).filter(x=>x!==EXT);gltf.extensionsRequired=(gltf.extensionsRequired||[]).filter(x=>x!==EXT);
 const raw=new TextEncoder().encode(JSON.stringify(gltf)),padded=new Uint8Array(Math.ceil(raw.length/4)*4);padded.fill(0x20);padded.set(raw);chunks[0].bytes=padded;
 const size=12+chunks.reduce((n,c)=>n+8+c.bytes.length,0),out=new ArrayBuffer(size),dst=new DataView(out),bytes=new Uint8Array(out);dst.setUint32(0,MAGIC,true);dst.setUint32(4,2,true);dst.setUint32(8,size,true);
 let at=12;for(const chunk of chunks){dst.setUint32(at,chunk.bytes.length,true);dst.setUint32(at+4,chunk.type,true);bytes.set(chunk.bytes,at+8);at+=8+chunk.bytes.length}
 return{buffer:out,converted};
}
