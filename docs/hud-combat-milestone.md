# Source HUD and combat base-data milestone

The user approved original HUD art, combat indicators and evidence-based damage/health before titans.

Implemented:
- 38 original image resources from DEFAULT.RCF package/7a8185b0.p3d, including health, mojo, combo and enemy icons. Source fonts remain the already converted Titans bitmap fonts. Health-fill now uses the complete256x32 strip; the earlier half-strip interpretation was corrected from source texels and original-game references.
- A transparent DOM HUD replacing the provisional browser progress panel. Health clipping, mojo, temporary contact combo and objective text reflect live game state. Pause freezes state; checkpoint retry resets transient counters. Accessible meter values expose exact health and maxima; original-font counters have accessible hidden labels.
- Base template health: Crash 90; Chiratta 4. No current level callback override was found in the recovered player_normal/spawn_normal assignments.
- Light attacks extracted from explicit self:Attack calls: A strength2/damage1 frames3â€“6; B strength2/damage1 frames3â€“6; C wrist strength2/damage2 frames3â€“7 and ankle strength4/damage3 frames10â€“15. FPS30. Chiratta light attack strength1/damage2 frames22â€“27, with source cooldown1 second.
- Each source strike tracks impacted actors independently. The two C contacts are separate legitimate hits. Prop interaction consumes these same source windows/strengths, instead of a separate percentage-of-animation heuristic.

Evidence: tools/convert_hud_combat.py, public/assets/hud/combat-source.json, public/assets/hud/manifest.json, generated src/combat-rules.js. Template arguments are bound through original debug-local parameter names. The Attack method parameter order was checked in script/mixins/combat_methods.blua (function line181): self, enabled, volume, strength, damage, power, name, block threshold, direction. BFIG on-contact records use tag0xae6d7c53 plus start/end frames; source calls are read as data, never executed.

Limits: these are base source values, not proof of the final difficulty/upgrades/damage-modifier pipeline. Native wrist/ankle collision volumes are still approximated by the existing forward reach check. Pursuit, invulnerability, stagger and combo input grace remain native tuning. HUD positions, target-panel layout and feedback/show-hide timings are reconstructed. Future titan, stamina, special, timer, life-count, boss and end-of-episode UI are not simulated with fabricated values.

Verification: 29 Node tests pass, including attack wind-up, separate C contacts and source enemy damage; Chrome verification-hud-combat.json covers all image requests, original meters (90/4), combo visibility, damage clipping, pause and retry. Existing seven traversal checks and interaction test entry (pot + source room + crate, Mojo220) pass. Independent review found no important actionable findings.

Final regression: original trigger spawns two Chirattas; keyboard combo defeats both; retry restores90 PV; enemies apply damage; natural death returns to checkpoint. Chrome run passed with no page/console errors (`verification-combat.json`). Seven movement/checkpoint checks and keyboard-only NIS-to-Potted3 collection also passed.


## Correction from original-game references

The supplied gameplay screenshots disproved two earlier HUD assumptions: the Chiratta vial is an objective counter, not enemy health; the orange health texture is a continuous256x32 strip, not two repeated cells. The target-health meter was removed, leaving enemy health internal. Mojo is top-center, the source star combo is tinted green and placed lower-left, and objective text remains accessible without duplicating the visible transient notice. The Crash emblem applies an orange character palette to the source symbol coverage mask. These are reconstructed layout/palette choices guided by the reference screenshots; the original mojo upgrade-ring animation and other mechanic-specific HUD states are still pending.

The visual decoder failure was reproduced with tests/texture_storage.py: rectangular indexed images in this disc are linear, while the decoder was applying the square native swizzle. HUD health256x32/background128x32 and waterfall caustic64x128 failed the literal indexed-texel comparison before the fix and pass after it. The square Mojo decoded-pixel SHA256 remains2a4c1e84b9ad2d2524b2729bc169c87fa78df05669f061033ee3d1c0490ac357. Map textures and HUD art were regenerated. The browser check now asserts absence of a visible Chiratta health meter. Water brightness/material fidelity remains pending.


## Base-health assembly correction

The subsequent reference comparison exposed a second assembly error: rendering the full strip displayed upgrade tails at base90 HP, while the128px frame was stretched to an incompatible width. The base frame has102 visible texels and its enclosed interior spans source x5..98. The converter flood-fills only the outside of the source outline to recover its enclosed interior, masks away all upgrade tails, exports a separate empty interior, static frame and colored fill, and generates health-meter-geometry.js. Damage clips only the93px fill, never the frame. The art preserves its102:32 aspect ratio; HUD scale follows the actual playfield width/1280 and height/720. The symbol palette no longer erodes its source silhouette.

Browser fixture verifies90/45/0 HP retain identical frame bounds and correct clipping; at640px the base bar is80px wide. Captures previews/health-90.png, health-45.png and health-0.png. verification-health-layout.json records the checks; verification-hud-combat.json verifies real damage/pause/retry. The29 Node tests remain passing. This corrects the base assembly; upgrade-specific lengths still require their gameplay state.

### Health bar orientation from forest reference

The forest comparison shows a level upper edge, rising lower edge and symbol curls facing the bar. The runtime now flips the meter vertically and the symbol horizontally. The source colored rim is retained across the full 102px frame silhouette and rendered above the black backing, instead of masking it to the enclosed hole. The bar remains 200px wide with its previous height; symbol luminance is reduced to match the reference more closely. Orientation and full/half/zero HP are checked by `work/test_health_layout.cjs`. The small reference does not support a pixel-exact color claim.
