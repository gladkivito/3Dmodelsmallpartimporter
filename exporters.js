import {materialPaintTemplate as paintTemplate} from './paint-template.js';
const round=(n)=>+n.toFixed(5);
export function buildJSON(parts,metadata=null){const output={_modelOrigin:'0,0,0',_generator:'SmallPart Forge 1.2',PlasticBlock:[],GlassBlock:[],MetalBlock:[],WoodBlock:[],FabricBlock:[],CoalBlock:[]};parts.forEach((p,i)=>{const b=p.basis,r11=b[0],r12=b[3],r13=b[6],r22=b[4],r23=b[7],r32=b[5],r33=b[8],ry=Math.asin(Math.max(-1,Math.min(1,r13)));let rx,rz;if(Math.abs(r13)<.9999999){rx=Math.atan2(-r23,r33);rz=Math.atan2(-r12,r11)}else{rx=Math.atan2(r32,r22);rz=0}const record={Position:p.p.map(round).join(','),Size:p.s.map(round).join(','),Rotation:[rx,ry,rz].map(x=>round(x*180/Math.PI)).join(','),Color:p.c.map(x=>round(x/255)).join(','),Transparency:p.mat==='g'?round(1-(p.a??.35)):0,CFrame:[...p.p,b[0],b[3],b[6],b[1],b[4],b[7],b[2],b[5],b[8]].map(round),_idx:i};if(p.bone)record.Bone=p.bone;output[({g:'GlassBlock',m:'MetalBlock',w:'WoodBlock',f:'FabricBlock',t:'CoalBlock'})[p.mat]||'PlasticBlock'].push(record)});if(metadata?.unplacedAuxiliary)output._unplacedAuxiliary={count:metadata.unplacedAuxiliary,reason:'Source Script 1 contains no assembled positions for these blocks'};return output;}
const preamble=`-- SmallPart Forge | static GLB surface build
-- Paint/config flow supplied in atom1.txt; post-spawn assembly uses pcutils.
-- Requires the same game/executor environment as that converter. In-game testing required.
local HttpService = game:GetService("HttpService")
local data = HttpService:JSONDecode([===[__DATA__]===])
local function materialClass(part)
 local m=part.Material
 if m==Enum.Material.Glass then return "g" end
 if m==Enum.Material.Metal or m==Enum.Material.DiamondPlate or m==Enum.Material.CorrodedMetal then return "m" end
 if m==Enum.Material.Wood or m==Enum.Material.WoodPlanks then return "w" end
 if m==Enum.Material.Fabric then return "f" end
 return "s"
end
local function sizeKey(sx,sy,sz,c)
 -- The game can round Size Configuration to hundredths. Script 1 paints
 -- those values before spawning, so match at the same precision.
 return string.format("%d,%d,%d|%d,%d,%d",math.floor(sx*100+.5),math.floor(sy*100+.5),math.floor(sz*100+.5),math.floor(c.R*255+.5),math.floor(c.G*255+.5),math.floor(c.B*255+.5))
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
local gui=Instance.new("ScreenGui")
gui.Name="SmallPartForgeAssembly"
gui.ResetOnSpawn=false
local label=Instance.new("TextLabel")
label.Name="Progress"
label.Size=UDim2.fromOffset(360,54)
label.Position=UDim2.new(.5,-180,0,20)
label.BackgroundColor3=Color3.fromRGB(16,24,19)
label.BackgroundTransparency=.15
label.TextColor3=Color3.fromRGB(203,249,139)
label.TextWrapped=true
label.Font=Enum.Font.Code
label.TextSize=14
label.Text="Collecting spawned SmallParts..."
label.Parent=gui
pcall(function()
 local parent=(gethui and gethui()) or player:WaitForChild("PlayerGui")
 local old=parent:FindFirstChild(gui.Name)
 if old then old:Destroy() end
 gui.Parent=parent
end)
local function status(message)
 label.Text=message
 print("[SmallPart Forge] "..message)
end
local buckets={}
local available=0
local function collect()
 buckets={}
 available=0
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
    local k=sizeKey(sizes[1],sizes[2],sizes[3],part.Color)
    buckets[k]=buckets[k] or {}
    table.insert(buckets[k],{part=part,size=sizes,material=materialClass(part)})
    available+=1
   end
  end
 end
end
collect()
for second=1,15 do
 if available>=#data then break end
 status(string.format("Waiting for spawned parts: %d/%d",available,#data))
 task.wait(1)
 collect()
end
if available<#data then status(string.format("Only %d/%d SmallParts spawned. Add blocks and respawn.",available,#data)) end
assert(available>=#data,string.format("Only %d/%d SmallParts spawned. Add the missing blocks and respawn.",available,#data))
status(string.format("Matching %d parts by painted color and size...",#data))
local assigned,missing={},{}
for i,d in ipairs(data) do
 local wanted={math.clamp(d.s[1]/2.5,.04,1),math.clamp(d.s[2]/2.5,.04,1),math.clamp(d.s[3]/2.5,.04,1)}
 local color=Color3.fromRGB(d.c[1],d.c[2],d.c[3])
 local k=sizeKey(wanted[1],wanted[2],wanted[3],color)
 local bucket=buckets[k]
 local wantMaterial=d.m=="t" and "s" or d.m
 if bucket then
  for j=#bucket,1,-1 do
   local rec=bucket[j]
   local sameMaterial=rec.material==wantMaterial
   if sameMaterial and math.abs(rec.size[1]-wanted[1])<=.006 and math.abs(rec.size[2]-wanted[2])<=.006 and math.abs(rec.size[3]-wanted[3])<=.006 then
    assigned[i]=rec.part
    table.remove(bucket,j)
    break
   end
  end
 end
 if not assigned[i] then table.insert(missing,i) end
 if i%200==0 then task.wait() end
end
-- Only check neighbouring rounded buckets for values close to the server's
-- 0.006 Size Configuration tolerance. This remains bounded even at 9k parts.
for n,i in ipairs(missing) do
 local d=data[i]
 local wanted={math.clamp(d.s[1]/2.5,.04,1),math.clamp(d.s[2]/2.5,.04,1),math.clamp(d.s[3]/2.5,.04,1)}
 local color=Color3.fromRGB(d.c[1],d.c[2],d.c[3])
 local base={math.floor(wanted[1]*100+.5),math.floor(wanted[2]*100+.5),math.floor(wanted[3]*100+.5)}
 local suffix=string.format("|%d,%d,%d",math.floor(color.R*255+.5),math.floor(color.G*255+.5),math.floor(color.B*255+.5))
 local wantMaterial=d.m=="t" and "s" or d.m
 local function nearby(requireMaterial)
  for dx=-1,1 do for dy=-1,1 do for dz=-1,1 do
   local list=buckets[string.format("%d,%d,%d",base[1]+dx,base[2]+dy,base[3]+dz)..suffix]
   if list then
    for j=#list,1,-1 do
     local rec=list[j]
     local sameMaterial=rec.material==wantMaterial
     if (not requireMaterial or sameMaterial) and math.abs(rec.size[1]-wanted[1])<=.006 and math.abs(rec.size[2]-wanted[2])<=.006 and math.abs(rec.size[3]-wanted[3])<=.006 then
      table.remove(list,j)
      return rec.part
     end
    end
   end
  end end end
 end
 assigned[i]=nearby(true)
 if not assigned[i] then assigned[i]=nearby(false) end
 if n%100==0 then task.wait() end
end
local unresolved=0
for i=1,#data do if not assigned[i] then unresolved+=1 end end
if unresolved>0 then status(string.format("%d paint/size matches missing. Run Paint Lua, then respawn.",unresolved)) end
assert(unresolved==0,string.format("%d SmallParts do not match Script 1's paint/size data. Run Paint Lua fully in build mode, then respawn. No welds were sent.",unresolved))
status("All "..#data.." parts matched. Starting welds...")
assert(type(Unweld)=="function" and type(Weld)=="function","pcutils weld functions unavailable")
for i,d in ipairs(data) do
 local part=assigned[i]
 local b=d.b
 local relative=CFrame.fromMatrix(Vector3.new(d.p[1],d.p[2],d.p[3]),Vector3.new(b[1],b[2],b[3]),Vector3.new(b[4],b[5],b[6]),Vector3.new(b[7],b[8],b[9]))
 part.CanCollide=false
 Unweld(part)
 Weld(anchor,part,relative)
 if i%40==0 then
  if i%200==0 then status("Assembled "..i.."/"..#data) end
  task.wait()
 end
end
status("Assembly sent: "..#data.." SmallParts. Check the model in-game.")
task.delay(15,function() if gui then gui:Destroy() end end)
`;return preamble.replace('__DATA__',compact)+script;}
