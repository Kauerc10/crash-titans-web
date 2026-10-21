import { asset } from './bitmap.js';

export class MenuAudio {
  constructor() { this.music = new Audio(asset('audio/menu.ogg')); this.music.loop = true; this.music.preload = 'none'; this.enabled = false; this.buffers = new Map(); }
  async unlock(settings) {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.context = new AudioContext();
        this.output = this.context.createGain(); this.output.connect(this.context.destination);
        this.musicSource = this.context.createMediaElementSource(this.music); this.musicSource.connect(this.output);
      }
    }
    await this.context?.resume().catch(() => {});
    this.enabled = true; this.apply(settings);
    if (!settings.muted && !document.hidden && !this.inGame) await this.music.play().catch(() => {});
    if (this.context && !this.loading) {
      this.loading = Promise.all(['move', 'accept', 'back', 'denied'].map(async name => {
        try { const res = await fetch(asset(`audio/${name}.ogg`)); const bytes = await res.arrayBuffer(); this.buffers.set(name, await this.context.decodeAudioData(bytes)); } catch { /* Menu remains usable without audio. */ }
      }));
    }
  }
  apply(settings) {
    this.settings = settings;
    this.music.volume = settings.muted ? 0 : settings.music;
    if (this.output) { this.output.channelCount = settings.sound === 'mono' ? 1 : 2; this.output.channelCountMode = 'explicit'; }
    if (settings.muted || this.inGame) this.music.pause();
    else if (this.enabled && !document.hidden) this.music.play().catch(() => {});
  }
  play(name) {
    if (!this.context || !this.buffers.has(name) || this.settings.muted) return;
    const src = this.context.createBufferSource(); src.buffer = this.buffers.get(name);
    const gain = this.context.createGain(); gain.gain.value = this.settings.effects;
    src.connect(gain); gain.connect(this.output); src.start();
    src.onended = () => { src.disconnect(); gain.disconnect(); };
  }
  visibility() {
    if (document.hidden) { this.music.pause(); this.context?.suspend(); }
    else if (this.enabled) { this.context?.resume().catch(() => {}); this.apply(this.settings); }
  }
}
