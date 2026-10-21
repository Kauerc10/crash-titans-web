"""Export original NIS01 actors with native skeletal clips, preserving world root keys.
Companion scene.json/crash.json contain source visibility and facial channels not represented here.
"""
import sys,json,struct,re
from pathlib import Path
import numpy as np
from p3d import chunks,walk,string,safe
from convert_menu import Disc,Archive
from convert_level import Export,geometry as static_geometry
from convert_character import vif
from character_glb import animated

def farr(d,n,w,offset=0,typ='<f4'):return np.frombuffer(d,dtype=typ,count=n*w,offset=offset).reshape(n,w).copy()
def bones_for(skeleton):
 bones=[];mirror=np.diag([1,1,-1,1])
 for c in skeleton.children:
  if c.id!=0x23001:continue
  name,p=string(c.data);parent=struct.unpack_from('<I',c.data,p)[0];m=farr(c.data,4,4,p+4).T;m=mirror@m@mirror;bones.append(dict(name=name,parent=parent,matrix=m.T.reshape(-1).tolist()))
 return bones

def skin_geometry(pg):
 shader,p=string(pg.data,4);primitive=struct.unpack_from('<I',pg.data,p)[0];cc={x.id:x.data for x in pg.children};parts=[];part={};palette=np.frombuffer(cc[0x1000d],dtype='<u4',offset=4)
 if 0x10012 in cc:
  for cmd,n,v,b,imm,data in vif(cc[0x10012]):
   addr=imm&1023
   if addr==0:
    if 'position' in part:parts.append(part)
    part={}
   elif addr==3 and v==2 and b==32:part['uv']=farr(data,n,2)
   elif addr==4 and v==3:part['normal']=farr(data,n,3,typ='<i2' if b==16 else '<f4').astype(float)/(4096 if b==16 else 1)
   elif addr==4 and v==4 and b==8:part['color']=farr(data,n,4,typ='u1').astype(float)/255
   elif addr==5 and v==3 and b==32:part['position']=farr(data,n,3)
   elif addr==6 and v==4 and b==8:part['jointPalette']=farr(data,n,4,typ='u1')//4
   elif addr==7 and v==4 and b==16:part['weights']=np.cumprod(farr(data,n,4,typ='<i2')/4096,axis=1)
  if 'position' in part:parts.append(part)
 else:
  # MatrixList stores a little-endian u32 per vertex, with the first influence
  # in its most significant byte. It is not the native VIF byte-vector layout.
  n=struct.unpack_from('<I',cc[0x10005])[0];part=dict(position=farr(cc[0x10005],n,3,4),normal=farr(cc[0x10006],n,3,4),uv=farr(cc[0x10007],n,2,8),joints=palette[farr(cc[0x1000b],n,4,4,'u1')[:,::-1]],weights=np.column_stack([farr(cc[0x1000c],n,3,4),np.zeros(n)]));parts=[part]
 for part in parts:
  pos=part['position'];n=len(pos)
  if 'weights' not in part:part['weights']=np.tile([1.,0,0,0],(n,1))
  if 'jointPalette' in part:
   assert (part['jointPalette'][part['weights']>0]<len(palette)).all(),'Active bone palette index invalid'
   part['joints']=palette[np.minimum(part['jointPalette'],len(palette)-1)]
  tri=np.stack([np.arange(n-2),np.arange(1,n-1),np.arange(2,n)],1) if primitive==1 else np.arange(n//3*3).reshape(-1,3)
  if primitive==1:tri[1::2]=tri[1::2][:,[1,0,2]]
  if primitive==1 and 0x10012 in cc and 'uv' in part:
   adc=part['uv'].astype('<f4').view('<u4')[:,0]&1;tri=tri[adc[2:]==0]
  tri=tri[np.linalg.norm(np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]]),axis=1)>1e-8];part['indices']=tri[:,[0,2,1]].ravel();pos[:,2]*=-1
  if 'normal' in part:part['normal'][:,2]*=-1
 return shader,parts

def convert(iso,out,source_paths=None,actor_names=None,animation_names=None,preserve_root=True,shape_names=None,resource_paths=None):
 out.mkdir(parents=True,exist_ok=True);(out/'textures').mkdir(exist_ok=True);arc=Archive(Disc(iso),'DEFAULT.RCF');resource=Export(out);sources=[]
 for shared in resource_paths or []:resource.resources(chunks(arc.read(shared)))
 for source in source_paths or ['cinematics\\c1b26988.p3d','cinematics\\c6b664d5.p3d']:
  tree=chunks(arc.read(source));resource.resources(tree);sources.append((source,tree))
 records=[];errors=[]
 for source,tree in sources:
  allchunks=list(walk(tree));skels={string(x.data)[0]:x for x in allchunks if x.id==0x23000};shapes={string(x.data)[0]:x for x in allchunks if x.id in [0x10000,0x10001]};anims={string(x.data,4)[0]:x for x in allchunks if x.id==0x121000}
  for actor in [x for x in allchunks if x.id==0x123000]:
   name,p=string(actor.data,4)
   if actor_names and name not in actor_names:continue
   skelname,p=string(actor.data,p);bones=bones_for(skels[skelname]);globals=[]
   for i,b in enumerate(bones):
    m=np.array(b['matrix']).reshape(4,4).T;globals.append(m if i==0 else globals[b['parent']]@m)
   g=dict(asset=dict(version='2.0',generator='Original Crash NIS01 actor converter'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(name=name,mesh=0)],meshes=[dict(name=name,primitives=[])],buffers=[dict(byteLength=0)],bufferViews=[],accessors=[],materials=[],textures=[],images=[],samplers=[dict(wrapS=10497,wrapT=10497,magFilter=9729,minFilter=9987)])
   blob=bytearray();diagnostics=[];materials={};numvertices=0;numtriangles=0
   def acc(a,kind,component=5126,bounds=False):
    while len(blob)%4:blob.append(0)
    a=np.ascontiguousarray(a,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component]);v=len(g['bufferViews']);g['bufferViews'].append(dict(buffer=0,byteOffset=len(blob),byteLength=a.nbytes));blob.extend(a.tobytes());item=dict(bufferView=v,componentType=component,count=len(a),type=kind)
    if bounds:item.update(min=np.atleast_1d(a.min(0)).tolist(),max=np.atleast_1d(a.max(0)).tolist())
    g['accessors'].append(item);return len(g['accessors'])-1
   def material(shader):
    if shader in materials:return materials[shader]
    meta=resource.shaders.get(shader,{});texture=resource.textures.get(meta.get('texture',''));m=dict(name=shader,pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=1),doubleSided=True)
    if texture:
     g['images'].append(dict(uri=texture));g['textures'].append(dict(source=len(g['images'])-1,sampler=0));m['pbrMetallicRoughness']['baseColorTexture']=dict(index=len(g['textures'])-1)
    elif meta.get('texture'):errors.append(dict(actor=name,missingTexture=meta['texture']))
    if meta.get('translucent'):m['alphaMode']='BLEND'
    materials[shader]=len(g['materials']);g['materials'].append(m);return materials[shader]
   for ref in actor.children:
    if ref.id!=0x123001:continue
    shapename,p=string(ref.data,8)
    if shape_names is not None and shapename not in shape_names:continue
    kind,joint=struct.unpack_from('<II',ref.data,p);shape=shapes.get(shapename)
    if shape is None:errors.append(dict(actor=name,missingShape=shapename,shapeType=kind));continue
    for pg in shape.children:
     if pg.id!=0x10020:continue
     try:shader,parts=skin_geometry(pg) if shape.id==0x10001 else static_geometry(pg)
     except Exception as e:errors.append(dict(actor=name,shape=shapename,error=str(e)));continue
     for part in parts:
      pos=part['position'];n=len(pos);idx=part['indices']
      if not len(idx):continue
      if shape.id!=0x10001:
       pos=(np.column_stack([pos,np.ones(n)])@globals[joint].T)[:,:3];part['position']=pos
       if 'normal' in part:part['normal']=part['normal']@globals[joint][:3,:3].T
       part['joints']=np.tile([joint,0,0,0],(n,1));part['weights']=np.tile([1,0,0,0],(n,1))
      assert np.isfinite(pos).all() and idx.max()<n
      attrs=dict(POSITION=acc(pos,'VEC3',bounds=True))
      if 'uv' in part:
       coord=part['uv'];attrs['TEXCOORD_0']=acc(coord,'VEC2')
      if 'normal' in part:
       normal=part['normal'];normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9);attrs['NORMAL']=acc(normal,'VEC3')
      if 'color' in part:attrs['COLOR_0']=acc(part['color'],'VEC4')
      g['meshes'][0]['primitives'].append(dict(attributes=attrs,indices=acc(idx,'SCALAR',5125),material=material(shader)))
      weights=part['weights'];ratios=weights.copy()
      for axis in range(3,0,-1):ratios[:,axis]=np.divide(weights[:,axis],weights[:,axis-1],out=np.zeros(n),where=weights[:,axis-1]!=0)
      diagnostics.append(dict(palette=list(range(len(bones))),parts=[dict(vertexCount=n,jointBytes=(part['joints']*4).tolist(),weightsInt16=(ratios*4096).tolist())]));numvertices+=n;numtriangles+=len(idx)//3
   if not g['meshes'][0]['primitives']:records.append(dict(name=name,status='no mesh geometry',source=source));continue
   selected=[]
   for ctrl in actor.children:
    if ctrl.id!=0x121201:continue
    _,p=string(ctrl.data,4);kind=ctrl.data[p:p+4]
    if kind!=b'PTRN':continue
    # Controller ends with targetactor and animation strings following type, cycle, phase, hierarchycount.
    target,p=string(ctrl.data,p+16);animname,p=string(ctrl.data,p)
    if animname not in anims:errors.append(dict(actor=name,missingAnimation=animname));continue
    a=anims[animname];an,p=string(a.data,4);frames,fps,cyclic=struct.unpack_from('<ffI',a.data,p+4);groups=[]
    for group in walk(a.children):
     if group.id==0x121001:groups.append(dict(bone=string(group.data,4)[0],channels=[dict(type=hex(c.id),dataHex=c.data.hex()) for c in group.children]))
    selected.append(dict(name=an,frames=frames,fps=fps,cyclic=cyclic,groups=groups))
   if animation_names:
    selected=[]
    for an in animation_names:
     a=anims[an];_,p=string(a.data,4);frames,fps,cyclic=struct.unpack_from('<ffI',a.data,p+4)
     groups=[dict(bone=string(group.data,4)[0],channels=[dict(type=hex(c.id),dataHex=c.data.hex()) for c in group.children]) for group in walk(a.children) if group.id==0x121001]
     selected.append(dict(name=an,frames=frames,fps=fps,cyclic=cyclic,groups=groups))
   filename=safe(name)+'.glb';result=animated(g,blob,acc,bones,diagnostics,selected,out,preserve_root=preserve_root,filename=filename);records.append(dict(name=name,file=filename,source=source,skeleton=skelname,bones=len(bones),vertices=numvertices,triangles=numtriangles,clips=[a['name'] for a in selected],**result));print(name,numvertices,numtriangles,len(selected),result['glbBytes'])
 (out/'actors.json').write_text(json.dumps(dict(actors=records,errors=errors+resource.errors,coordinateSystem='Y up, mirroredZ; '+('source root animation preserved' if preserve_root else 'Motion_Root translation controlled by gameplay runtime'),limitations=['Facial blendshape/deformation channels not exported; base facial geometry only.','Source visibility tracks are not applied in GLB.','Particle systems/shadow volumes have no triangle mesh export.','Exact source shader and interpolation behavior not reconstructed.']),indent=2));print('ERRORS',errors+resource.errors)
if __name__=='__main__':convert(sys.argv[1],Path('outputs/crash-menu/public/assets/cinematics/nis01'))
