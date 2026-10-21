"""Export original Crash PS2 static meshes read-only; no emulation/gameplay.
VIF reader adapted from MIT Vheissu/hit-and-run-web/tools/vif.py.
Crash-specific 0x10020 and quantization parsing based on local source bounds.
"""
import argparse,struct,json,hashlib,collections
from pathlib import Path
import numpy as np
from p3d import chunks,walk,string,image_node,safe
from convert_menu import Disc,Archive
from level_vif import unpack

def arr(data,n,width,offset=0,dtype='<f4'):
 return np.frombuffer(data,dtype=dtype,count=n*width,offset=offset).reshape(n,width).copy()

def geometry(pg):
 shader,p=string(pg.data,4);primitive,flags,nvertices,nindices,nmat=struct.unpack_from('<5I',pg.data,p)
 native=next((x for x in pg.children if x.id==0x10012),None);parts=[];current={}
 if native:
  descriptor=next((x for x in pg.children if x.id==0x10014),None)
  word=struct.unpack_from('<I',descriptor.data,20)[0] if descriptor else 0x3f800000
  scale=struct.unpack('<f',struct.pack('<I',word&0xffff0000))[0]
  for cmd,n,v,b,imm,data in unpack(native.data):
   address=imm&1023
   if address==0:
    if 'position' in current:parts.append(current)
    current={}
   elif address==3 and v==2 and b==32:current['uv']=arr(data,n,2)
   elif address==5 and v==3 and b==32:current['position']=arr(data,n,3)
   elif address==5 and v==3 and b==16:current['position']=arr(data,n,3,dtype='<i2').astype(np.float32)*scale
   elif address==4 and v==4 and b==5:
    packed=np.frombuffer(data,dtype='<u2',count=n).astype(np.uint32)
    current['color']=np.stack([(packed&31)*8,((packed>>5)&31)*8,((packed>>10)&31)*8,((packed>>15)&1)*255],1).astype(np.float32)/255
   elif address==4 and v==4 and b==8:current['color']=arr(data,n,4,dtype='u1').astype(np.float32)/255
   elif address==4 and v==3 and b==32:current['normal']=arr(data,n,3)
  if 'position' in current:parts.append(current)
 else:
  cc={c.id:c.data for c in pg.children}
  if 0x10005 not in cc:raise ValueError('No native packet or position list')
  n=struct.unpack_from('<I',cc[0x10005])[0];current={'position':arr(cc[0x10005],n,3,4)}
  if 0x10007 in cc:current['uv']=arr(cc[0x10007],n,2,8)
  if 0x10008 in cc:current['color']=arr(cc[0x10008],n,4,4,'u1')[:,[2,1,0,3]].astype(np.float32)/255
  if 0x10006 in cc:current['normal']=arr(cc[0x10006],n,3,4)
  if 0x1000a in cc:current['indices']=np.frombuffer(cc[0x1000a],'<u4',offset=4).copy()
  parts.append(current)
 for part in parts:
  n=len(part['position']);idx=part.pop('indices',np.arange(n,dtype=np.uint32))
  if primitive==1:
   tri=np.stack([idx[:-2],idx[1:-1],idx[2:]],1);tri[1::2]=tri[1::2][:,[1,0,2]]
   # Native UV float low bits carry ADC (suppress triangle kick), independently
   # of vertex alpha. Preserve absolute strip parity when discarding kicks.
   if native and 'uv' in part:
    adc=part['uv'].astype('<f4').view('<u4')[:,0]&1
    tri=tri[adc[idx[2:]]==0]
  elif primitive==0:tri=idx[:len(idx)//3*3].reshape(-1,3)
  else:raise ValueError('Unsupported primitive '+str(primitive))
  xyz=part['position'];valid=np.linalg.norm(np.cross(xyz[tri[:,1]]-xyz[tri[:,0]],xyz[tri[:,2]]-xyz[tri[:,0]]),axis=1)>1e-8
  part['position'][:,2]*=-1
  if native and 'color' in part:
   part['color'][:,3]=1
  if 'normal' in part:part['normal'][:,2]*=-1
  part['indices']=tri[valid][:,[0,2,1]].ravel().astype('<u4')
 return shader,parts

class Export:
 def __init__(self,out):
  self.out=out;self.textures={};self.shaders={};self.errors=[];self.count=collections.Counter()
 def resources(self,root):
  for c in walk(root):
   if c.id==0x19000:
    name=string(c.data)[0]
    try:
     im=image_node(next(x for x in c.children if x.id==0x19001));file='textures/'+safe(name)+'.png';im.save(self.out/file);self.textures[name.lower()]=file
    except Exception as e:self.errors.append({'texture':name,'error':str(e)})
   if c.id==0x11000:
    name,p=string(c.data);kind,p=string(c.data,p+4);translucent=struct.unpack_from('<I',c.data,p)[0];props={}
    for x in c.children:
     key=x.data[:4].split(b'\0')[0].decode('ascii',errors='replace')
     if x.id==0x11002:props[key]=string(x.data,4)[0]
     elif x.id==0x11003:props[key]=struct.unpack_from('<I',x.data,4)[0]
    self.shaders[name]={'texture':props.get('TEX','').lower(),'translucent':bool(translucent),'properties':props,'kind':kind}
 def export(self,root,name,source):
  self.resources(root);blob=bytearray();g={'asset':{'version':'2.0','generator':'Crash PS2 source static geometry converter'},'extensionsUsed':['KHR_materials_unlit'],'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'bufferViews':[],'accessors':[],'buffers':[]};mats={};tex={};bounds=[];checks=[]
  def accessor(a,typ):
   a=np.ascontiguousarray(a);offset=len(blob);blob.extend(a.tobytes())
   while len(blob)%4:blob.append(0)
   view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes})
   ac={'bufferView':view,'componentType':5125 if a.dtype.kind=='u' else 5126,'count':len(a),'type':typ}
   if typ=='VEC3':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
   g['accessors'].append(ac);return len(g['accessors'])-1
  def material(shader):
   if shader in mats:return mats[shader]
   meta=self.shaders.get(shader,{});file=self.textures.get(meta.get('texture',''));m={'name':shader,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':1},'doubleSided':True,'extensions':{'KHR_materials_unlit':{}},'extras':meta}
   if file:
    if file not in tex:
     tex[file]=len(g['textures']);g['images'].append({'uri':file});g['textures'].append({'source':len(g['images'])-1,'sampler':0})
    m['pbrMetallicRoughness']['baseColorTexture']={'index':tex[file]}
   elif meta.get('texture'):self.errors.append({'missingTexture':meta['texture'],'shader':shader})
   if meta.get('translucent'):m['alphaMode']='BLEND'
   mats[shader]=len(g['materials']);g['materials'].append(m);return mats[shader]
  for c in walk(root):
   if c.id!=0x10000:continue
   meshname=string(c.data)[0];prims=[];meshpositions=[];collision='collision' in meshname.lower()
   for pg in c.children:
    if pg.id not in (0x10020,0x10002):continue
    try:shader,parts=geometry(pg)
    except Exception as e:self.errors.append({'mesh':meshname,'region':name,'error':str(e)});continue
    collision=collision or 'collision' in shader.lower()
    for part in parts:
     if not len(part['indices']):continue
     attrs={}
     for key,semantic,typ in [('position','POSITION','VEC3'),('uv','TEXCOORD_0','VEC2'),('color','COLOR_0','VEC4'),('normal','NORMAL','VEC3')]:
      if key in part:attrs[semantic]=accessor(part[key].astype('<f4'),typ)
     prims.append({'attributes':attrs,'indices':accessor(part['indices'],'SCALAR'),'material':material(shader),'mode':4})
     meshpositions.append(part['position']);bounds.append(part['position']);self.count['vertices']+=len(part['position']);self.count['triangles']+=len(part['indices'])//3
   if not prims:continue
   mi=len(g['meshes']);g['meshes'].append({'name':meshname,'primitives':prims});node={'name':meshname,'mesh':mi,'extras':{'source':source,'sourceChunk':'0x10000','bakedWorldCoordinates':True,'collisionMaterial':collision}}
   g['nodes'].append(node);g['scenes'][0]['nodes'].append(len(g['nodes'])-1);self.count['meshes']+=1
   bb=next((x for x in c.children if x.id==0x10003),None)
   if bb:
    original=np.array(struct.unpack('<6f',bb.data)).reshape(2,3);points=np.concatenate(meshpositions).copy();points[:,2]*=-1;err=float(np.max(abs(np.stack([points.min(0),points.max(0)])-original)));checks.append({'mesh':meshname,'boundsMaxError':err})
  g['buffers']=[{'uri':name+'.bin','byteLength':len(blob)}];(self.out/(name+'.bin')).write_bytes(blob);(self.out/(name+'.gltf')).write_text(json.dumps(g,separators=(',',':')))
  pts=np.concatenate(bounds) if bounds else np.zeros((1,3));self.count['regions']+=1
  return {'name':name,'file':name+'.gltf','source':source,'meshes':len(g['meshes']),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']),'bounds':[pts.min(0).tolist(),pts.max(0).tolist()],'boundsValidation':checks}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--iso',required=True);args=parser.parse_args();out=Path(__file__).resolve().parents[1]/'public/assets/levels/l1-e1';(out/'textures').mkdir(parents=True,exist_ok=True)
 disc=Disc(args.iso);arc=Archive(disc,'DEFAULT.RCF');ex=Export(out)
 palette='package\\L1_E1\\fae145d6.p3d';ex.resources(chunks(arc.read(palette)))
 regions=[]
 for i in range(1,8):
  source=f'package\\L1_E1\\{0x9ceb1757+i:08x}.p3d';root=chunks(arc.read(source));regions.append(ex.export(root,'r'+str(i),source));print('exported',regions[-1]['name'],regions[-1]['meshes'],flush=True)
 bonus='package\\L1_E1\\e815180.p3d';regions.append(ex.export(chunks(arc.read(bonus)),'mojo',bonus))
 sky='levels\\L1_E1\\Skybox.p3d';regions.append(ex.export(chunks(arc.read(sky)),'skybox',sky))
 level=chunks(arc.read('levels\\leveldata.p3d'))[0].children[0];spawns=[]
 for c in walk([level]):
  if c.id==0x5500003:
   label,p=string(c.data,4);values=struct.unpack_from('<9f',c.data,p);spawns.append({'name':label,'sourcePosition':values[:3],'position':[values[0],values[1],-values[2]],'rotation':values[3:6],'scale':values[6:9]})
 camera=chunks(arc.read('levels\\L1_E1\\cameradata.p3d'));cameras=[]
 for c in walk(camera):
  if c.id in (0x5432100,0x5432101,0x5432102):
   label,p=string(c.data);points=arr(c.data,8,3,p);points[:,2]*=-1;cameras.append({'name':label,'chunk':hex(c.id),'points':points.tolist()})
 result={'status':'source-static-geometry-converted','coordinateSystem':'right-handed Y up; source Z mirrored; winding reversed','initialRegionEvidence':'L1_E1_R7 is second string in first 0x5500001 level record; meaning unconfirmed. Script evidence names L1_E1_R1_NIS01 as first cinematic.','regions':regions,'placements':spawns,'cameraVolumes':cameras,'counts':dict(ex.count,textures=len(ex.textures)),'errors':ex.errors,'limitations':['Static source meshes only. No PS2 executable emulation or gameplay.','Native V3_16 coordinate scale recovered from high 16 bits of 0x10014 word20; source mesh bounds checked individually.','Original shader effects, animation, alpha blending order, PS2 lighting and water are not reproduced exactly.','Camera volumes contain eight source points each; original camera evaluation logic not implemented.','Source physics and collision semantics not reconstructed. Meshes with collision materials remain flagged in extras for inspection.','World coordinates are baked in source meshes; no invented scene placements.','Only base texture resources exported; animated texture and vertex animation controllers not interpreted.']}
 (out/'manifest.json').write_text(json.dumps(result,separators=(',',':')));report=Path(__file__).resolve().parents[2]/'crash-analysis/level-conversion.json';report.write_text(json.dumps(result,indent=2));print(dict(ex.count),'errors',len(ex.errors))
if __name__=='__main__':main()
