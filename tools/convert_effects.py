"""Recover original hit and defeat effect textures from PS2 packages."""
import argparse, json
from pathlib import Path
from convert_menu import Disc, Archive, image_assets
from p3d import chunks

def convert(iso, out):
    arc = Archive(Disc(iso), 'DEFAULT.RCF')
    out = Path(out)
    impact_dir = out / 'impact'
    death_dir = out / 'death'
    impact_dir.mkdir(parents=True, exist_ok=True)
    death_dir.mkdir(parents=True, exist_ok=True)

    image_assets(chunks(arc.read('package\\c6173b06.p3d')), impact_dir)
    image_assets(chunks(arc.read('fx\\ab40fe25.p3d')), death_dir)

    manifest = {
        'impact': {
            'package': 'package\\c6173b06.p3d',
            'effect': 'impact_punch_grey_star',
            'textures': [p.name for p in impact_dir.glob('*.webp')]
        },
        'death': {
            'package': 'fx\\ab40fe25.p3d',
            'effect': 'death_effectA',
            'textures': [p.name for p in death_dir.glob('*.webp')]
        },
        'limitations': [
            'Sprite quad billboards used in place of full Pure3D particle emitter simulation.',
            'Original spark, star, flash and streak textures preserved.'
        ]
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print('Converted effects:', json.dumps(manifest, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--iso', required=True)
    parser.add_argument('--out', default='outputs/crash-menu/public/assets/effects')
    args = parser.parse_args()
    convert(args.iso, args.out)
