"""Original Crash PS2 extraction. VIF reader adapted from MIT Vheissu/hit-and-run-web.
Exports original bind geometry, skeleton, skin and source animation clips to glTF.
No procedural character or animation is generated. Source channels remain inspectable.
"""
import sys,struct,json,io,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).parent))
from convert_menu import Disc,Archive
from p3d import chunks,walk,string,image_node

def vif(data):
 p=12
 while p<len(data):
  code,=struct.unpack_from('<I',data,p);p+=4;cmd=(code>>24)&127;n=(code>>16)&255;imm=code&65535
  if cmd>=0x60:
   v=((cmd>>2)&3)+1;bits=(32,16,8,5)[cmd&3];n=n or 256
   size=n*2 if bits==5 else (n*v*bits+7)//8;size=(size+3)&~3
   if p+size>len(data):raise ValueError('Truncated VIF')
   yield cmd,n,v,bits,imm,data[p:p+size];p+=size
  else:
   p+={0x20:4,0x30:16,0x31:16}.get(cmd,0)
   if cmd in (0x50,0x51):p+=imm*16
   if cmd==0x4a:p+=(n or 256)*8
   if cmd not in (0,1,2,3,4,5,6,7,0x10,0x11,0x13,0x14,0x15,0x17,0x20,0x30,0x31,0x4a,0x50,0x51):raise ValueError(f'Unknown VIF {cmd:x}')

def convert(iso,out):
 out.mkdir(parents=True,exist_ok=True);a=Archive(Disc(iso),'DEFAULT.RCF');raw=a.read('package\\b06ecd92.p3d');tree=chunks(raw)
 skeleton=next(x for x in walk(tree) if x.id==0x23000 and string(x.data)[0]=='crash');bones=[]
 mirror=np.diag([1,1,-1,1])
 for c in skeleton.children:
  if c.id!=0x23001:continue
  name,p=string(c.data);parent,=struct.unpack_from('<I',c.data,p);m=np.frombuffer(c.data,dtype='<f4',offset=p+4,count=16).reshape(4,4).T
  m=mirror@m@mirror;bones.append(dict(name=name,parent=parent,matrix=m.T.reshape(-1).tolist()))
 # Export source hierarchy alongside the static bind and animated GLBs.
 (out/'skeleton.json').write_text(json.dumps(dict(bones=bones,sourceChunk='0x23000/0x23001',matrixOrder='column-major'),indent=2))
 texture=next(x for x in walk(tree) if x.id==0x19000 and string(x.data)[0].lower()=='crash_normal.bmp');im=image_node(next(x for x in texture.children if x.id==0x19001));im.save(out/'crash_normal.png')
 gltf=dict(asset=dict(version='2.0',generator='Crash original PS2 bind converter'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(name='CrashShape',mesh=0)],meshes=[dict(name='CrashShape',primitives=[])],buffers=[dict(byteLength=0)],bufferViews=[],accessors=[],materials=[dict(name='Original Crash texture',pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=1),doubleSided=True)],textures=[dict(source=0,sampler=0)],samplers=[dict(magFilter=9729,minFilter=9987,wrapS=10497,wrapT=10497)],images=[dict(uri='crash_normal.png')])
 blob=bytearray()
 def acc(arr,kind,component=5126,bounds=False):
  while len(blob)%4:blob.append(0)
  data=np.ascontiguousarray(arr,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[component]);offset=len(blob);blob.extend(data.tobytes());view=len(gltf['bufferViews']);gltf['bufferViews'].append(dict(buffer=0,byteOffset=offset,byteLength=data.nbytes));n=len(gltf['accessors']);item=dict(bufferView=view,componentType=component,count=len(data),type=kind)
  if bounds:item.update(min=np.atleast_1d(data.min(0)).tolist(),max=np.atleast_1d(data.max(0)).tolist())
  gltf['accessors'].append(item);return n
 skin=next(x for x in walk(tree) if x.id==0x10001 and string(x.data)[0]=='CrashShape');totalv=totalt=0;diagnostics=[]
 for pg in skin.children:
  if pg.id!=0x10020:continue
  shader,p=string(pg.data,4);primitive,flags,declared=struct.unpack_from('<III',pg.data,p);parts=[];part={}
  for cmd,n,v,b,imm,data in vif(next(x for x in pg.children if x.id==0x10012).data):
   addr=imm&1023
   if addr==0:
    if 'position' in part:parts.append(part)
    part={}
   elif addr==3 and v==2 and b==32:part['uv']=np.frombuffer(data,dtype='<f4',count=n*2).reshape(-1,2).copy()
   elif addr==4 and v==3 and b==16:part['normal']=np.frombuffer(data,dtype='<i2',count=n*3).reshape(-1,3).astype(float)/4096
   elif addr==5 and v==3 and b==32:part['position']=np.frombuffer(data,dtype='<f4',count=n*3).reshape(-1,3).copy()
   elif addr==6:part['rawJointBytes']=np.frombuffer(data,dtype='u1',count=n*4).reshape(-1,4).copy()
   elif addr==7:part['rawWeights']=np.frombuffer(data,dtype='<i2',count=n*4).reshape(-1,4).copy()
  if 'position' in part:parts.append(part)
  positions=[];normals=[];uv=[];indices=[];offset=0;rawparts=[]
  for part in parts:
   pos=part['position'];normal=part['normal'];coord=part['uv'];n=len(pos);tri=np.stack([np.arange(n-2),np.arange(1,n-1),np.arange(2,n)],1);tri[1::2]=tri[1::2][:,[1,0,2]]
   adc=coord.astype('<f4').view('<u4')[:,0]&1;tri=tri[adc[2:]==0]
   keep=np.linalg.norm(np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]]),axis=1)>1e-8;tri=tri[keep][:,[0,2,1]]
   assert np.isfinite(pos).all() and (tri>=0).all() and (tri<len(pos)).all()
   pos[:,2]*=-1;normal[:,2]*=-1;normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9)
   positions.append(pos);normals.append(normal);uv.append(coord);indices.append(tri.reshape(-1)+offset);offset+=n
   rawparts.append(dict(vertexCount=n,jointBytes=part['rawJointBytes'].tolist(),weightsInt16=part['rawWeights'].tolist()))
  pos=np.concatenate(positions);idx=np.concatenate(indices).astype('uint32');attrs=dict(POSITION=acc(pos,'VEC3',bounds=True),NORMAL=acc(np.concatenate(normals),'VEC3'),TEXCOORD_0=acc(np.concatenate(uv),'VEC2'));gltf['meshes'][0]['primitives'].append(dict(attributes=attrs,indices=acc(idx,'SCALAR',5125),material=0));totalv+=len(pos);totalt+=len(idx)//3
  diagnostics.append(dict(shader=shader,declaredVertices=declared,decodedVertices=len(pos),triangles=len(idx)//3,palette=np.frombuffer(next(x for x in pg.children if x.id==0x1000d).data,dtype='<u4',offset=4).tolist(),parts=rawparts))
 (out/'skin-source.json').write_text(json.dumps(diagnostics,separators=(',',':')))
 gltf['buffers'][0]['byteLength']=len(blob);encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);blob+=b'\0'*((-len(blob))%4);glb=struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(blob))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(blob),0x004e4942)+blob;(out/'crash-bind.glb').write_bytes(glb)
 animations=[]
 for x in walk(chunks(a.read('package\\bca1bc0b.p3d'))):
  if x.id!=0x121000:continue
  name,p=string(x.data,4)
  if name not in ['PTRN_crash_idle','PTRN_crash_walk','PTRN_crash_run','PTRN_crash_jump_single','PTRN_crash_jump_air','PTRN_crash_jump_single_recover','PTRN_crash_jump_air_fall','PTRN_crash_jump_single_fall_cycle','PTRN_crash_attack_lite_A','PTRN_crash_attack_lite_B','PTRN_crash_attack_lite_C','PTRN_crash_impact_light','PTRN_crash_death']:continue
  frames,fps,cyclic=struct.unpack_from('<ffI',x.data,p+4);groups=[]
  for g in walk(x.children):
   if g.id!=0x121001:continue
   bone,_=string(g.data,4);channels=[dict(type=hex(t.id),dataHex=t.data.hex()) for t in g.children];groups.append(dict(bone=bone,channels=channels))
  animations.append(dict(name=name,frames=frames,fps=fps,cyclic=cyclic,groups=groups))
 (out/'animations-source.json').write_text(json.dumps(animations,separators=(',',':')))
 report=dict(status='verified original bind mesh; animated skin codec blocked',glb='/assets/characters/crash/crash-bind.glb',source=dict(archive='DEFAULT.RCF',model='package\\b06ecd92.p3d',animations='package\\bca1bc0b.p3d',modelSha256=hashlib.sha256(raw).hexdigest()),units='Original game units; no scaling applied',orientation='Y up; original Z mirrored for right-handed glTF',vertices=totalv,triangles=totalt,bones=len(bones),textureSize=im.size,animationLabels=[x['name'] for x in animations],animationGlb=False,blockers=['PS2 weight encoding not established: raw [2703,2112,0,0] does not sum to full weight4096. Raw palette and weights preserved without invented normalization.','Rotation codec0x121112 stores 6 bytes per key; exact compressed quaternion2 decoding not independently verified. Source channels preserved; no fabricated animation.'],validation=dict(finitePositions=True,indicesInBounds=True,glbBytes=len(glb)))
 from character_glb import animated
 result=animated(gltf,blob,acc,bones,diagnostics,animations,out)
 report['clips']=[dict(name=a['name'].removeprefix('PTRN_crash_'),sourceName=a['name'],frames=a['frames'],fps=a['fps'],duration=(a['frames']-1)/a['fps']) for a in animations]
 report.update(status=f'original mesh, skin, skeleton and {len(animations)} clips converted',glb='/assets/characters/crash/crash.glb',animationGlb=True,blockers=[],codecNotes=['PS2 weights decoded as cumulative product of4 signed16 fixed12 ratios; maximum sum error recorded before normalization.','Compressed quaternion2 decoded as signed16 XYZ/32767 with positive sqrt W; source keys checked against unit sphere constraint.'],validation=result)
 Path('outputs/crash-analysis/character-conversion.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':convert(sys.argv[1],Path('outputs/crash-menu/public/assets/characters/crash'))
