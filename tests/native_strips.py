"""Regression: native PS2 UV low-bit strip cuts must not emit bridging faces."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import numpy as np
from convert_menu import Disc,Archive
from p3d import chunks,walk,string
from convert_level import geometry
arc=Archive(Disc(sys.argv[1]),'DEFAULT.RCF')
mesh=next(x for x in walk(chunks(arc.read('package\\L1_E1\\9ceb1758.p3d'))) if x.id==0x10000 and string(x.data)[0]=='house_stuff_r1_Shape2')
pg=next(x for x in mesh.children if x.id==0x10020 and string(x.data,4)[0]=='wood_55_128_m18')
_,parts=geometry(pg);bridges=0
for part in parts:
 tri=part['indices'].reshape(-1,3)
 flags=part['uv'].astype('<f4').view('<u4')[:,0]&1
 bridges+=int(flags[tri.max(1)].sum())
print(f'Faces incorrectly emitted at source strip cuts: {bridges}')
assert bridges==0,'Strip restarts create triangles joining disconnected parts of the map'
