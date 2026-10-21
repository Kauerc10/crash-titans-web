"""Extract original room trimeshes and literal Lua actor data; never execute game code."""
import json,struct,collections
from pathlib import Path
import numpy as np
from p3d import chunks,walk,string
from convert_menu import Disc,Archive

class LiteralReader:
 def __init__(self):self.calls=[]
 def parse(self,f,params=None):
  k=f['constants'];r={i:v for i,v in enumerate(params or [])};events=[]
  def rk(x):return k[x-250] if x>=250 and x-250<len(k) else r.get(x,{'register':x})
  for pc,w in enumerate(f['code']):
   op=w&63;a=w>>24;b=(w>>15)&511;c=(w>>6)&511;bx=(w>>6)&0x3ffff
   if op==0:r[a]=r.get(b)
   elif op==1:r[a]=k[bx]
   elif op==2:r[a]=bool(b)
   elif op==3:
    for n in range(a,b+1):r[n]=None
   elif op==5:r[a]={'global':k[bx]}
   elif op==6:r[a]={'object':r.get(b),'field':rk(c)}
   elif op==11:r[a+1]=r.get(b);r[a]={'method':rk(c),'object':r.get(b)}
   elif op==35:r[a]={'closure':bx,'sourceLine':f['children'][bx]['line']}
   elif op==9:events.append({'pc':pc,'assignment':{'object':r.get(a),'field':rk(b),'value':rk(c)}})
   elif op==25:
    fn=r.get(a);args=[r.get(i) for i in range(a+1,a+b)] if b else []
    ev={'pc':pc,'function':fn,'arguments':args};events.append(ev)
    if fn=={'global':'tovector'}:values=[{'vector':args}]
    elif fn=={'global':'newActor'}:values=[{'actor':args[2] if len(args)>2 else None},{'behaviourController':args[2] if len(args)>2 else None}]
    else:values=[{'call':fn,'at':pc}]
    for n in range(max(c-1,0)):r[a+n]=values[n] if n<len(values) else {'return':n,'at':pc}
   elif op in (27,):pass
   else:events.append({'pc':pc,'unsupportedOpcode':op})
  return events

def main():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--iso',required=True);args=p.parse_args();out=Path(__file__).resolve().parents[1]/'public/assets/levels/l1-e1';disc=Disc(args.iso);arc=Archive(disc,'DEFAULT.RCF');blob=bytearray();regions=[]
 def buf(a):
  a=np.ascontiguousarray(a);o=len(blob);blob.extend(a.tobytes())
  while len(blob)%4:blob.append(0)
  return {'byteOffset':o,'count':int(a.size),'byteLength':a.nbytes,'dtype':str(a.dtype)}
 sources=[(f'r{i}',f'package\\L1_E1\\{0x9ceb1757+i:08x}.p3d') for i in range(1,8)]+[('mojo','package\\L1_E1\\e815180.p3d')]
 for regionName,path in sources:
  tree=chunks(arc.read(path));rooms=[]
  for root in walk(tree):
   if root.id!=0x7010025:continue
   cc={n.id:n for n in walk([root])};pos=cc.get(0x7000003);idx=cc.get(0x7000006)
   if not pos or not idx:continue
   nv=struct.unpack_from('<I',pos.data)[0];nt=struct.unpack_from('<I',idx.data)[0];xyz=np.frombuffer(pos.data,'<f4',offset=4).reshape(-1,3).copy();records=np.frombuffer(idx.data,'<u2',offset=4).reshape(-1,4).copy();assert len(xyz)==nv and len(records)==nt and records[:,:3].max()<nv
   xyz[:,2]*=-1;tri=records[:,[0,2,1]].astype('<u4');surfaces={};metadata=[]
   for c in walk([root]):
    if c.id in (0x7016012,0x7016014):
     label,at=string(c.data,4);count=struct.unpack_from('<I',c.data,at)[0];at+=4;data=np.frombuffer(c.data,'<u2',offset=at)
     if len(data)==count*2:
      ids=data[:count];vals=data[count:];assert ids.max()<nt;v=np.full(nt,65535,dtype='<u2');v[ids]=vals;surfaces[label]=buf(v)
      metadata.append({'name':label,'values':dict(zip(*[x.tolist() for x in np.unique(vals,return_counts=True)]))})
   normalcheck=None
   native=cc.get(0x7000748)
   if native:
    table=np.frombuffer(native.data,dtype=np.dtype([('adjacency','<u4',3),('factor','<f4',3),('normal','<f4',3)]),offset=4)
    assert len(table)==nt;normals=table['normal'].copy();normals[:,2]*=-1
    geometric=np.cross(xyz[tri[:,1]]-xyz[tri[:,0]],xyz[tri[:,2]]-xyz[tri[:,0]]);length=np.linalg.norm(geometric,axis=1);valid=length>1e-9;normalcheck=float(np.max(abs(geometric[valid]/length[valid,None]-normals[valid])))
   rooms.append({'name':string(root.data)[0],'vertices':buf(xyz.astype('<f4')),'indices':buf(tri),'edgeFlags':buf(records[:,3].astype('<u2')),'surfaces':surfaces,'surfaceValueCounts':metadata,'vertexCount':nv,'triangleCount':nt,'bounds':[xyz.min(0).tolist(),xyz.max(0).tolist()],'nativeNormalMaxError':normalcheck})
  regions.append({'name':regionName,'source':path,'rooms':rooms})
 (out/'source-collision.bin').write_bytes(blob)
 collision={'buffer':'source-collision.bin','coordinateSystem':'right handed Y up, source Z mirrored, winding reversed','regions':regions,'evidence':{'verticesChunk':'0x7000003 (u32 count +float3 array)','triangleChunk':'0x7000006 (u32 count +3u16 vertex indices +u16 edgeFlags per triangle)','triangleMetadataChunk':'0x7000748 (u32 count +3u32 adjacency +3float factors +3float unit normal per triangle)','surfaceMetadata':'0x7016012, count-indexed u16 triangleIDs followed by u16 values; numeric meanings not yet identified'},'limitations':['Numeric surface material IDs preserved; water/slip/foliage semantics are not yet mapped.','Native collision stream only; original solver and actor capsule behaviour not implemented.']}
 (out/'source-collision.json').write_text(json.dumps(collision,separators=(',',':')))
 lr=LiteralReader();scripts={};base=Path('work/level-logic')
 for name in ['spawn_normal','objectives','player_normal','NonSpawnableTemplateActor','props_normal','props_reloadable','streamgraph']:
  file=base/(name+'.blua.json')
  if not file.exists():continue
  f=json.loads(file.read_text());ev=lr.parse(f);scripts[name]={'source':f['source'],'events':ev,'closures':[{'line':c['line'],'events':lr.parse(c,[{'argument':'bc'}])} for c in f['children']],'constants':f['constants']}
 actors=[];locators=[]
 for ev in scripts.get('spawn_normal',{}).get('events',[]):
  fn=ev.get('function');aa=ev.get('arguments',[])
  if fn=={'global':'newActor'} and len(aa)>=6:
   actor={'class':aa[0],'name':aa[2],'sourcePosition':aa[3],'sourceRotation':aa[4],'sourceScale':aa[5],'pc':ev['pc'],'arguments':aa[6:]}
   if isinstance(aa[3],dict) and 'vector' in aa[3]:
    x,y,z=aa[3]['vector'];actor['position']=[x,y,-z]
   actors.append(actor)
  if isinstance(fn,dict) and fn.get('method')=='AddWorldLocator':locators.append({'name':aa[1] if len(aa)>1 else None,'arguments':aa,'pc':ev['pc']})
  props=[]
 for script in ['props_normal','props_reloadable']:
  for event in scripts.get(script,{}).get('events',[]):
   aa=event.get('arguments',[]);fn=event.get('function')
   if fn=={'global':'InstantiateActorFromTemplate'} and len(aa)>=6:
    item={'script':script,'pc':event['pc'],'name':aa[1],'template':aa[2],'sourcePosition':aa[3],'sourceRotation':aa[4],'sourceScale':aa[5]}
    if isinstance(aa[3],dict) and 'vector' in aa[3]:
     x,y,z=aa[3]['vector'];item['position']=[x,y,-z]
    props.append(item)
   elif fn=={'global':'newActor'} and len(aa)>=6:
    actors.append({'script':script,'pc':event['pc'],'class':aa[0],'name':aa[2],'sourcePosition':aa[3],'sourceRotation':aa[4],'sourceScale':aa[5],'callback':aa[6] if len(aa)>6 else None})
 cameraSource=(base/'cameraoverrides.source').read_text();import re
 overrides={}
 for method,volume,value in re.findall(r'cameraManager:(\w+)\(\s*(\d+),\s*([-\d.]+)\s*\)',cameraSource):overrides.setdefault(volume,{})[method]=float(value)
 logic={'props':props,'cameraOverrides':overrides,'status':'literal-source-data','actors':actors,'locators':locators,'scripts':scripts,'notes':['spawn_normal root uses only straight-line supported opcodes; actor position vectors are recovered exactly.','Child callback assignment events preserve literal controller fields; runtime methods are represented symbolically and never run.','Objective script can contain control flow; recorded calls are static bytecode inspection, not an executed sequence.','RK constants use offset250 in this Radical Lua5.0 derivative.']}
 (out/'logic.json').write_text(json.dumps(logic,separators=(',',':')))
 print('collision',sum(r['triangleCount'] for region in regions for r in region['rooms']),'triangles',len(blob),'bytes','actors',len(actors),'locators',len(locators));print('normal error',max(r['nativeNormalMaxError'] or 0 for region in regions for r in region['rooms']))
if __name__=='__main__':main()
