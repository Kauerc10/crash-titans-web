"""Source regressions: rectangular HUD/caustic storage versus preserved square art."""
import sys,struct,hashlib
import numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from convert_menu import Disc,Archive
from p3d import chunks,walk,string,image_node

arc=Archive(Disc(sys.argv[1]),'DEFAULT.RCF')
for source,name in [('package\\7a8185b0.p3d','HUD_Health_Meter.tga'),('package\\7a8185b0.p3d','HUD_Health_Meter_Background.tga'),('package\\L1_E1\\9ceb1758.p3d','waterfall_caustic02_128.tga.0')]:
    texture=next(c for c in walk(chunks(arc.read(source))) if c.id==0x19000 and string(c.data)[0]==name)
    image=next(c for c in texture.children if c.id==0x19001);raw=next(c for c in image.children if c.id==0x19002).data[4:]
    fmt,w,h,bits,ps,bs=struct.unpack_from('<6I',raw,4);assert bits==8 and w!=h
    palette=np.frombuffer(raw[28:28+ps],dtype='u1').reshape(-1,4).copy();palette[:,3]=np.minimum(palette[:,3].astype('u2')*255//128,255)
    order=np.arange(len(palette));order=(order&~24)|((order&8)<<1)|((order&16)>>1)
    expected=palette[order][np.frombuffer(raw[28+ps:28+ps+bs],dtype='u1')].reshape(h,w,4)
    assert np.array_equal(np.array(image_node(image)),expected),f'{name}: linear source texels were rearranged'
    print(name,'linear storage preserved')

texture=next(c for c in walk(chunks(arc.read('package\\7a8185b0.p3d'))) if c.id==0x19000 and string(c.data)[0]=='HUD_Mojo_Icon.tga')
image=next(c for c in texture.children if c.id==0x19001)
assert hashlib.sha256(image_node(image).tobytes()).hexdigest()=='2a4c1e84b9ad2d2524b2729bc169c87fa78df05669f061033ee3d1c0490ac357'
print('Square Mojo decoded pixels unchanged')
