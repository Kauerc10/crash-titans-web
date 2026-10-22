"""Extract authentic tutorial audio dialogue and stingers from PS2 ISO."""
import argparse, json, subprocess, tempfile
from pathlib import Path
from convert_menu import Disc, Archive
import imageio_ffmpeg

def convert(iso, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    # Wanted voice clips from ENGLISH.RCF
    voice_wanted = {
        'basic': 'sound\\rsd\\english\\3\\30102f5c89509fa9.rsd',        # tutorial_basic_ps2.wav
        'light_attack': 'sound\\rsd\\english\\5\\5334156f483375e5.rsd', # tutorial090_aku_ps2.wav
        'air_jump': 'sound\\rsd\\english\\6\\6ce4f92b7b64b829.rsd',     # tutorial003_aku_ps2.wav
        'heavy_attack': 'sound\\rsd\\english\\8\\82cfea49c5229be0.rsd', # tutorial059_aku_ps2.wav
        'multiplier': 'sound\\rsd\\english\\a\\af607e000d0e15b8.rsd',   # tutorial159_aku_gen.wav
        'spin_hover': 'sound\\rsd\\english\\b\\b1311aa91964a3ec.rsd',   # tutorial114_aku_ps2.wav
        'bounce_pad': 'sound\\rsd\\english\\b\\b178225d6b4292ec.rsd',   # tutorial099_aku_ps2.wav
    }

    # Sound cues from SOUND.RCF
    sfx_wanted = {
        'chime': 'sound\\rsd\\3\\314ba63ffd39f779.rsd',                 # button_01.wav
        'reward': 'sound\\rsd\\2\\2c0c6b770a4a198d.rsd',                # stinger_reward.wav
    }

    disc = Disc(iso)
    eng_arc = Archive(disc, 'ENGLISH.RCF')
    sound_arc = Archive(disc, 'SOUND.RCF')
    manifest = {}

    for key, path in voice_wanted.items():
        if path not in eng_arc.files:
            raise KeyError(f'Voice file {path} not found in ENGLISH.RCF')
        offset, size = eng_arc.files[path]
        raw_head = eng_arc.readat(offset, min(size, 256))
        source_name = raw_head[24:].split(b'\0')[0].decode('ascii', errors='replace')
        with tempfile.TemporaryDirectory() as temp:
            rsd_file = Path(temp) / 'source.rsd'
            rsd_file.write_bytes(eng_arc.read(path))
            out_ogg = out_dir / f'{key}.ogg'
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(rsd_file),
                            '-c:a', 'libvorbis', '-q:a', '4', str(out_ogg)], check=True)
        manifest[key] = {
            'file': f'{key}.ogg',
            'archive': 'ENGLISH.RCF',
            'entry': path,
            'source': source_name,
            'bytes': out_ogg.stat().st_size
        }

    for key, path in sfx_wanted.items():
        if path not in sound_arc.files:
            raise KeyError(f'SFX file {path} not found in SOUND.RCF')
        offset, size = sound_arc.files[path]
        raw_head = sound_arc.readat(offset, min(size, 256))
        source_name = raw_head[24:].split(b'\0')[0].decode('ascii', errors='replace')
        with tempfile.TemporaryDirectory() as temp:
            rsd_file = Path(temp) / 'source.rsd'
            rsd_file.write_bytes(sound_arc.read(path))
            out_ogg = out_dir / f'{key}.ogg'
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(rsd_file),
                            '-c:a', 'libvorbis', '-q:a', '4', str(out_ogg)], check=True)
        manifest[key] = {
            'file': f'{key}.ogg',
            'archive': 'SOUND.RCF',
            'entry': path,
            'source': source_name,
            'bytes': out_ogg.stat().st_size
        }

    (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Converted {len(manifest)} tutorial audio tracks to {out_dir}')
    print(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--iso', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    convert(args.iso, args.out)
