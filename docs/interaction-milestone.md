# Episode-one interaction milestone

Approved scope: a larger playable increment before moving to episode two.

1. Recover original prop visibility, event transitions, frame ranges, spawn counts and mojo values. Export pots/mailboxes/large plants/metal and large crates with shared texture dependencies. Never combine mutually exclusive intact/broken geometry.
2. Implement source-driven breakable states, once-per-swing impacts, gated strength, original transition animation sampling, collision removal and checkpoint snapshots. Preserve existing movement/jump/cutscene behavior.
3. Add original S/M/L/XL mojo models, the 119 literal placed pickups, guaranteed prop drops, attraction/collection, a HUD counter and consistent checkpoint rollback.
4. Add matching source prop/pickup audio when present. Test rules, real browser inputs, pause/retry, original scene visibility, asset loading, and prior combat/traversal.

Ruling: keep negative spawn counts deferred because their probability convention is not established. Export their evidence, rather than turn them into guaranteed drops.
Ruling: Crash light attacks use native strength 1. Source strength-15 gates remain locked until the titan milestone. Numeric enemy damage and original native collision/attraction algorithms are still approximate.
Ruling: use source collision boxes for the solid pots/mailboxes/crates; full foliage collision and explosion crates remain pending. All source placements remain unchanged.

Progress: tasks 1–4 complete for this milestone. Original state event transitions and frame ranges now drive six prop kinds/140 placements, with 119 original mojo placements and source positive spawn counts. Ten original audio effects, 14 solid colliders, checkpoint rollback and a direct test route are integrated. The bonus-room geometry and 1,643 collision triangles were added because integrated tests proved that crates otherwise fell into an unloaded room.

Verification: 26 Node tests; Chrome interaction tests cover pot, small plant, animated mailbox papers, five-hit metal crate, positive drops, pause and rollback; direct test entry reaches Mojo 220 after a pot and one crate. Normal NIS-to-Potted3 keyboard-only traversal collects Mojo 20 without recovery. Existing seven traversal checks and audio decode/playback/pause/mute checks passed. Independent read-only review found no important actionable findings in interaction code or bonus-room region integration.

Ruling: the full source native particle simulation, probabilistic negative drop counts, timed explosives, persistent gameplay save, titan strength and normal bonus-room portal progression are deferred to later roadmap tasks. The original bonus room is currently reachable through the explicit test shortcut, not a fabricated progression gate.
