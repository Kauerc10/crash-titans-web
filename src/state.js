export const SETTINGS_KEY = 'cott.menu.settings.v1';
export const PROFILES_KEY = 'cott.menu.profiles.v1';
export const defaults = Object.freeze({ widescreen: false, sound: 'stereo', vibration: true, music: 0.65, effects: 0.8, muted: false, language: 'en', brightness: 1 });

export function normalizeSettings(data = {}) {
  const s = { ...defaults };
  for (const k of ['widescreen', 'vibration', 'muted']) if (typeof data?.[k] === 'boolean') s[k] = data[k];
  for (const k of ['music', 'effects']) if (Number.isFinite(data?.[k])) s[k] = Math.min(1, Math.max(0, data[k]));
  if (Number.isFinite(data?.brightness)) s.brightness = Math.min(1.3, Math.max(0.7, data.brightness));
  if (['stereo', 'mono'].includes(data?.sound)) s.sound = data.sound;
  if (['en', 'pt'].includes(data?.language)) s.language = data.language;
  return s;
}

export function normalizeProfiles(data) {
  const slots = Array(5).fill(null);
  if (!Array.isArray(data)) return slots;
  data.slice(0, 5).forEach((p, i) => {
    if (!p || typeof p.name !== 'string' || !['easy', 'normal', 'hard'].includes(p.difficulty) || !Number.isFinite(p.createdAt)) return;
    const name = cleanName(p.name);
    if (name) slots[i] = { name, difficulty: p.difficulty, createdAt: p.createdAt, status: 'menu-only' };
  });
  return slots;
}

export function cleanName(name) {
  return String(name).normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);
}

export function createProfile(slots, index, name, difficulty, now = Date.now()) {
  const cleaned = cleanName(name);
  if (!Number.isInteger(index) || index < 0 || index > 4) throw new Error('Invalid slot');
  if (!cleaned) throw new Error('A name is required');
  if (!['easy', 'normal', 'hard'].includes(difficulty)) throw new Error('Invalid difficulty');
  const next = normalizeProfiles(slots);
  next[index] = { name: cleaned, difficulty, createdAt: now, status: 'menu-only' };
  return next;
}

export function load(storage, key, normalize) {
  try { return normalize(JSON.parse(storage.getItem(key) || 'null')); }
  catch { return normalize(undefined); }
}

export function persist(storage, key, data) {
  try { storage.setItem(key, JSON.stringify(data)); return true; }
  catch { return false; }
}
