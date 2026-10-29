// Counts nearby physical SmallParts in a 3D grid. Used only for preview colours.
export function partDensity(parts){
 if(!parts.length)return{levels:[],min:0,max:0,cell:1};
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const part of parts)for(let axis=0;axis<3;axis++){low[axis]=Math.min(low[axis],part.p[axis]);high[axis]=Math.max(high[axis],part.p[axis])}
 const cell=Math.max(.5,Math.min(2.5,Math.max(...high.map((n,i)=>n-low[i]))/18));
 const coords=parts.map(part=>part.p.map((n,i)=>Math.floor((n-low[i])/cell))),cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 for(const [x,y,z] of coords){const k=key(x,y,z);cells.set(k,(cells.get(k)||0)+1)}
 const levels=coords.map(([x,y,z])=>{let count=0;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)count+=cells.get(key(x+dx,y+dy,z+dz))||0;return count});
 let min=Infinity,max=-Infinity;for(const n of levels){min=Math.min(min,n);max=Math.max(max,n)}return{levels,min,max,cell};
}
export function densityBand(value,min,max){return max===min?1:Math.min(4,Math.floor((value-min)/(max-min)*5))}
export const heatColors=['#5ebdc0','#86d0a5','#d2f78a','#f3bd68','#eb685b'];
