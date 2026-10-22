"""Read-only original Spike gameplay model/animation extraction."""
import sys
from pathlib import Path
from character_nis import convert

convert(sys.argv[1], Path(__file__).resolve().parents[1] / 'public/assets/characters/spike',
 source_paths=[
  'package\\b14f79f1.p3d',
  'package\\603c5c3c.p3d',
  'package\\943a62b7.p3d',
  'package\\770ee6f1.p3d'
 ],
 actor_names=['spike'],
 preserve_root=False,
 animation_names=[
  'PTRN_spike_idle',
  'PTRN_strong_idle',
  'PTRN_strong_run',
  'PTRN_spike_attack_light_A',
  'PTRN_spike_attack_light_B',
  'PTRN_spike_attack_heavy',
  'PTRN_strong_impact_light',
  'PTRN_strong_impact_heavy',
  'PTRN_strong_impact_stumble',
  'PTRN_strong_stun',
  'PTRN_spike_jack'
 ]
)
