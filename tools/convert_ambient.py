"""Recover Amb1's eleven ordered speech streams and the original speaker mapping.

Reads the disc only. No replacement dialogue or camera keys are synthesized.
"""
import argparse,json,re,subprocess,tempfile
from pathlib import Path
from convert_menu import Disc,Archive
from p3d import chunks,walk

def convert(iso,out,ffmpeg):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    disc=Disc(iso);art=Archive(disc,'DEFAULT.RCF');sound=Archive(disc,'SOUND.RCF');english=Archive(disc,'ENGLISH.RCF')
    fight=art.read('fighttrees\\Ambient.bfig');start=fight.index(b'L1_E1_Amb1\0');end=fight.index(b'L1_E1_Amb2\0',start)
    section=fight[start:end]
    nodes=list(re.finditer(rb'amb1_(\d\d)\0',section));assert len(nodes)==11
    event=next(c for c in walk(chunks(sound.read('sound\\zscripts\\l1_e1.p3d'))) if c.id==0x1000001 and c.data[4:10]==b'amb01\0')
    streams={}
    for name,(offset,size) in english.files.items():
        header=english.readat(offset,min(size,256));source=header[24:].split(b'\0',1)[0].decode('ascii',errors='replace')
        m=re.search(r'amb01_(\d{3})_lab[34]\.wav$',source,re.I)
        if m:streams[int(m[1])]=(name,source)
    assert len(streams)==11
    lines=[];audio=bytearray();time=0
    with tempfile.TemporaryDirectory(prefix='crash-amb1-') as folder:
        folder=Path(folder)
        for index,node in enumerate(nodes,1):
            block=section[node.start():nodes[index].start() if index<len(nodes) else len(section)]
            actor=re.search(rb'AmbConvActor0[12]\0',block)[0][:-1].decode()
            assert b'PTRN_chiratta_talk\0' in block
            entry,original=streams[index]
            reference=original.replace('\\','/').split('/')[-2:];reference='/'.join(reference).removesuffix('.wav').replace('/','\\').encode()
            assert reference+b'\0' in event.data
            source=folder/'line.rsd';source.write_bytes(english.read(entry))
            pcm=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(source),'-ar','24000','-ac','1','-f','s16le','-'],capture_output=True,check=True).stdout
            duration=len(pcm)/(24000*2);audio.extend(pcm)
            lines.append(dict(index=index,actor=actor,start=time,end=time+duration,clip='talk',stream=entry,source=original,sourceNodeOffset=start+node.start()))
            time+=duration
        pcm_path=folder/'all.pcm';pcm_path.write_bytes(audio)
        subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','s16le','-ar','24000','-ac','1','-i',str(pcm_path),'-c:a','libvorbis','-q:a','5',str(out/'amb1.ogg')],check=True)
    result=dict(id='L1_E1_Amb1',duration=time,lines=lines,audio='/assets/cinematics/amb1/amb1.ogg',source='DEFAULT.RCF/fighttrees/Ambient.bfig',soundEvent='SOUND.RCF/sound/zscripts/l1_e1.p3d:amb01',limitations=['Original utterance order and audio recovered; engine dialogue padding/interruption timing not yet reproduced.','Gameplay camera retained: no original Amb1 camera override recovered.','Skip disabled until original skip permission semantics are established.'])
    (out/'runtime.json').write_text(json.dumps(result,indent=2),encoding='utf-8');disc.file.close();print('Amb1:',len(lines),'source utterances,',time,'seconds')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--iso',required=True);parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets/cinematics/amb1');args=parser.parse_args()
    import imageio_ffmpeg
    convert(args.iso,args.out,imageio_ffmpeg.get_ffmpeg_exe())
