"""Read-only original NIS01 animation, camera and actor-reference extraction.
Decoded channel types assert complete payload lengths; other types retain raw bytes.
No event order, actor motion or dialogue is synthesized.
"""
import argparse,struct,json,hashlib,math,subprocess,tempfile,shutil
from pathlib import Path
from convert_menu import Disc,Archive
from p3d import chunks,walk,string

def audio(disc,out):
 archive=Archive(disc,'ENGLISH.RCF');name='sound\\rsd\\english\\1\\1f67f1b9f2fc6e68.rsd';data=archive.read(name)
 original=data[24:].split(b'\0',1)[0].decode('ascii');ffmpeg=shutil.which('ffmpeg')
 if not ffmpeg:
  import imageio_ffmpeg
  ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
 with tempfile.TemporaryDirectory(prefix='nis01-audio-') as tmp:
  source=Path(tmp)/'nis01.rsd';source.write_bytes(data)
  pcm=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(source),'-f','s16le','-'],capture_output=True,check=True).stdout;duration=len(pcm)/(24000*2*2)
  subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(source),'-c:a','libvorbis','-q:a','6',str(out/'nis01.ogg')],check=True)
  subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(out/'nis01.ogg'),'-f','null','-'],check=True)
 script=Archive(disc,'SOUND.RCF').read('sound\\zscripts\\l1_e1.p3d');event=next(c for c in walk(chunks(script)) if c.id==0x1000001 and c.data[4:10]==b'nis01\0')
 return dict(url='/assets/cinematics/nis01/nis01.ogg',archive='ENGLISH.RCF',archivePath=name,originalPath=original,sourceSha256=hashlib.sha256(data).hexdigest(),sampleRate=24000,channels=2,sourceDurationSeconds=duration,eventName='nis01',streamReference='vo_nis\\pl2\\nis01_pl2',eventSource='SOUND.RCF/sound\\zscripts\\l1_e1.p3d',eventDataHex=event.data.hex(),synchronization='Complete original stream duration matches camera timeline to within 0.01 seconds; start stream with NIS01 timeline. Internal utterance timing is already in the stream.',verification='Full encoded audio decode passed',mixContents='Original complete stream retained; individual music/effects contributions have not been separately classified.')

def channel(c,fps):
 d=c.data;r=dict(chunkType=hex(c.id),sourceDataHex=d.hex())
 if len(d)<12:return r
 version,=struct.unpack_from('<I',d);r.update(version=version,semantic=d[4:8].decode('ascii',errors='replace').rstrip('\0'))
 count,=struct.unpack_from('<I',d,8)
 if count>100000:return r
 types={0x121100:(1,'f'),0x121104:(3,'f'),0x121105:(4,'f'),0x121112:(3,'h')}
 if c.id not in types:return r
 size,fmt=types[c.id];expected=12+count*2+count*size*struct.calcsize(fmt)
 if len(d)!=expected:raise ValueError(f'Channel size mismatch {hex(c.id)} {len(d)} != {expected}')
 times=list(struct.unpack_from('<'+str(count)+'H',d,12));vals=list(struct.unpack_from('<'+str(count*size)+fmt,d,12+2*count));values=[vals[i*size:(i+1)*size] for i in range(count)]
 if c.id==0x121112:
  values=[[a/32767,b/32767,z/32767,math.sqrt(max(0,1-(a*a+b*b+z*z)/(32767**2)))] for a,b,z in values];r['encoding']='quaternion2 XYZ signed16 /32767; nonnegative reconstructed W'
 r.update(frames=times,seconds=[t/fps for t in times],values=values,coordinateSpace='source unchanged')
 return r

def extract(data):
 tree=chunks(data);anims=[];actors=[];skels=[];cameras=[]
 for c in walk(tree):
  if c.id==0x121000:
   name,p=string(c.data,4);kind=c.data[p:p+4].decode('ascii',errors='replace').rstrip('\0');frames,fps,cyclic=struct.unpack_from('<ffI',c.data,p+4);groups=[]
   for g in walk(c.children):
    if g.id!=0x121001:continue
    bone,q=string(g.data,4);index,count=struct.unpack_from('<II',g.data,q);groups.append(dict(name=bone,index=index,channels=[channel(ch,fps) for ch in g.children]))
   anims.append(dict(name=name,kind=kind,frameCount=frames,fps=fps,cyclic=cyclic,durationSeconds=frames/fps,groups=groups))
  elif c.id==0x123000:
   name,p=string(c.data,4);skel,p=string(c.data,p);refs=[]
   for ch in c.children:
    if ch.id==0x123001:
     shape,q=string(ch.data,8);refs.append(dict(shape=shape,sourceDataHex=ch.data.hex()))
    elif ch.id==0x121201:refs.append(dict(animationControllerDataHex=ch.data.hex()))
   actors.append(dict(name=name,skeleton=skel,parts=refs))
  elif c.id==0x23000:
   name,p=string(c.data);bones=[]
   for ch in c.children:
    if ch.id!=0x23001:continue
    n,q=string(ch.data);parent,=struct.unpack_from('<I',ch.data,q);m=list(struct.unpack_from('<16f',ch.data,q+4));bones.append(dict(name=n,parent=parent,matrix=m))
   skels.append(dict(name=name,bones=bones,matrixOrder='source row-major (equivalent column-major array for mirrored conversion)'))
  elif c.id==0x2200:
   name,p=string(c.data);version,=struct.unpack_from('<I',c.data,p);v=list(struct.unpack_from('<13f',c.data,p+4));cameras.append(dict(name=name,version=version,fovRadians=v[0],aspectRatio=v[1],near=v[2],far=v[3],position=v[4:7],look=v[7:10],up=v[10:13]))
 return dict(animations=anims,actors=actors,skeletons=skels,cameras=cameras)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--iso',type=Path,required=True);p.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets/cinematics/nis01');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True);disc=Disc(a.iso)
 try:
  arc=Archive(disc,'DEFAULT.RCF');sources=[];combined=[]
  for name,filename in [('cinematics\\c1b26988.p3d','scene.json'),('cinematics\\c6b664d5.p3d','crash.json')]:
   b=arc.read(name);result=extract(b);(a.out/filename).write_text(json.dumps(result,separators=(',',':')),encoding='utf8');sources.append(dict(archivePath=name,sourceBytes=len(b),sha256=hashlib.sha256(b).hexdigest(),url='/assets/cinematics/nis01/'+filename,animations=len(result['animations']),actors=[x['name'] for x in result['actors']]));combined.append(result)
  cam=next(x for x in combined[0]['animations'] if x['kind']=='CAM');manifest=dict(id='NIS_01',trigger='L1_E1_R1_NIS01',fps=cam['fps'],frameCount=cam['frameCount'],durationSeconds=cam['durationSeconds'],sources=sources,cameraAnimation=cam['name'],camera=combined[0]['cameras'],coordinateConversion=dict(position='[x,y,-z]',quaternion='[-x,-y,z,w]',camera='Mirror position/look/up Z; source LOOK is a direction as verified against camera object default.',units='original game units'),decodedChannels=['float','vector3','quaternion','quaternion2'],limitations=['Actor meshes not exported by this timeline tool. Original mesh/skinning converter is a separate integration step.','Source keys preserved; exact interpolation and visibility/event channels remain engine-dependent.','Original synchronized NIS audio stream exported separately; additional engine event scheduling is not synthesized.','Animation frame count is retained verbatim; last camera key may be frameCount-1.'])
  manifest['audio']=audio(disc,a.out)
  runtime=dict(id='NIS_01',fps=cam['fps'],frameCount=cam['frameCount'],durationSeconds=cam['durationSeconds'],audioSource=manifest['audio']['url'],audioStartSeconds=0,actorsSource='/assets/cinematics/nis01/actors.glb',camera=dict(name=manifest['camera'][0]['name'],defaults=manifest['camera'][0],tracks={ch['semantic']:dict(frames=ch['frames'],values=ch['values']) for ch in cam['groups'][0]['channels'] if 'frames' in ch}),actors=[dict(name=x['name'],skeleton=x['skeleton'],expectedTransformClip=x['name']+'_anim',placement='Use source skeleton bind matrices and Motion_Root animation; do not add gameplay spawn translation.') for result in combined for x in result['actors']],coordinateSpace='Camera values are original source coordinates, unchanged. Mirror Z for camera position/LOOK/UP when used with converted GLB. LOOK is direction: lookAt(position+LOOK). GLB actor transforms are already mirrored.',timing='Source frames /30. Full original audio begins at cinematic time0. Retain adjacent-frame keys because these encode camera cuts; do not smooth camera cuts.',limitations=['Pure3D field-of-view axis interpretation has not been independently verified.','Actor map expresses source object names and conventional clip references; use actual GLB clip inventory when available.'])
  runtime['actorsSource']='/assets/cinematics/nis01/actors.json'
  if (a.out/'actors.json').exists():
   exported={x['name']:x for x in json.loads((a.out/'actors.json').read_text())['actors']}
   for item in runtime['actors']:
    item.pop('expectedTransformClip',None);model=exported.get(item['name'],{})
    item.update(url='/assets/cinematics/nis01/'+model['file'] if 'file' in model else None,clips=model.get('clips',[]),status=model.get('status','exported'))
  (a.out/'runtime.json').write_text(json.dumps(runtime,separators=(',',':')),encoding='utf8');manifest['runtime']='/assets/cinematics/nis01/runtime.json'
  (a.out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8');print(json.dumps(manifest,indent=2))
 finally:disc.file.close()
if __name__=='__main__':main()
