"""Decode selected original combat effects; event mapping is native reconstruction."""
import argparse,json,subprocess,tempfile
from pathlib import Path
from convert_menu import Disc,Archive

def convert(iso,out,ffmpeg):
    wanted={
        'swing':'crash_light_whoosh_03',
        'hit':'crash_generic_impact_01',
        'hurt':'crash_generic_impact_02',
        'enemy':'chiratta_slap_2a',
        'death':'crash_death_03',
        'leaf':'leaf_rustle_01',
        'pot':'ceramic_smash_01',
        'wood':'small_wooden_break_01',
        'metal':'metal_hit_01',
        'mojo':'mojo_collect_02',
        'defeat':'bone_crusher_04',
        'disappear':'fodder_death_flash',
        'bodyfall':'fodder_bodyfall_03',
        'health':'whumpa_pu_01',
        'freejack':'freejack_glow_03'
    }
    arc=Archive(Disc(iso),'SOUND.RCF');out=Path(out);out.mkdir(parents=True,exist_ok=True);manifest={}
    for entry,(offset,size) in arc.files.items():
        if not entry.endswith('.rsd'):continue
        source=arc.readat(offset,min(size,512))[24:].split(b'\0')[0].decode('ascii',errors='replace')
        stem=source.replace('\\','/').split('/')[-1].rsplit('.',1)[0].lower()
        for event,name in wanted.items():
            if stem!=name.lower():continue
            with tempfile.TemporaryDirectory() as temp:
                rsd=Path(temp)/'source.rsd';rsd.write_bytes(arc.read(entry))
                subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(rsd),'-c:a','libvorbis','-q:a','4',str(out/f'{event}.ogg')],check=True)
            manifest[event]={'file':f'{event}.ogg','entry':entry,'source':source,'bytes':(out/f'{event}.ogg').stat().st_size}
    if set(manifest)!=set(wanted):raise ValueError(f'Missing effects: {set(wanted)-set(manifest)}')
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--iso',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
    import imageio_ffmpeg
    convert(args.iso,args.out,imageio_ffmpeg.get_ffmpeg_exe())
