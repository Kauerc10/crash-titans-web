import { containsVolume } from './episode.js';

// Reference inventory may describe actions not implemented by this runtime.
export const unavailableTutorials = new Set(['Tutorial_Tutorial_BouncePad','MultiplyTutorial','Tutorial_Hint_SpinHover','Tutorial_Hint_BlockBreaker','Tutorial_Tutorial_Jack','SpikeCinematic']);

export class TutorialManager {
  constructor(gameplayData) {
    this.gameplay = gameplayData;
    this.tutorials = gameplayData.tutorials || [];
    this.volumes = gameplayData.volumes || {};
    this.completed = new Set();
    this.checkpointCompleted = new Set();
    this.checkpointActive = null;
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
    this.checkpointActive = this.active ? {...this.active,remaining:this.active.remaining??Math.max(0,this.active.until-this.gameplayTime)} : null;
  }

  resetToCheckpoint() {
    this.completed = new Set(this.checkpointCompleted);
    this.active = this.checkpointActive ? {...this.checkpointActive,until:this.gameplayTime+this.checkpointActive.remaining,remaining:this.paused?this.checkpointActive.remaining:null} : null;
    if(this.active){const def=this.tutorials.find(t=>t.id===this.active.id);this.active.text=def?.texts?.[this.inputMode]||def?.texts?.keyboard||'';}
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
    if(tut.implemented===false||unavailableTutorials.has(tut.id))return null;
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

    if (this.paused || !position || !episodeProgress) return events;

    // Check each tutorial definition against triggers and prerequisites
    for (const tut of this.tutorials) {
      if (tut.implemented===false||unavailableTutorials.has(tut.id)||this.completed.has(tut.id)) continue;

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

    return events;
  }
}
