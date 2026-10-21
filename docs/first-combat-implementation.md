# First native combat: implementation record

User-approved scope: continue episode one with original Chiratta assets, light attacks, reactions, health/damage, death and checkpoint retry. Preserve the corrected cutscene, map and traversal. Native approximate rules are not claimed as the PS2 executable's rules.

- Source enemy package: DEFAULT.RCF `package\\aadd6163.p3d` (dictionary: Characters_Chiratta). Model 1,863 vertices / 1,132 triangles; five original clips; no missing model/texture errors.
- Source Crash clips: DEFAULT.RCF `package\\bca1bc0b.p3d`; three attack_lite clips, impact_light and death added to the existing eight traversal clips.
- Encounter: L1_E1_Combat2; original oriented trigger and EnemyLocator3 / EnemyLocator4. Source declaration numbers do not imply encounter order. Amb1 is still pending; native group victory does not mark the whole source objective complete.
- `combat.js` owns simulation state and explicit tuning; `enemy-actors.js` adapts intent to Rapier kinematic capsules and Three skinned instances. PlayerAnimation blends all gameplay poses. `game-flow.js` connects input, HUD, checkpoints and scene lifecycle.
- Death and retry reset health and enemy bodies. Source checkpoint visits snapshot cleared native groups. Permanent gameplay saves are not implemented.
- Verification: 18 Node tests; 7 traversal checks; 5 browser combat checks and a direct test-route check. Native character/map regressions retained. Browser fights use original trigger/locators through inspect-only positioning; full natural traversal is pending.
- Independent requesting-code-review pass found a held-jump regression during attack/hit. Fixed with cancelPending(), preserving the input edge until physical release; added regression and reviewer confirmed the correction. No remaining findings in the targeted review.

Next: validate uninterrupted access to the encounter, add original breakable props and attack interactions, then integrate Amb1/audio and remaining episode encounters before titans. Do not declare episode one complete from this battle prototype.
