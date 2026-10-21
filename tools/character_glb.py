"""glTF skin/clip assembly for original PS2 source values."""
import struct,json
import numpy as np

def quaternion(m):
 r=m[:3,:3];q=np.empty(4);t=np.trace(r)
 if t>0:
  s=np.sqrt(t+1)*2;q[:3]=[(r[2,1]-r[1,2])/s,(r[0,2]-r[2,0])/s,(r[1,0]-r[0,1])/s];q[3]=s/4
 else:
  i=int(np.argmax(np.diag(r)));j=(i+1)%3;k=(i+2)%3;s=np.sqrt(1+r[i,i]-r[j,j]-r[k,k])*2;q[i]=s/4;q[j]=(r[j,i]+r[i,j])/s;q[k]=(r[k,i]+r[i,k])/s;q[3]=(r[k,j]-r[j,k])/s
 return (q/np.linalg.norm(q)).tolist()

def animated(gltf,blob,acc,bones,diagnostics,animations,out,preserve_root=False,filename='crash.glb'):
 # Strip positions are already bind-space. Original joint arrays index the original58-bone skeleton.
 globals=[]
 for i,bone in enumerate(bones):
  m=np.array(bone['matrix']).reshape(4,4).T;parent=bone['parent'];glob=m if i==0 or parent==i else globals[parent]@m;globals.append(glob)
  gltf['nodes'].append(dict(name=bone['name'],translation=m[:3,3].tolist(),rotation=quaternion(m)))
 for i,bone in enumerate(bones):
  if i>0 and bone['parent']!=i:gltf['nodes'][bone['parent']+1].setdefault('children',[]).append(i+1)
 gltf['scenes'][0]['nodes'].append(1)
 inverse=np.array([np.linalg.inv(m).T.reshape(-1) for m in globals]);gltf['skins']=[dict(name='crash',joints=list(range(1,len(bones)+1)),inverseBindMatrices=acc(inverse,'MAT4'),skeleton=1)];gltf['nodes'][0]['skin']=0
 errors=[]
 for prim,source in zip(gltf['meshes'][0]['primitives'],diagnostics):
  raw=np.concatenate([np.array(x['weightsInt16']) for x in source['parts']]);weights=np.cumprod(raw/4096,axis=1);errors.extend(abs(weights.sum(1)-1));weights/=weights.sum(1)[:,None]
  joints=np.concatenate([np.array(x['jointBytes']) for x in source['parts']])//4;palette=np.array(source['palette']);joints=palette[joints]
  assert joints.max()<len(bones)
  prim['attributes'].update(JOINTS_0=acc(joints,'VEC4',5123),WEIGHTS_0=acc(weights,'VEC4'))
 names={b['name']:i+1 for i,b in enumerate(bones)};gltf['animations']=[];samples=0
 for source in animations:
  anim=dict(name=source['name'].removeprefix('PTRN_crash_'),samplers=[],channels=[])
  for group in source['groups']:
   if group['bone'] not in names:continue
   for channel in group['channels']:
    typ=int(channel['type'],16);b=bytes.fromhex(channel['dataHex']);path=None
    if typ in (0x121112,0x121104,0x121105,0x121111):
     count=struct.unpack_from('<I',b,8)[0];times=np.frombuffer(b,dtype='<u2',count=count,offset=12)/source['fps'];offset=12+count*2
     if typ==0x121112:
      xyz=np.frombuffer(b,dtype='<i2',offset=offset,count=count*3).reshape(-1,3)/32767;w=np.sqrt(np.maximum(0,1-(xyz*xyz).sum(1)));values=np.column_stack([xyz,w]);values[:,:2]*=-1;path='rotation'
     elif typ in (0x121105,0x121111):
      values=np.frombuffer(b,dtype='<f4' if typ==0x121105 else '<i2',count=count*4,offset=offset).reshape(-1,4).astype(float);values=values[:,[1,2,3,0]]
      if typ==0x121111:values/=32767
      values[:,:2]*=-1;path='rotation'
     else:values=np.frombuffer(b,dtype='<f4',offset=offset,count=count*3).reshape(-1,3).copy();values[:,2]*=-1;path='translation'
    elif typ in (0x121102,0x121103):
     mapping=struct.unpack_from('<H',b,8)[0];constant=np.frombuffer(b,dtype='<f4',offset=10,count=3);count=struct.unpack_from('<I',b,22)[0];times=np.frombuffer(b,dtype='<u2',offset=26,count=count)/source['fps'];dof=1 if typ==0x121102 else 2;vals=np.frombuffer(b,dtype='<f4',offset=26+count*2,count=count*dof).reshape(count,dof);values=np.tile(constant,(count,1));axes=[mapping] if dof==1 else [x for x in range(3) if x!=mapping];values[:,axes]=vals;values[:,2]*=-1;path='translation'
    if path is None:continue
    if not preserve_root and group['bone']=='Motion_Root' and path=='translation':continue
    if path=='rotation':
     values/=np.linalg.norm(values,axis=1)[:,None]
     for i in range(1,len(values)):
      if np.dot(values[i],values[i-1])<0:values[i]*=-1
    assert np.isfinite(values).all();samples+=len(values);index=len(anim['samplers']);anim['samplers'].append(dict(input=acc(times,'SCALAR',bounds=True),output=acc(values,'VEC4' if path=='rotation' else 'VEC3'),interpolation='LINEAR'));anim['channels'].append(dict(sampler=index,target=dict(node=names[group['bone']],path=path)))
  gltf['animations'].append(anim)
 gltf['buffers'][0]['byteLength']=len(blob);encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);blob+=b'\0'*((-len(blob))%4);glb=struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(blob))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(blob),0x004e4942)+blob;(out/filename).write_bytes(glb)
 return dict(skinWeightMaxQuantizationError=float(max(errors)),animationKeys=samples,animationChannels=sum(len(a['channels']) for a in gltf['animations']),glbBytes=len(glb))
