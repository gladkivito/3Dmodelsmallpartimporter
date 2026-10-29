import {materialPaintTemplate as paintTemplate} from './paint-template.js';
const round=(n)=>+n.toFixed(5);
export function buildJSON(parts,metadata=null){const output={_modelOrigin:'0,0,0',_generator:'SmallPart Forge 1.2',PlasticBlock:[],GlassBlock:[],MetalBlock:[],WoodBlock:[],FabricBlock:[],CoalBlock:[]};parts.forEach((p,i)=>{const b=p.basis,r11=b[0],r12=b[3],r13=b[6],r22=b[4],r23=b[7],r32=b[5],r33=b[8],ry=Math.asin(Math.max(-1,Math.min(1,r13)));let rx,rz;if(Math.abs(r13)<.9999999){rx=Math.atan2(-r23,r33);rz=Math.atan2(-r12,r11)}else{rx=Math.atan2(r32,r22);rz=0}const record={Position:p.p.map(round).join(','),Size:p.s.map(round).join(','),Rotation:[rx,ry,rz].map(x=>round(x*180/Math.PI)).join(','),Color:p.c.map(x=>round(x/255)).join(','),Transparency:p.mat==='g'?round(1-(p.a??.35)):0,CFrame:[...p.p,b[0],b[3],b[6],b[1],b[4],b[7],b[2],b[5],b[8]].map(round),_idx:i};if(p.bone)record.Bone=p.bone;output[({g:'GlassBlock',m:'MetalBlock',w:'WoodBlock',f:'FabricBlock',t:'CoalBlock'})[p.mat]||'PlasticBlock'].push(record)});if(metadata?.unplacedAuxiliary)output._unplacedAuxiliary={count:metadata.unplacedAuxiliary,reason:'Source Script 1 contains no assembled positions for these blocks'};return output;}
const preamble=`-- SmallPart Forge | static GLB surface build
-- Paint/config flow supplied in atom1.txt; post-spawn assembly uses pcutils.
-- Requires the same game/executor environment as that converter. In-game testing required.
local HttpService = game:GetService("HttpService")
local data = HttpService:JSONDecode([===[__DATA__]===])
local function materialClass(part)
 local m = part.Material
 if m == Enum.Material.Glass then return "g" end
 if m == Enum.Material.Metal or m == Enum.Material.DiamondPlate or m == Enum.Material.CorrodedMetal then return "m" end
 if m == Enum.Material.Wood or m == Enum.Material.WoodPlanks then return "w" end
 if m == Enum.Material.Fabric then return "f" end
 return "s"
end
local function sizeKey(sx,sy,sz,c,material)
 return string.format("%d,%d,%d|%d,%d,%d",math.floor(sx*10000+.5),math.floor(sy*10000+.5),math.floor(sz*10000+.5),math.floor(c.R*255+.5),math.floor(c.G*255+.5),math.floor(c.B*255+.5)) .. "|" .. (material == "t" and "s" or material or "s")
end
`;
export function lua(parts,type){const compact=JSON.stringify(parts.map(p=>({p:p.p,s:p.s,b:p.basis,c:p.c,m:p.mat||"s",a:p.a??1})));let script;
if(type==='paint'){
 const boxes=`
local BOXES = {}
for i,d in ipairs(data) do
 BOXES[i] = {
  gx=math.clamp(d.s[1]/2.5,.04,1),gy=math.clamp(d.s[2]/2.5,.04,1),gz=math.clamp(d.s[3]/2.5,.04,1),
  mat=d.m,color=Color3.fromRGB(d.c[1],d.c[2],d.c[3]),size=Vector3.new(d.s[1],d.s[2],d.s[3])
 }
end
`;
 return preamble.replace('__DATA__',compact)+boxes+paintTemplate;
}
script=`
loadstring(game:HttpGet("https://raw.githubusercontent.com/sametcetinkaya1447/planecrazy2/refs/heads/main/folder/pcutils.lua"))()
-- Run AFTER spawning, once Paint Lua has finished successfully.
local player=game:GetService("Players").LocalPlayer
local aircraft=workspace:WaitForChild(player.Name.." Aircraft",20)
assert(aircraft,"Spawn your aircraft first")
local halfplate=aircraft:FindFirstChild("HalfPlate",true)
local anchor=halfplate and halfplate:FindFirstChild("BlockStd")
assert(anchor,"Add a HalfPlate anchor to the build before spawning")
local buckets={}
local candidates={}
local function collect()
 buckets={}
 candidates={}
 for _,model in ipairs(aircraft:GetDescendants()) do
  if model.Name=="SmallPart" and model:IsA("Model") then
   local part=model:FindFirstChild("SPart")
   local cfg=model:FindFirstChild("Configuration")
   if part then
    local sizes={}
    for j,key in ipairs({"Size X","Size Y","Size Z"}) do
     local v=cfg and cfg:FindFirstChild(key)
     sizes[j]=v and tonumber(v.Value) or math.clamp(({part.Size.X,part.Size.Y,part.Size.Z})[j]/2.5,.04,1)
    end
    local k=sizeKey(sizes[1],sizes[2],sizes[3],part.Color,materialClass(part))
    buckets[k]=buckets[k] or {}
    table.insert(buckets[k],part)
    table.insert(candidates,{part=part,size=sizes})
   end
  end
 end
end
local assigned={}
for attempt=1,15 do
 collect()
 local missing={}
 local used={}
 assigned={}
 for i,d in ipairs(data) do
  local k=sizeKey(math.clamp(d.s[1]/2.5,.04,1),math.clamp(d.s[2]/2.5,.04,1),math.clamp(d.s[3]/2.5,.04,1),Color3.fromRGB(d.c[1],d.c[2],d.c[3]),d.m)
  local bucket=buckets[k]
  if bucket and #bucket>0 then
   assigned[i]=table.remove(bucket)
   used[assigned[i]]=true
  else table.insert(missing,i) end
 end
 -- The supplied Script 1 accepts a configuration tolerance of 0.006.
 -- Match only identical colors and sizes within that same tolerance.
 local unresolved=0
 for _,i in ipairs(missing) do
  local d=data[i]
  local color=Color3.fromRGB(d.c[1],d.c[2],d.c[3])
  local expected={math.clamp(d.s[1]/2.5,.04,1),math.clamp(d.s[2]/2.5,.04,1),math.clamp(d.s[3]/2.5,.04,1)}
  local best,score
  for _,candidate in ipairs(candidates) do
   if not used[candidate.part] then
    local c=candidate.part.Color
    local sameColor=math.floor(c.R*255+.5)==d.c[1] and math.floor(c.G*255+.5)==d.c[2] and math.floor(c.B*255+.5)==d.c[3]
    local diff={math.abs(candidate.size[1]-expected[1]),math.abs(candidate.size[2]-expected[2]),math.abs(candidate.size[3]-expected[3])}
    local sum=diff[1]+diff[2]+diff[3]
    local sameMaterial=(d.m=="t" or materialClass(candidate.part)==d.m)
    if sameColor and sameMaterial and math.max(diff[1],diff[2],diff[3])<=.006 and (not score or sum<score) then best=candidate score=sum end
   end
  end
  if best then assigned[i]=best.part used[best.part]=true else unresolved+=1 end
 end
 if unresolved==0 then break end
 assert(attempt<15,string.format("%d parts have no matching size/color. Return to build mode, repaint, and respawn.",unresolved))
 task.wait(1)
end
assert(type(Unweld)=="function" and type(Weld)=="function","pcutils weld functions unavailable")
for i,d in ipairs(data) do
 local part=assigned[i]
 local b=d.b
 local relative=CFrame.fromMatrix(Vector3.new(d.p[1],d.p[2],d.p[3]),Vector3.new(b[1],b[2],b[3]),Vector3.new(b[4],b[5],b[6]),Vector3.new(b[7],b[8],b[9]))
 part.CanCollide=false
 Unweld(part)
 Weld(anchor,part,relative)
 if i%40==0 then print("[SmallPart Forge] Assembled "..i.."/"..#data) task.wait() end
end
print("[SmallPart Forge] Static model assembled: "..#data.." SmallParts.")
`;return preamble.replace('__DATA__',compact)+script;}
