import * as THREE from './vendor/three.module.js';

const identity=[1,0,0,0,1,0,0,0,1];
const groupCodes={GlassBlock:'g',MetalBlock:'m',GoldBlock:'m',TitaniumBlock:'m',JetPackUltra:'m',WoodBlock:'w',FabricBlock:'f',CoalBlock:'t'};
const finite=v=>Number.isFinite(Number(v));
const vec=(value,count=3)=>{const a=typeof value==='string'?value.split(',').map(Number):value;if(!Array.isArray(a)||a.length!==count||a.some(v=>!finite(v)))throw Error('A part has invalid position, size, or color values.');return a.map(Number)};
const basisFromRotation=rotation=>{const [x,y,z]=vec(rotation).map(n=>n*Math.PI/180),m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x,y,z,'XYZ')).elements;return[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]};
const basisFromCFrame=value=>{const a=vec(value,12);return[a[3],a[6],a[9],a[4],a[7],a[10],a[5],a[8],a[11]]};
function tableBody(text,name){const match=new RegExp('local\\s+'+name+'\\s*=\\s*\\{').exec(text);if(!match)return null;let depth=1;for(let i=match.index+match[0].length;i<text.length;i++){if(text[i]==='{')depth++;if(text[i]==='}'&&!--depth)return text.slice(match.index+match[0].length,i);if(text[i]==='}'&&depth<0)throw Error('Invalid packed Lua table.')}return null}
function numberSetting(text,name,fallback){const match=new RegExp('local\\s+'+name+'\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)').exec(text);return match?Number(match[1]):fallback}
function importPackedFigure(text){
 if(!/local\s+DATA\s*=\s*table\.concat\s*\(\s*\{/.test(text)||!/local\s+COUNTS\s*=/.test(text)||!/local\s+PAL\s*=/.test(text))return null;
 const counts=tableBody(text,'COUNTS')?.match(/\d+/g)?.map(Number),palette=tableBody(text,'PAL')?.match(/"[0-9a-fA-F]{6}"/g)?.map(x=>x.slice(1,-1));
 const order=tableBody(text,'BONE_ORDER')?.match(/"[a-zA-Z0-9_]+"/g)?.map(x=>x.slice(1,-1));
 const rawData=/local\s+DATA\s*=\s*table\.concat\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(text)?.[1];
 if(!counts?.length||!palette?.length||!order?.length||counts.length!==order.length||!rawData)throw Error('Packed figure is missing its palette, bone order, counts, or DATA.');
 const chunks=[...rawData.matchAll(/"([A-Za-z0-9+/]+)"/g)].map(x=>x[1]),data=chunks.join('');
 if(!chunks.length||data.length!==counts.reduce((a,b)=>a+b,0)*19||counts.reduce((a,b)=>a+b,0)>100000)throw Error('Packed figure DATA length does not match its bone counts (19 characters per plate).');
 const scale=numberSetting(text,'SCALE',1),rockCount=numberSetting(text,'ROCK_COUNT',0),maxParts=numberSetting(text,'MAX_PARTS',100000);
 if(scale<=0||scale>1000||rockCount>10000||maxParts>100000)throw Error('Packed figure has unsupported scale or part limits.');
 const pivots={},parents={};for(const values of (tableBody(text,'PIV')||'').matchAll(/([a-zA-Z0-9_]+)\s*=\s*\{\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\}/g))pivots[values[1]]=values.slice(2,5).map(Number);
 for(const[,name,parent]of (tableBody(text,'PARENT')||'').matchAll(/([a-zA-Z0-9_]+)\s*=\s*"([a-zA-Z0-9_]+)"/g))parents[name]=parent;
 const pivotCache={},pivotOf=(name,seen=new Set())=>{if(pivotCache[name])return pivotCache[name];if(seen.has(name)||!pivots[name])throw Error('Packed figure has an invalid bone hierarchy.');seen.add(name);const base=parents[name]?pivotOf(parents[name],seen):[0,0,0];return pivotCache[name]=base.map((n,i)=>n+pivots[name][i]*scale)};
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',map=new Map([...alphabet].map((c,i)=>[c,i]));let cursor=0;const read=n=>{let v=0;for(let i=0;i<n;i++){const digit=map.get(data[cursor++]);if(digit===undefined)throw Error('Packed figure has an invalid base64 digit.');v=v*64+digit}return v};
 const stats={records:0,splitRecords:0,clampedAxes:0,skipped:0,auxiliary:rockCount},parts=[];
 for(let bi=0;bi<order.length;bi++)for(let i=0;i<counts[bi];i++){
  const local=[0,0,0].map(()=> (read(2)-2048)*.0015*scale),size=[0,0,0].map(()=>Math.max(.1,read(2)*.001*scale)),qb=read(5),m=Math.floor(qb/134217728)%4;
  const components=[Math.floor(qb/262144)%512,Math.floor(qb/512)%512,qb%512].map(n=>n/511*1.4144-.7072),q=[0,0,0,0];let ci=0;for(let t=0;t<4;t++)if(t!==m)q[t]=components[ci++];q[m]=Math.sqrt(Math.max(0,1-q.reduce((sum,n)=>sum+n*n,0)));
  const paletteIndex=read(2);if(paletteIndex>=palette.length)throw Error('Packed figure references a missing colour.');
  const color=palette[paletteIndex].match(/../g).map(x=>parseInt(x,16)),rot=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...q)).elements,basis=[rot[0],rot[1],rot[2],rot[4],rot[5],rot[6],rot[8],rot[9],rot[10]],pivot=pivotOf(order[bi]);
  const position=local.map((n,axis)=>n+pivot[axis]),record={p:position,s:size,b:basis,c:color,m:'s',a:1};
  const expanded=expand(record,'PlasticBlock',stats,true);for(const part of expanded){part.bone=order[bi];part.meshId=bi;part.s=part.s.map(n=>Math.max(.1,Math.floor(n*100+.5)/100))}parts.push(...expanded);stats.records++;
 }
 // Script 1 gives auxiliary rocks a colour and size but no assembled positions.
 // They are counted in the source metadata, never placed at invented coordinates.
 const excess=Math.max(0,parts.length+rockCount-maxParts);if(excess){let remaining=excess,acc=0;const kept=[];for(const part of parts){acc+=excess/parts.length;if(acc>=1&&remaining>0){acc-=1;remaining--;continue}kept.push(part)}stats.skipped=parts.length-kept.length;parts.length=0;parts.push(...kept)}
 if(!parts.length)throw Error('Packed figure has no previewable plates after its part limit.');
 const alignment=normalize(parts);parts.forEach((p,i)=>p.patchId=i);
 return{parts,format:'Packed bone figure',stats,...alignment};
}
function geometryPayload(text){
 const candidates=[];const regex=/JSONDecode\s*\(\s*\[(=*)\[/g;let match;
 while((match=regex.exec(text))){const close=']'+match[1]+']',end=text.indexOf(close,regex.lastIndex);if(end<0)continue;const json=text.slice(regex.lastIndex,end);regex.lastIndex=end+close.length;if(json.length>24*1048576)continue;try{candidates.push(JSON.parse(json))}catch{}}
 if(/^\s*[\[{]/.test(text))try{candidates.push(JSON.parse(text))}catch{}
 const supported=x=>Array.isArray(x)&&x.some(p=>p&&Array.isArray(p.p)&&Array.isArray(p.s))||x&&typeof x==='object'&&Object.entries(x).some(([key,val])=>/Block$|JetPackUltra/.test(key)&&Array.isArray(val)&&val.some(p=>p&&p.Size&&p.Position));
 return candidates.find(supported)||candidates.flatMap(x=>Array.isArray(x)?x:[]).find(supported)||null;
}
function normalize(parts){
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const p of parts)for(let i=0;i<3;i++){const radius=p.s.reduce((n,size,j)=>n+Math.abs(p.basis[j*3+i])*size/2,0);low[i]=Math.min(low[i],p.p[i]-radius);high[i]=Math.max(high[i],p.p[i]+radius)}
 const offset=[-(low[0]+high[0])/2,-low[1],-(low[2]+high[2])/2];for(const p of parts)p.p=p.p.map((v,i)=>+(v+offset[i]).toFixed(6));
 return{bounds:{min:low.map((v,i)=>v+offset[i]),max:high.map((v,i)=>v+offset[i]),maxSize:Math.max(...high.map((v,i)=>v-low[i]))},height:high[1]-low[1]};
}
function expand(record,mat,stats,equalSplit=false){
 const originalSize=vec(record.Size||record.s),position=vec(record.Position||record.p),basis=record.b?vec(record.b,9):record.CFrame?basisFromCFrame(record.CFrame):record.Rotation?basisFromRotation(record.Rotation):identity;
 if(originalSize.some(n=>n<=0)||basis.some(n=>!finite(n)))throw Error('A part has a nonpositive size or invalid rotation.');
 const raw=record.Color??record.c??[1,1,1],color=vec(raw),normalized=record.c?false:Math.max(...color)<=1;
 const rgb=color.map(n=>Math.max(0,Math.min(255,Math.round(normalized?n*255:n))));
 const alpha=typeof record.a==='number'?record.a:1-Number(record.Transparency??record.tr??0);if(!Number.isFinite(alpha))throw Error('A part has invalid transparency.');
 const material=record.m||((record.Transparency??record.tr??0)>.5?'g':groupCodes[mat]||'s');
 const axes=originalSize.map(size=>{const result=[],count=Math.max(1,Math.ceil(size/2.5-1e-6));for(let i=0;i<count;i++)result.push(equalSplit?size/count:Math.min(2.5,size-i*2.5));return result});
 if(axes.some(a=>a.length>1))stats.splitRecords++;
 const result=[];for(let i=0;i<axes[0].length;i++)for(let j=0;j<axes[1].length;j++)for(let k=0;k<axes[2].length;k++){
  const indices=[i,j,k],local=indices.map((n,axis)=>-originalSize[axis]/2+axes[axis].slice(0,n).reduce((a,b)=>a+b,0)+axes[axis][n]/2);
  const p=position.map((v,axis)=>v+local.reduce((sum,n,d)=>sum+n*basis[d*3+axis],0));const s=indices.map((n,axis)=>{const size=axes[axis][n];if(size<.1)stats.clampedAxes++;return Math.max(.1,size)});
  result.push({p,s,basis:[...basis],c:rgb,mat:material,a:Math.max(.01,Math.min(1,alpha)),meshId:0,patchId:result.length,bone:record.Bone||record.bone||null});
 }
 return result;
}
export function importScript1(text){
 if(typeof text!=='string'||text.length>24*1048576)throw Error('Script 1 must be text under 24 MB.');
 const packed=importPackedFigure(text);if(packed)return packed;
 const data=geometryPayload(text);if(!data)throw Error('No supported embedded part data found. This importer reads literal JSONDecode data; it does not execute Lua or fetch external files.');
 const stats={records:0,splitRecords:0,clampedAxes:0,skipped:0},parts=[];let format;
 if(Array.isArray(data)){format='Compact SmallPart records';for(const record of data){if(!record||!record.p||!record.s){stats.skipped++;continue}stats.records++;parts.push(...expand(record,'PlasticBlock',stats))}}
 else{format='Grouped BuilderHub records';for(const[group,list]of Object.entries(data))if(Array.isArray(list)&&(/Block$|JetPackUltra/.test(group)))for(const record of list){if(!record||record._motorFlag||!record.Position||!record.Size){stats.skipped++;continue}stats.records++;parts.push(...expand(record,group,stats))}}
 if(!parts.length)throw Error('No usable SmallPart records found in the Script 1 data.');if(parts.length>100000)throw Error('This script needs over 100,000 preview pieces. Import a smaller build.');
 const alignment=normalize(parts);parts.forEach((p,i)=>p.patchId=i);
 return{parts,format,stats,...alignment};
}
export function expandImportedParts(source,percent=100,limit=100000){
 const scale=percent/100;if(!Number.isFinite(scale)||scale<=0)throw Error('Build scale must be positive.');const parts=[];
 source.forEach((part,sourceIndex)=>{if(part.deleted)return;const scaled=part.s.map(n=>n*scale),axes=scaled.map(size=>{const count=Math.max(1,Math.ceil(size/2.5-1e-6));return Array.from({length:count},(_,i)=>Math.max(.1,size/count))});
  for(let x=0;x<axes[0].length;x++)for(let y=0;y<axes[1].length;y++)for(let z=0;z<axes[2].length;z++){
   if(parts.length>=limit)throw Error('Too many imported SmallParts to preview at this scale.');
   const index=[x,y,z],local=index.map((n,axis)=>-scaled[axis]/2+scaled[axis]/axes[axis].length*(n+.5));
   const p=part.p.map((n,axis)=>n*scale+local.reduce((sum,v,d)=>sum+v*part.basis[d*3+axis],0));parts.push({...part,p:p.map(n=>+n.toFixed(6)),s:index.map((n,axis)=>+axes[axis][n].toFixed(6)),sourceIndex});
  }
 });return parts;
}
