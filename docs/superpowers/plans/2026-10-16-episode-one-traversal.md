# Episode one traversal implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the first traversal foundation: source objective map, checkpoint triggers and recovery, deliberate jump input and a camera that avoids level geometry.

**Architecture:** Export compact source-derived gameplay records from the existing logic inventory. Keep trigger/progression and movement input in pure JavaScript modules; game-flow adapts them to Rapier, animation and DOM. Source objective branches remain independent rather than being treated as a fabricated linear level script.

**Tech Stack:** Existing JavaScript modules, Three.js, Rapier, Node test runner, Python source converters.

**Spec:** User-approved episode-one roadmap in `../../episode-one-roadmap.md`.

## Global constraints

- PC only; preserve the corrected map and cinematic actors.
- Do not mark combat, tutorials, or episode completion implemented without working behavior.
- Preserve source names, coordinates and prerequisites in the exported data.
- Physics and camera approximations must be identified as such.
- Work remains local; no deployment or distribution of the ISO.

## Review focus

- Holding jump must not repeatedly launch the character upon landing.
- Pausing/focus loss must not leave movement or jump input latched.
- A checkpoint with unmet prerequisites must not become active.
- Falling must recover at the active checkpoint, never at the old off-map staging platform.
- Camera collision must ignore invisible sectors and auxiliary collision render meshes.

### Task 1: Export the episode objective map

- [x] Add tools/export_gameplay.mjs to group original objective calls, checkpoint bindings and encounters.
- [x] Write public/assets/levels/l1-e1/gameplay.json and an evidence report.
- [x] Check all checkpoint volumes and locator references resolve; retain unsupported branches explicitly.

### Task 2: Checkpoint state and input

- [x] Add src/episode.js with oriented-volume containment, source prerequisites, checkpoint state and edge-triggered jump input.
- [x] Add tests/episode.test.mjs; observe failures, implement, then pass.
- [x] Keep runtime state independent of Three.js and DOM.

### Task 3: Integrate traversal and camera

- [x] Use original checkpoint triggers after NIS01, initialize recovery from cinematic handoff, and add restart checkpoint while paused.
- [x] Add one deliberate airborne jump using an original air-jump animation; preserve the established walking speed and collision geometry.
- [x] Add camera-relative input only where equivalent to the fixed follow camera; shorten the camera boom against visible geometry and smooth recovery.
- [x] Clear latched input on pause/focus loss, reset vertical velocity on recovery, and retain the working cinematic path.

### Task 4: Verify and document

- [x] Run pure-state tests and both source geometry regressions.
- [x] Browser-test full loading/cutscene handoff, jumping, pause, checkpoint activation and falling/restart.
- [x] Save screenshots and verification report; update README and the roadmap without claiming the whole episode complete.

## Rulings and execution record

Ruling: This implementation plan covers the first roadmap milestone. Combat and titans follow as separate reviewable milestones because their models, animation sets and original AI behavior still need extraction.

Ruling: Source script declaration order is not encounter order. Each objective retains its own prerequisites and trigger; no numeric encounter ordering is inferred.

Verification: 10 Node tests passed; source skin and native-strip regressions passed; opening-to-menu and HTTP video range checks passed. Chrome integration covered cinematic handoff, hold-to-jump suppression, a second airborne press, held gamepad jump across pause, original checkpoint activation, fall recovery and paused restart. Checkpoint/fall setup uses the explicit inspect-only teleport adapter; gamepad state is simulated. Report: `verification-traversal.json`.

Independent read-only review found a pause/resume edge issue with a held gamepad jump. Added `JumpInput.suspend()` and a regression test; reviewer confirmed the targeted correction with no additional findings. Full-route physics and original camera-volume semantics remain outside this milestone's acceptance.
