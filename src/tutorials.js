import { containsVolume } from './episode.js';

export class TutorialManager {
  constructor(gameplayData, audioManager = null) {
    this.gameplay = gameplayData;
    this.tutorials = gameplayData.tutorials || [];
    this.volumes = gameplayData.volumes || {};
    this.audio = audioManager;
    this.completed = new Set();
    this.checkpointCompleted = new Set();
    this.active = null; // { id, title, text, type, until, remaining, duration, audio }
    this.inputMode = 'keyboard'; // 'keyboard' | 'gamepad'
    this.gameplayTime = 0;
    this.paused = false;
    this.interactionRadius = 3.0; // Proximity threshold for tutorial stones
    this.spikeReached = false;
  }

  setInputMode(mode) {
    if (this.inputMode === mode) return;
    this.inputMode = mode === 'gamepad' ? 'gamepad' : 'keyboard';
    if (this.active) {
      const def = this.tutorials.find(t => t.id === this.active.id);
      if (def) {
        this.active.text = def.texts?.[this.inputMode] || def.texts?.keyboard || '';
      }
    }
  }

  complete(id) {
    this.completed.add(id);
    if (this.active?.id === id) {
      this.active = null;
    }
  }

  isCompleted(id) {
    return this.completed.has(id);
  }

  markCheckpoint() {
    this.checkpointCompleted = new Set(this.completed);
  }

  resetToCheckpoint() {
    this.completed = new Set(this.checkpointCompleted);
    this.active = null;
    this.spikeReached = this.completed.has('SpikeCinematic');
  }

  pause(isPaused) {
    if (this.paused === isPaused) return;
    this.paused = isPaused;
    if (isPaused && this.active) {
      this.active.remaining = Math.max(0, this.active.until - this.gameplayTime);
    } else if (!isPaused && this.active && this.active.remaining != null) {
      this.active.until = this.gameplayTime + this.active.remaining;
      this.active.remaining = null;
    }
  }

  triggerTutorial(tut) {
    this.completed.add(tut.id);
    this.active = {
      id: tut.id,
      title: tut.title,
      text: tut.texts?.[this.inputMode] || tut.texts?.keyboard || '',
      type: tut.type,
      duration: tut.duration || 5,
      until: this.gameplayTime + (tut.duration || 5),
      audio: tut.audio
    };
    if (tut.audio && this.audio?.playTutorial) {
      this.audio.playTutorial(tut.audio);
    } else if (this.audio?.playFrontEnd) {
      this.audio.playFrontEnd('chime');
    }
    return {
      type: 'tutorialStarted',
      id: tut.id,
      title: tut.title,
      text: this.active.text,
      promptType: tut.type,
      audio: tut.audio
    };
  }

  step(dt, position, episodeProgress) {
    const events = [];
    if (!this.paused) {
      this.gameplayTime += dt;
      if (this.active && this.gameplayTime >= this.active.until) {
        events.push({ type: 'tutorialEnded', id: this.active.id });
        this.active = null;
      }
    }

    if (!position || !episodeProgress) return events;

    // Check each tutorial definition against triggers and prerequisites
    for (const tut of this.tutorials) {
      if (this.completed.has(tut.id)) continue;

      // Prerequisites check: all required objective IDs must be completed
      if (tut.requires?.length) {
        const satisfied = tut.requires.every(req => episodeProgress.completed.has(req));
        if (!satisfied) continue;
      }

      let triggered = false;
      if (tut.triggerType === 'volume') {
        const vol = this.volumes[tut.trigger];
        if (vol && containsVolume(vol, position)) {
          triggered = true;
        }
      } else if (tut.triggerType === 'interaction') {
        if (tut.position) {
          const dist = Math.hypot(
            position[0] - tut.position[0],
            position[1] - tut.position[1],
            position[2] - tut.position[2]
          );
          if (dist <= this.interactionRadius) {
            triggered = true;
          }
        }
      } else if (tut.triggerType === 'objective') {
        // Triggers once prerequisite objective is completed
        triggered = true;
      }

      if (triggered) {
        events.push(this.triggerTutorial(tut));
      }
    }

    // Check Spike interaction entrance
    const playSpikeVol = this.volumes['PlaySpike'];
    if (playSpikeVol && containsVolume(playSpikeVol, position)) {
      if (episodeProgress.completed.has('L1_E1_Combat2')) {
        if (!this.spikeReached) {
          this.spikeReached = true;
          this.completed.add('SpikeCinematic');
          episodeProgress.complete('SpikeCinematic');
          events.push({
            type: 'spikeInteractionReached',
            id: 'SpikeCinematic',
            position: [...position],
            locator: 'NIS_20'
          });
        }
      } else {
        events.push({
          type: 'spikeInteractionBlocked',
          id: 'SpikeCinematic',
          reason: 'Prerequisite L1_E1_Combat2 not satisfied'
        });
      }
    }

    return events;
  }
}
