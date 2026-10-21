"""Read-only original Chiratta gameplay model/animation extraction."""
import sys
from pathlib import Path
from character_nis import convert

convert(sys.argv[1],Path(__file__).resolve().parents[1]/'public/assets/characters/chiratta',
 source_paths=['package\\aadd6163.p3d'],actor_names=['chiratta'],preserve_root=False,
 animation_names=['PTRN_chiratta_talk','PTRN_chiratta_idle_combat','PTRN_chiratta_run','PTRN_chiratta_attack_light','PTRN_chiratta_impact_light','PTRN_chiratta_impact_heavy'])
