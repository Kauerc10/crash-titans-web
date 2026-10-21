r"""Convert only the front end from a local Crash of the Titans USA PS2 ISO.

python tools/convert_menu.py --iso "C:\path\Crash of the Titans (USA).iso"
The disc is opened read-only. No PS2 executable is run.
"""
import argparse,collections,json,re,shutil,struct,subprocess
from pathlib import Path
from p3d import chunks,walk,string,image_node,safe,pack_fonts
from PIL import Image

class Disc:
    def __init__(self,path):
        self.file=open(path,'rb');self.length=Path(path).stat().st_size
        self.file.seek(16*2048);pvd=self.file.read(2048)
        if pvd[1:6]!=b'CD001':raise ValueError('Expected an ISO9660 image')
        self.files={};r=pvd[156:190]
        self.directory(struct.unpack_from('<I',r,2)[0],struct.unpack_from('<I',r,10)[0])
        boot=self.read('SYSTEM.CNF').decode('ascii',errors='replace')
        if 'SLUS_215.83' not in boot:raise ValueError('This converter is verified only with SLUS_215.83 (USA)')
    def directory(self,sector,size,parent=''):
        self.file.seek(sector*2048);data=self.file.read(size);p=0
        while p<len(data):
            n=data[p]
            if not n:p=(p//2048+1)*2048;continue
            r=data[p:p+n];p+=n;name=r[33:33+r[32]]
            if name in (b'\0',b'\1'):continue
            name=parent+name.decode('ascii').split(';')[0]
            sector,size=struct.unpack_from('<I',r,2)[0],struct.unpack_from('<I',r,10)[0]
            if r[25]&2:self.directory(sector,size,name+'/')
            else:self.files[name]=(sector*2048,size)
    def read(self,name):
        offset,size=self.files[name];self.file.seek(offset);return self.file.read(size)

class Archive:
    def __init__(self,disc,name):
        self.disc=disc;self.base,self.size=disc.files[name];self.name=name
        if not self.readat(0,24).startswith(b'ATG CORE CEMENT LIBRARY'):raise ValueError('Unexpected RCF version')
        table,_,names_off,names_size,_,count=struct.unpack('<6I',self.readat(0x24,24))
        if count>100000:raise ValueError('RCF entry count is invalid')
        entries=sorted(struct.iter_unpack('<III',self.readat(table,count*12)),key=lambda r:r[1])
        names=self.readat(names_off,names_size);p=8;self.files={}
        for _,offset,size in entries:
            *_,n=struct.unpack_from('<4I',names,p);p+=16
            if not 0<n<4096:raise ValueError('RCF name length is invalid')
            name=names[p:p+n-1].decode('ascii');p+=n-1+4
            if offset+size>self.size:raise ValueError('RCF entry is out of bounds')
            self.files[name]=(offset,size)
    def readat(self,offset,size):
        if offset<0 or offset+size>self.size:raise ValueError('RCF read is out of bounds')
        self.disc.file.seek(self.base+offset);data=self.disc.file.read(size)
        if len(data)!=size:raise ValueError('Unexpected end of image')
        return data
    def read(self,name):return self.readat(*self.files[name])

def image_assets(trees,out):
    catalog={};fonts={};errors=[]
    for c in walk(trees):
        if c.id not in (0x19000,0x19005):continue
        name,p=string(c.data)
        try:
            if c.id==0x19000:im=image_node(next(n for n in c.children if n.id==0x19001))
            else:
                _,p=string(c.data,p+8);w,h,count,border=struct.unpack_from('<4I',c.data,p)
                tiles=[n for n in c.children if n.id==0x19001]
                if count!=len(tiles):raise ValueError('Sprite tile count mismatch')
                if not w or not h:w,h=image_node(tiles[0]).size
                im=Image.new('RGBA',(w,h));x=y=row=0
                for tile in tiles:
                    image=image_node(tile)
                    if border:image=image.crop((1,1,image.width-1,image.height-1))
                    if x>=w:x=0;y+=row;row=0
                    im.paste(image,(x,y));x+=image.width;row=max(row,image.height)
            file=safe(name)+'.webp';im.save(out/file,lossless=True,method=6)
            catalog[name.lower()]=dict(file=file,width=im.width,height=im.height)
        except Exception as e:errors.append(dict(name=name,error=str(e)))
    if errors:raise ValueError(f'Image conversion failures: {errors}')
    for c in walk(trees):
        if c.id!=0x22000:continue
        name,p=string(c.data,4);_,p=string(c.data,p)
        size,width,height,baseline=struct.unpack_from('<4f',c.data,p)
        textures=[n for n in c.children if n.id==0x19000]
        glyph=next(n for n in c.children if n.id==0x22001);count=struct.unpack_from('<I',glyph.data)[0];glyphs={}
        for i in range(count):
            tex,u0,v0,u1,v1,left,right,w,advance,code=struct.unpack_from('<I8fI',glyph.data,4+i*40)
            meta=catalog[string(textures[tex&0x7fffffff].data)[0].lower()]
            glyphs[chr(code)]=dict(texture=meta['file'],x=u0*meta['width'],y=(1-v1)*meta['height'],width=(u1-u0)*meta['width'],height=(v1-v0)*meta['height'],advance=advance,left=left,right=right)
        fonts[name]=dict(size=size,width=width,height=height,baseline=baseline,glyphs=glyphs)
    (out/'catalog.json').write_text(json.dumps(catalog,separators=(',',':')))
    pack_fonts(fonts,out)
    (out/'fonts.json').write_text(json.dumps(fonts,separators=(',',':')))
    return len(catalog),len(fonts)

def text_assets(trees,disc,out):
    text=next(c.data for c in walk(trees) if c.id==0x1800e and string(c.data)[0]=='frontendE')
    p=text[0]+2;count,mod,size=struct.unpack_from('<III',text,p);p+=12
    hashes=struct.unpack_from('<'+str(count)+'I',text,p);offsets=struct.unpack_from('<'+str(count)+'I',text,p+count*4)
    buf=text[p+count*8:]
    if len(buf)!=size:raise ValueError('Text buffer length mismatch')
    table=dict(zip(hashes,[buf[o:].decode('utf-16-le').split('\0')[0] for o in offsets]))
    def key(s):
        v=0
        for char in s:v=(v*64+ord(char))%mod
        return v
    strings=[s.decode('ascii') for s in re.findall(rb'[ -~]{3,180}',disc.read('SLUS_215.83'))]
    for c in walk(trees):
        if c.id==0x1800b:
            _,p=string(c.data);name,_=string(c.data,p);strings.append(name)
    texts={s:table[key(s)] for s in strings if s.startswith(('GameStart_','Name_','FE_','GameLoad_')) and key(s) in table}
    if texts.get('GameStart_MainMenu_NewGame')!='NEW GAME':raise ValueError('Text lookup validation failed')
    groups=[];current=None
    for s in strings:
        if s.startswith('GameStart_Credits_') and s in texts:
            current=dict(title=texts[s],names=[]);groups.append(current)
        elif s.startswith('Name_') and s in texts and current:current['names'].append(texts[s])
    groups=[g for g in groups if g['names']]
    (out/'texts.json').write_text(json.dumps(texts,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    (out/'credits.json').write_text(json.dumps(groups,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    return len(texts),len(groups)

def audio_assets(arc,out,ffmpeg):
    selected={'scroll':'move','accept':'accept','back':'back','denied':'denied','crash_idea43_part3_wave1':'menu'}
    dest=out/'audio';dest.mkdir(exist_ok=True);done=[]
    import tempfile
    with tempfile.TemporaryDirectory(prefix='cott-menu-') as tmp:
        for name,(offset,size) in arc.files.items():
            if not name.endswith('.rsd'):continue
            raw=arc.readat(offset,min(size,256));source=raw[24:].split(b'\0')[0].decode('ascii',errors='replace')
            stem=source.split('\\')[-1].rsplit('.',1)[0]
            if stem not in selected:continue
            rsd=Path(tmp)/f'{stem}.rsd';rsd.write_bytes(arc.read(name))
            target=dest/(selected[stem]+'.ogg')
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(rsd),'-c:a','libvorbis','-q:a','4',str(target)],check=True)
            done.append(target.name)
    if len(done)!=5:raise ValueError('Not all menu audio was found')
    return len(done)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--iso',type=Path,required=True)
    parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets')
    parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg'))
    args=parser.parse_args();out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
    ffmpeg=args.ffmpeg
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    disc=Disc(args.iso)
    try:
        art=Archive(disc,'DEFAULT.RCF');sound=Archive(disc,'SOUND.RCF');trees=[]
        for key in ['cdd70a8c','d6aea592','b4c85fe7']:trees+=chunks(art.read('package\\'+key+'.p3d'))
        images,fonts=image_assets(trees,out)
        texts,credits=text_assets(trees,disc,out)
        audio=audio_assets(sound,out,ffmpeg)
        report=dict(serial='SLUS_215.83',images=images,fonts=fonts,fontAtlases=fonts,textKeys=texts,creditGroups=credits,audio=audio,assetBytes=sum(p.stat().st_size for p in out.rglob('*') if p.is_file() and p.name!='source-manifest.json'))
        (out/'source-manifest.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    finally:disc.file.close()

if __name__=='__main__':main()
