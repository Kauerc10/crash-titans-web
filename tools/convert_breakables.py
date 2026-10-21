"""Export the first supported source stateprop, including placement/state evidence."""
import sys,json,struct
from pathlib import Path
from character_nis import convert
from convert_menu import Disc,Archive
from p3d import chunks,walk,string

iso=sys.argv[1];out=Path('outputs/crash-menu/public/assets/props/plant-small');source='package\\6f1f1239.p3d'
tree=chunks(Archive(Disc(iso),'DEFAULT.RCF').read(source))
states=[]
for state in walk(tree):
 if state.id!=0x8020009:continue
 name,_=string(state.data);visibility={}
 for child in state.children:
  if child.id==0x8020002:
   shape,p=string(child.data);visibility[shape]=struct.unpack_from('<I',child.data,p)[0]
 states.append(dict(name=name,visibility=visibility))
assert states==[dict(name='idle',visibility={'plantSmallShape':1}),dict(name='breaking',visibility={'plantSmallShape':0}),dict(name='broken',visibility={'plantSmallShape':0})],states
convert(iso,out,source_paths=[source],actor_names=['sp_Whumpa_plantSmall'])
logic=json.loads(Path('outputs/crash-menu/public/assets/levels/l1-e1/logic.json').read_text())
placements=[dict(id=p['name'],position=p['position'],rotation=p['sourceRotation']['vector'],scale=p['sourceScale']['vector']) for p in logic['props'] if p['template']=='StateProps:L1:sp_Whumpa_plantSmall' and p['script']=='props_normal']
manifest=dict(source=source,model='sp_Whumpa_plantSmall.glb',states=states,placements=placements,limitations=['Break threshold/reach use native approximation.','Original leaf particles and splinter/rustle audio are pending.','Original collision response and item drops are pending.'])
(out/'breakables.json').write_text(json.dumps(manifest,indent=2));print('PLACEMENTS',len(placements))
