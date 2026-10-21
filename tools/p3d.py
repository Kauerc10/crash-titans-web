"""Read-only Crash PS2 front-end conversion. No original executables are run.

P3DI palette layout cross-checked against the MIT-licensed
Vheissu/hit-and-run-web tools/textures.py and tools/frontend.py.
"""
from pathlib import Path
from dataclasses import dataclass
import struct, json, io, re, collections
import numpy as np
from PIL import Image, ImageDraw


@dataclass
class Chunk:
    id:int
    data:bytes
    children:list

def chunks(data,start=0,end=None):
    end=len(data) if end is None else end
    result=[]
    while start<end:
        ident,header,total=struct.unpack_from('<III',data,start)
        if not 12<=header<=total or start+total>end:raise ValueError(f'Invalid P3D chunk {start}')
        result.append(Chunk(ident,data[start+12:start+header],chunks(data,start+header,start+total)))
        start+=total
    return result

def walk(items):
    for c in items:
        yield c
        yield from walk(c.children)

def string(data,p=0):
    n=data[p];p+=1
    return data[p:p+n].split(b'\0')[0].decode('utf-8',errors='replace'),p+n

def decode(raw):
    if raw[:4]==b'\x89PNG':return Image.open(io.BytesIO(raw)).convert('RGBA')
    if raw[:4]!=b'P3DI':
        if raw[1:3]==b'\x01\x01':
            first,count=struct.unpack_from('<HH',raw,3)
            depth=raw[7];w,h=struct.unpack_from('<HH',raw,12)
            assert depth==32 and raw[16]==8
            pos=18+raw[0]
            colors=np.frombuffer(raw[pos:pos+count*4],dtype=np.uint8).reshape(-1,4)[:,[2,1,0,3]]
            indices=np.frombuffer(raw[pos+count*4:pos+count*4+w*h],dtype=np.uint8).astype(np.int32)-first
            rgba=colors[indices].reshape(h,w,4)
            if not raw[17]&32:rgba=rgba[::-1]
            if raw[17]&16:rgba=rgba[:,::-1]
            return Image.fromarray(rgba)
        return Image.open(io.BytesIO(raw),formats=['TGA']).convert('RGBA')
    fmt,w,h,bits,ps,bs=struct.unpack_from('<6I',raw,4)
    palette=np.frombuffer(raw[28:28+ps],dtype=np.uint8)
    pixels=np.frombuffer(raw[28+ps:28+ps+bs],dtype=np.uint8)
    if bits in (4,8):
        colors=palette.reshape(-1,4).copy()
        colors[:,3]=np.minimum(colors[:,3].astype(np.uint16)*255//128,255)
        if bits==8:
            order=np.arange(len(colors));order=(order&~24)|((order&8)<<1)|((order&16)>>1)
            colors=colors[order]
        if bits==4:pixels=np.column_stack((pixels&15,pixels>>4)).ravel()
        # This disc stores rectangular indexed images linearly (HUD strips and
        # waterfall caustics). Only square packets use the native swizzle.
        if fmt==14 and bits==8 and w==h and w>=16:
            yy,xx=np.indices((h,w))
            block=(yy&~15)*w+(xx&~15)*2
            swap=(((yy+2)>>2)&1)*4
            row=(((yy&~3)>>1)+(yy&1))&7
            column=row*w*2+((xx+swap)&7)*4
            byte=((yy>>1)&1)+((xx>>2)&2)
            order=block+column+byte
            pixels=pixels[order.ravel()]
        rgba=colors[pixels[:w*h]].reshape(h,w,4)
    elif bits==32:
        rgba=pixels[:w*h*4].reshape(h,w,4).copy()
        rgba[:,:,3]=np.minimum(rgba[:,:,3].astype(np.uint16)*255//128,255)
    else:raise ValueError(f'Image depth {bits}')
    return Image.fromarray(rgba)

def safe(name):return re.sub(r'[^a-z0-9._-]+','-',name.lower()).rsplit('.',1)[0]

def image_node(c):
    item=next(n for n in c.children if n.id==0x19002)
    size=struct.unpack_from('<I',item.data)[0]
    assert size==len(item.data)-4
    return decode(item.data[4:])

def pack_fonts(fonts,out):
    """Pack glyph pages into one lossless atlas per font, avoiding many tiny requests."""
    for name,font in fonts.items():
        files=list(dict.fromkeys(g['texture'] for g in font['glyphs'].values()))
        images={file:Image.open(out/file).convert('RGBA') for file in files}
        width=512;x=y=row=0;positions={}
        for file in sorted(files,key=lambda f:(-images[f].height,-images[f].width)):
            im=images[file]
            if x+im.width>width:x=0;y+=row;row=0
            positions[file]=(x,y);x+=im.width;row=max(row,im.height)
        atlas=Image.new('RGBA',(width,y+row))
        for file,(x,y) in positions.items():atlas.paste(images[file],(x,y))
        output='font-atlas-'+name.lower()+'.webp';atlas.save(out/output,lossless=True,method=6)
        for glyph in font['glyphs'].values():
            x,y=positions[glyph['texture']]
            glyph['x']+=x;glyph['y']+=y;glyph['texture']=output
