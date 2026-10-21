"""Source regression: Coco's head must not be bound to ankle/foot bones."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import numpy as np
from convert_menu import Disc,Archive
from p3d import chunks,walk,string
from character_nis import skin_geometry
arc=Archive(Disc(sys.argv[1]),'DEFAULT.RCF')
tree=chunks(arc.read('cinematics\\c1b26988.p3d'))
shape=next(x for x in walk(tree) if x.id==0x10001 and string(x.data)[0]=='coco_geoShape')
bad=0
for pg in shape.children:
 if pg.id!=0x10020:continue
 _,parts=skin_geometry(pg)
 for part in parts:
  head=part['position'][:,1]>1.2
  bad+=int(np.sum(head[:,None] & (part['weights']>.01) & np.isin(part['joints'],[6,7,10,11])))
print(f'Coco head influences assigned to ankles/feet: {bad}')
assert bad==0,'Animated head vertices are anchored to foot bones'
