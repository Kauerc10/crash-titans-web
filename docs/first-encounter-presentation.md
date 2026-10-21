# First encounter presentation

## Recovered order

The episode objective `L1_E1_Combat2` waits for `L1_E1_CombatVolume2`, clears spawn groups, sets maximum attack power, spawns `AmbConvActor01` and `AmbConvActor02` at `L1_E1EnemyLocator3`/`4`, waits for `L1_E1_Amb1`, unlocks Chiratta information, and waits for the enemy group to become empty. Source objective call offsets are 264, 266, 269, 278, 287, 291, 294 and 298.

Amb1 is an ambient fighttree conversation, not a NIS camera-and-actor cinematic. `Ambient.bfig` contains eleven ordered `amb1_01` through `amb1_11` nodes. They alternate the two actor names and reference the original `PTRN_chiratta_talk` animation and `amb01` sound event.

The sound event in the original episode sound script maps the numbered utterances to Labrat3/Labrat4 dialogue streams. The converter identifies each English RSD by its original path header, verifies that its stream reference exists in the event, decodes it and concatenates the eleven utterances. Total decoded speech duration is 59.997 seconds. No dialogue, speaker order, replacement voice or camera path is generated.

## Native integration

- The encounter spawns its actors before the conversation starts.
- Attacks, pursuit and player movement wait for the presentation to finish. The current speaker uses its talk clip; the other actor stays in the combat idle pose.
- The audio playback clock drives speaker changes, avoiding drift caused by slow rendering frames.
- Pause freezes speech and simulation; mute/effects volume apply to dialogue. Returning to the menu stops playback.
- A retry resets the active conversation and its actors. Repeated simulation ticks do not start another presentation for the same live encounter.
- Development combat/interaction shortcuts keep their immediate gameplay entry and intentionally omit Amb1. Acceptance uses the normal route.

## Reproduce conversion locally

Run the ambient converter with `--iso` pointing to the local disc image. Re-run the Chiratta converter to include the talk clip. Generated audio, manifests and GLB remain excluded from Git.

## Limits

The original engine's inter-line padding and interruption semantics have not been fully decoded. The native sequence currently follows the decoded speech durations. The gameplay camera remains active because an original Amb1 camera override has not been recovered. Skip is disabled for this conversation: the boolean argument to `WAIT_PlayCinematic` alone is insufficient evidence of original skip permission. Facial deformation channels remain outside the current GLB conversion.

The deterministic encounter tests cover movement/attack gating, speaker changes, completion and retry. Full normal-route browser acceptance is recorded separately; this document does not treat direct-start or teleport diagnostics as evidence of that route.
