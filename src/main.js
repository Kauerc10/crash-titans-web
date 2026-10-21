import { initFonts, label, asset } from './bitmap.js';
import { MenuAudio } from './audio.js';
import { startGame } from './game-flow.js';
import { defaults, normalizeSettings, normalizeProfiles, cleanName, createProfile, load, persist, SETTINGS_KEY, PROFILES_KEY } from './state.js';

const screen = document.querySelector('#screen');
const stage = document.querySelector('#stage');
const viewport = document.querySelector('#viewport');
const hints = document.querySelector('#hints');
const live = document.querySelector('#live');
const audio = new MenuAudio();
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error(); } }; }
let settings = load(storage, SETTINGS_KEY, normalizeSettings);
let profiles = load(storage, PROFILES_KEY, normalizeProfiles);
let route = { name: 'title', index: 0 };
let stack = [];
let controls = [];
let draft = { slot: 0, name: '', difficulty: 'normal' };
let creditData;
let creditsPaused = false;
let padConnected = false;
let lastPadPoll = 0;
let lastPadAction = 0;
let oldPadButtons = [];
let oldPadDirection = 0;
let creditLoadId = 0;
let padLoop = false;
let gameActive = false;
let bootSeen = false;
function boot() {
  if (bootSeen) { go('main'); return; }
  bootSeen = true; gameActive = true; audio.inGame = true; stage.hidden = true; audio.music.pause();
  const root = el('div','native-game'); const video = document.createElement('video');
  video.style.cssText = 'width:100%;height:100%;object-fit:contain'; video.volume = settings.muted ? 0 : settings.effects;
  const bar = el('div','native-controls'); const skip = el('button',null,'Pular abertura'); bar.append(skip); root.append(video,bar); viewport.append(root);
  const movies = ['dolby','radical','sierra','shadow']; let index = 0;
  function next() {
    if (index === movies.length) { video.pause(); video.removeAttribute('src'); video.load(); root.remove(); gameActive=false; audio.inGame=false; stage.hidden=false; audio.apply(settings); go('main'); return; }
    video.src = `/assets/video/${movies[index++]}_ps2_ntsc.mp4`; video.play().catch(() => { video.controls = true; });
  }
  video.onended = next; video.onerror = () => { skip.textContent='Vídeo indisponível — continuar'; }; skip.onclick = next; next();
}
async function enterGame() {
  if (gameActive || viewport.querySelector('.native-game')) return;
  gameActive = true; audio.inGame = true; audio.music.pause(); stage.hidden = true;
  await startGame(viewport, () => { gameActive = false; audio.inGame = false; stage.hidden = false; audio.apply(settings); mainMenu(); if (padConnected) startPadPolling(); }, settings);
}

const copy = {
  en: {
    start: 'PRESS START', main: 'MAIN MENU', new: 'NEW GAME', load: 'LOAD GAME', options: 'OPTIONS', calibration: 'CALIBRATION',
    select: 'SELECT', back: 'BACK', navigate: 'NAVIGATE', slot: 'CHOOSE A GAME SLOT', empty: 'EMPTY', profile: 'PROFILE',
    difficulty: 'CHOOSE DIFFICULTY', easy: 'EASY', normal: 'NORMAL', hard: 'HARD', name: 'ENTER YOUR NAME',
    nameHint: 'Up to 16 letters or numbers.', next: 'CONTINUE', cancel: 'CANCEL', confirm: 'CONFIRM',
    widescreen: 'WIDESCREEN', sound: 'SOUND', vibration: 'VIBRATION', language: 'LANGUAGE', credits: 'CREDITS', volumes: 'VOLUME',
    on: 'ON', off: 'OFF', stereo: 'STEREO', mono: 'MONO', music: 'MUSIC', effects: 'SOUND EFFECTS',
    ready: 'PROFILE READY', readyNote: 'Episode 1 has an experimental native intro and exploration. Combat and objectives are still being reconstructed.',
    localNote: 'Local menu profiles. PS2 memory card saves are not imported.',
    slotEmpty: 'There is no profile in this slot.', delete: 'DELETE PROFILE', deleteTitle: 'DELETE THIS PROFILE?',
    deleteNote: 'This removes only the selected browser profile.', overwrite: 'REPLACE THIS PROFILE?',
    overwriteNote: 'This slot already has a profile. Replace it with a new one?',
    saved: 'Saved in this browser', failed: 'Storage is unavailable. Changes will last for this session only.',
    mainReturn: 'MAIN MENU', created: 'CREATED', pending: 'GAMEPLAY NOT AVAILABLE', controls: 'CONTROLS',
    calibrationHint: 'Adjust until all five shades are visible. The square should stay square.', brightness: 'BRIGHTNESS', reset: 'RESET',
    original: 'ORIGINAL GAME', creditsNote: 'Original names and roles recovered from the PS2 disc.', pause: 'PAUSE SCROLL', resume: 'RESUME SCROLL',
    easyHint: 'A gentler adventure through Wumpa Island.', normalHint: 'The standard challenge.', hardHint: 'A tougher fight for experienced players.',
    difficultyNote: 'Difficulty is stored for the future gameplay build.', preview: 'MENU PREVIEW', mute: 'Mute audio', unmute: 'Enable audio', fullscreen: 'Fullscreen',
    noProgress: 'No gameplay progress yet.', errorName: 'Enter a name to continue.', cancelNew: 'Cancel new profile',
  },
  pt: {
    start: 'PRESSIONE START', main: 'MENU PRINCIPAL', new: 'NOVO JOGO', load: 'CARREGAR JOGO', options: 'OPÇÕES', calibration: 'CALIBRAÇÃO',
    select: 'SELECIONAR', back: 'VOLTAR', navigate: 'NAVEGAR', slot: 'ESCOLHA UM ESPAÇO', empty: 'VAZIO', profile: 'PERFIL',
    difficulty: 'ESCOLHA A DIFICULDADE', easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL', name: 'DIGITE SEU NOME',
    nameHint: 'Até 16 letras ou números.', next: 'CONTINUAR', cancel: 'CANCELAR', confirm: 'CONFIRMAR',
    widescreen: 'TELA PANORÂMICA', sound: 'SOM', vibration: 'VIBRAÇÃO', language: 'IDIOMA', credits: 'CRÉDITOS', volumes: 'VOLUME',
    on: 'LIGADO', off: 'DESLIGADO', stereo: 'ESTÉREO', mono: 'MONO', music: 'MÚSICA', effects: 'EFEITOS SONOROS',
    ready: 'PERFIL PRONTO', readyNote: 'O episódio 1 tem introdução e exploração nativas experimentais. Combate e objetivos seguem em reconstrução.',
    localNote: 'Perfis locais do menu. Saves de memory card do PS2 não são importados.',
    slotEmpty: 'Não há um perfil neste espaço.', delete: 'EXCLUIR PERFIL', deleteTitle: 'EXCLUIR ESTE PERFIL?',
    deleteNote: 'Isso remove apenas o perfil selecionado deste navegador.', overwrite: 'SUBSTITUIR ESTE PERFIL?',
    overwriteNote: 'Este espaço já tem um perfil. Substituir por um novo?',
    saved: 'Salvo neste navegador', failed: 'Armazenamento indisponível. As mudanças valem apenas nesta sessão.',
    mainReturn: 'MENU PRINCIPAL', created: 'CRIADO EM', pending: 'FASES EM CONVERSÃO', controls: 'CONTROLES',
    calibrationHint: 'Ajuste até distinguir os cinco tons. O quadrado deve permanecer quadrado.', brightness: 'BRILHO', reset: 'RESTAURAR',
    original: 'JOGO ORIGINAL', creditsNote: 'Nomes e funções originais recuperados do disco de PS2.', pause: 'PAUSAR ROLAGEM', resume: 'CONTINUAR ROLAGEM',
    easyHint: 'Uma aventura mais tranquila pela Ilha Wumpa.', normalHint: 'O desafio padrão.', hardHint: 'Combates mais difíceis para jogadores experientes.',
    difficultyNote: 'A dificuldade fica salva para a futura versão jogável.', preview: 'PRÉVIA DOS MENUS', mute: 'Silenciar áudio', unmute: 'Ativar áudio', fullscreen: 'Tela cheia',
    noProgress: 'Ainda sem progresso de jogo.', errorName: 'Digite um nome para continuar.', cancelNew: 'Cancelar novo perfil',
  },
};
const t = key => copy[settings.language][key] || key;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function image(name, className, alt = '') {
  const node = new Image(); node.src = asset(name); node.className = className; node.alt = alt; node.draggable = false; return node;
}
function announce(text) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); }
function saveSettings() {
  const ok = persist(storage, SETTINGS_KEY, settings); applySettings(); if (!ok) announce(t('failed'));
}
function applySettings() {
  viewport.classList.toggle('wide', settings.widescreen);
  stage.style.setProperty('--brightness', settings.brightness);
  document.documentElement.lang = settings.language === 'pt' ? 'pt-BR' : 'en';
  audio.apply(settings);
  document.querySelector('#preview-label').textContent = t('preview');
  const toggle = document.querySelector('#sound-toggle');
  toggle.textContent = settings.muted ? '♫̸' : '♪';
  toggle.setAttribute('aria-label', settings.muted ? t('unmute') : t('mute'));
  toggle.setAttribute('aria-pressed', String(settings.muted));
  document.querySelector('#fullscreen').setAttribute('aria-label', t('fullscreen'));
  resize();
}
function resize() { const scale = viewport.clientHeight / 720; stage.style.transform = `translateX(${-480 * scale}px) scale(${scale})`; }
new ResizeObserver(resize).observe(viewport);

function focusAt(index, focus = true) {
  if (!controls.length) return;
  route.index = ((index % controls.length) + controls.length) % controls.length;
  controls.forEach((node, i) => { node.classList.toggle('selected', i === route.index); node.tabIndex = i === route.index ? 0 : -1; });
  if (focus) controls[route.index].focus({ preventScroll: true });
  if (route.name === 'slots' && matchMedia('(max-width: 600px) and (orientation: portrait)').matches) controls[route.index].scrollIntoView({ block: 'nearest', inline: 'center' });
  const description = screen.querySelector('.difficulty-description');
  if (description && route.name === 'difficulty') description.textContent = t(['easyHint', 'normalHint', 'hardHint'][route.index]);
}
function register(node) {
  const index = controls.push(node) - 1;
  node.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && index !== route.index) { audio.play('move'); focusAt(index, false); }
  });
  node.addEventListener('focus', () => { if (route.index !== index) focusAt(index, false); });
  return node;
}
function button(text, action, { small = false, className = '', size = 46 } = {}) {
  const node = el('button', `menu-button ${className}`); node.type = 'button'; node.setAttribute('aria-label', text);
  const normal = el('span', 'normal-label'); normal.append(label(text, size, '#e44a0d', small, 780));
  const active = el('span', 'active-label'); active.append(label(text, size, '#ffe5a0', small, 780));
  node.append(normal, active);
  node.addEventListener('click', () => { audio.unlock(settings); audio.play('accept'); rumble(); action(); });
  return register(node);
}
function title(text) {
  const header = el('h1', 'screen-title'); header.setAttribute('aria-label', text); header.append(label(text, 48, '#f7df95', false, 820));
  header.append(image('fe_divider_2.webp', 'title-divider')); return header;
}
function note(text, className = '') { return el('p', `note ${className}`, text); }
function mainMenu() { stack = []; go('main', {}, false); }
function go(name, props = {}, push = true) {
  creditLoadId++;
  if (push) stack.push({ ...route });
  route = { name, index: 0, ...props }; render();
}
function back() {
  if (route.name === 'title') return;
  audio.play('back');
  if (route.name === 'main') { stack = []; route = { name: 'title', index: 0 }; }
  else route = stack.pop() || { name: 'main', index: 0 };
  creditLoadId++; render();
}
function renderHints() {
  hints.replaceChildren();
  if (route.name !== 'title') {
    const left = el('span', 'hint'); left.append(el('kbd', '', padConnected ? '✕' : 'ENTER'), document.createTextNode(t('select')));
    const nav = el('span', 'hint hint-navigation'); nav.append(el('kbd', '', '↑ ↓'), document.createTextNode(t('navigate')));
    const right = el('button', 'hint hint-back'); right.type = 'button'; right.append(el('kbd', '', padConnected ? '○' : 'ESC'), document.createTextNode(t('back'))); right.addEventListener('click', back);
    hints.append(left, nav, right);
  }
}
function list() { return el('div', 'menu-list'); }

function render() {
  controls = []; screen.replaceChildren();
  const page = el('section', `screen ${route.name}`); page.dataset.screen = route.name; screen.append(page);
  renderHints();
  if (route.name === 'title') {
    page.append(image('fe_title_logo.webp', 'title-logo', 'Crash of the Titans'));
    const start = button(t('start'), boot, { size: 35, small: true, className: 'start-button' });
    page.append(start, note('© 2007 Sierra Entertainment, Inc.', 'copyright'));
  } else if (route.name === 'main') {
    page.append(image('fe_title_logo.webp', 'menu-logo', 'Crash of the Titans'));
    const items = list();
    items.append(
      button(t('new'), () => { draft = { slot: 0, name: '', difficulty: 'normal' }; go('slots', { mode: 'new' }); }),
      button(t('load'), () => go('slots', { mode: 'load' })),
      button(t('options'), () => go('options')),
      button(t('calibration'), () => go('calibration')),
    );
    page.append(items);
  } else if (route.name === 'slots') {
    page.append(title(route.mode === 'new' ? t('slot') : t('load')));
    const cards = el('div', 'slots-grid');
    profiles.forEach((profile, index) => {
      const node = el('button', 'slot-card'); node.type = 'button'; node.setAttribute('aria-label', `${index + 1} · ${profile ? profile.name : t('empty')}`);
      node.append(image(`fe_gameslot_${index + 1}.webp`, 'slot-number'));
      if (profile) node.append(image('fe_gameslot_ep_01.webp', 'slot-picture'));
      else node.append(image('fe_footprint.webp', 'slot-empty'));
      const name = el('span', 'slot-name'); name.append(label(profile?.name || t('empty'), 25, '#ffe8a8', true, 138)); node.append(name);
      const meta = el('span', 'slot-meta', profile ? t(profile.difficulty) : `— ${String(index + 1).padStart(2, '0')} —`); node.append(meta);
      node.addEventListener('click', () => {
        audio.unlock(settings); audio.play('accept');
        if (route.mode === 'new') {
          draft.slot = index;
          if (profile) go('confirm', { kind: 'overwrite', slot: index });
          else go('name');
        } else if (profile) go('profile', { slot: index });
        else { audio.play('denied'); announce(t('slotEmpty')); screen.querySelector('.slot-message').textContent = t('slotEmpty'); }
      });
      cards.append(register(node));
    });
    page.append(cards, note(t('localNote'), 'slot-message'));
  } else if (route.name === 'name') {
    page.append(title(t('name')));
    const form = el('form', 'name-form');
    const input = el('input', 'name-input'); input.type = 'text'; input.maxLength = 16; input.value = draft.name || 'CRASH'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', t('name')); input.placeholder = 'CRASH';
    input.addEventListener('input', () => { draft.name = input.value; form.querySelector('.name-error').textContent = ''; });
    const error = el('p', 'name-error'); error.setAttribute('role', 'alert');
    const submit = () => {
      const value = cleanName(input.value);
      if (!value) { error.textContent = t('errorName'); audio.play('denied'); input.focus(); return; }
      draft.name = value; go('difficulty', { index: 1 });
    };
    const next = button(t('next'), submit);
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    form.append(input, note(t('nameHint')), error, next); page.append(form);
    queueMicrotask(() => input.focus());
  } else if (route.name === 'difficulty') {
    page.append(title(t('difficulty')));
    const items = list();
    for (const difficulty of ['easy', 'normal', 'hard']) items.append(button(t(difficulty), () => {
      draft.difficulty = difficulty;
      profiles = createProfile(profiles, draft.slot, draft.name, difficulty);
      const saved = persist(storage, PROFILES_KEY, profiles);
      stack = [];
      go('ready', { saved }, false);
      enterGame();
    }));
    page.append(items, note(t('normalHint'), 'difficulty-description'), note(t('difficultyNote'), 'bottom-note'));
  } else if (route.name === 'ready' || route.name === 'profile') {
    const profile = route.name === 'ready' ? profiles[draft.slot] : profiles[route.slot];
    page.append(title(route.name === 'ready' ? t('ready') : profile.name));
    const detail = el('div', 'profile-detail');
    detail.append(image('fe_gameslot_ep_01.webp', 'profile-art'));
    const text = el('div', 'profile-copy');
    const name = el('h2'); name.append(label(profile.name, 44)); text.append(name);
    text.append(note(`${t(profile.difficulty)} · ${new Intl.DateTimeFormat(settings.language === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium' }).format(profile.createdAt)}`));
    text.append(note(t('noProgress')));
    text.append(note(t(route.name === 'ready' && !route.saved ? 'failed' : 'readyNote')));
    detail.append(text); page.append(detail);
    const actions = el('div', 'profile-actions');
    actions.append(button(settings.language === 'pt' ? 'ENTRAR NO EPISÓDIO 1' : 'ENTER EPISODE 1', enterGame, { size: 28 }));
    actions.append(button(t('mainReturn'), mainMenu, { size: 34 }));
    if (route.name === 'profile') actions.append(button(t('delete'), () => go('confirm', { kind: 'delete', slot: route.slot }), { size: 28, small: true }));
    page.append(actions);
  } else if (route.name === 'confirm') {
    const isDelete = route.kind === 'delete';
    page.append(title(t(isDelete ? 'deleteTitle' : 'overwrite')));
    const content = el('div', 'confirmation');
    const profile = profiles[route.slot]; content.append(note(profile.name, 'confirm-name'), note(t(isDelete ? 'deleteNote' : 'overwriteNote')));
    const actions = list();
    actions.append(button(t('cancel'), back), button(t('confirm'), () => {
      if (isDelete) {
        profiles[route.slot] = null;
        const ok = persist(storage, PROFILES_KEY, profiles);
        stack = stack.filter(item => item.name !== 'profile' && item.name !== 'confirm');
        route = stack.pop() || { name: 'slots', mode: 'load', index: 0 }; render(); if (!ok) announce(t('failed'));
      } else go('name');
    }));
    content.append(actions); page.append(content);
  } else if (route.name === 'options') {
    page.append(title(t('options')));
    const options = el('div', 'options-list');
    function settingRow(key, value, action) {
      const node = button(t(key), () => { action(); saveSettings(); render(); }, { className: 'option-row', size: 35 });
      const val = el('span', 'option-value'); val.append(label(value, 31, '#ffe4a0', false, 210)); node.append(val);
      node.dataset.change = key; options.append(node);
    }
    settingRow('widescreen', t(settings.widescreen ? 'on' : 'off'), () => settings.widescreen = !settings.widescreen);
    settingRow('sound', t(settings.sound), () => settings.sound = settings.sound === 'stereo' ? 'mono' : 'stereo');
    settingRow('vibration', t(settings.vibration ? 'on' : 'off'), () => settings.vibration = !settings.vibration);
    settingRow('language', settings.language === 'en' ? 'ENGLISH' : 'PORTUGUÊS', () => settings.language = settings.language === 'en' ? 'pt' : 'en');
    options.append(button(t('volumes'), () => go('volume'), { className: 'option-row', size: 35 }));
    options.append(button(t('credits'), () => go('credits'), { className: 'option-row', size: 35 }));
    page.append(options, note(t('saved'), 'bottom-note'));
  } else if (route.name === 'volume') {
    page.append(title(t('volumes')));
    const group = el('div', 'sliders');
    group.append(slider(t('music'), 'music', 0, 1, 0.05), slider(t('effects'), 'effects', 0, 1, 0.05));
    page.append(group);
  } else if (route.name === 'calibration') {
    page.append(title(t('calibration')));
    const chart = el('div', 'calibration-chart'); chart.append(image('fe_calibration_greyscale.webp', 'greyscale', 'Five grey levels'));
    const square = el('div', 'aspect-square'); square.append(el('span', '', '+')); chart.append(square); page.append(chart);
    page.append(note(t('calibrationHint'), 'calibration-note'));
    const group = el('div', 'calibration-sliders'); group.append(slider(t('brightness'), 'brightness', 0.7, 1.3, 0.05), button(t('reset'), () => { settings.brightness = defaults.brightness; saveSettings(); render(); }, { small: true, size: 29 })); page.append(group);
  } else if (route.name === 'credits') {
    page.append(title(t('credits')));
    const window = el('div', 'credits-window'); const roll = el('div', 'credits-roll'); window.append(roll); page.append(window);
    const loading = note('…'); roll.append(loading);
    const id = creditLoadId;
    (async () => {
      try {
        if (!creditData) { const res = await fetch(asset('credits.json')); if (!res.ok) throw Error(); creditData = await res.json(); }
        if (id !== creditLoadId) return;
        roll.replaceChildren();
        const studio = el('section', 'credit-group'); studio.append(label('RADICAL ENTERTAINMENT', 36), note('CRASH OF THE TITANS · 2007')); roll.append(studio);
        for (const group of creditData) {
          const item = el('section', 'credit-group'); const heading = el('h2'); heading.append(label(group.title, 29, '#f6c36b', true, 750)); item.append(heading);
          for (const text of group.names) { const person = el('p'); person.append(label(text, 26, '#f9e7b3', true, 740)); item.append(person); }
          roll.append(item);
        }
        roll.style.setProperty('--distance', `${roll.scrollHeight + window.clientHeight}px`);
        roll.style.setProperty('--duration', `${(roll.scrollHeight + window.clientHeight) / 32}s`);
        roll.classList.add('rolling'); roll.classList.toggle('paused', creditsPaused);
      } catch { loading.textContent = settings.language === 'pt' ? 'Não foi possível carregar os créditos.' : 'Could not load credits.'; }
    })();
    const pause = button(t(creditsPaused ? 'resume' : 'pause'), () => {
      creditsPaused = !creditsPaused; roll.classList.toggle('paused', creditsPaused);
      pause.setAttribute('aria-label', t(creditsPaused ? 'resume' : 'pause'));
      pause.replaceChildren(label(t(creditsPaused ? 'resume' : 'pause'), 25, '#ffe4a0', true));
    }, { className: 'credits-pause', small: true, size: 25 });
    page.append(pause);
  }
  focusAt(Math.min(route.index, controls.length - 1), route.name !== 'name');
}

function slider(text, key, min, max, step) {
  const container = el('label', 'slider-row');
  const title = el('span', 'slider-title'); title.append(label(text, 30, '#f8d58d')); container.append(title);
  const input = register(el('input', 'slider')); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = settings[key]; input.dataset.setting = key; input.setAttribute('aria-label', text);
  const value = el('output', '', `${Math.round(settings[key] * 100)}%`);
  input.addEventListener('input', () => { settings[key] = Number(input.value); value.textContent = `${Math.round(settings[key] * 100)}%`; saveSettings(); });
  input.addEventListener('change', () => audio.play('move'));
  container.append(input, value); return container;
}

function move(direction) { audio.play('move'); focusAt(route.index + direction); }
function activate() { controls[route.index]?.click(); }
function horizontal(direction) {
  if (route.name === 'slots') return move(direction);
  const node = controls[route.index];
  if (node?.matches('input[type=range]')) {
    node.value = Number(node.value) + Number(node.step) * direction; node.dispatchEvent(new Event('input')); audio.play('move');
  } else if (node?.dataset.change) node.click();
}

document.addEventListener('keydown', e => {
  if (gameActive || viewport.querySelector('.native-game')) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const typing = e.target instanceof HTMLInputElement && e.target.type === 'text';
  if (typing) { if (e.key === 'Escape') { e.preventDefault(); draft.name = e.target.value; back(); } return; }
  if (e.key === 'Tab') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace'].includes(e.key)) e.preventDefault();
  if (e.repeat && ['Enter', ' ', 'Escape', 'Backspace'].includes(e.key)) return;
  audio.unlock(settings);
  if (e.key === 'ArrowUp') move(-1);
  else if (e.key === 'ArrowDown') move(1);
  else if (e.key === 'ArrowLeft') horizontal(-1);
  else if (e.key === 'ArrowRight') horizontal(1);
  else if (e.key === 'Enter' || e.key === ' ') {
    if (e.target instanceof HTMLButtonElement && !controls.includes(e.target)) e.target.click();
    else activate();
  } else if (e.key === 'Escape' || e.key === 'Backspace') back();
});
function rumble() {
  if (!settings.vibration) return;
  for (const pad of navigator.getGamepads?.() || []) pad?.vibrationActuator?.playEffect('dual-rumble', { duration: 35, strongMagnitude: 0.08, weakMagnitude: 0.14 })?.catch(() => {});
}
function pollPads(now) {
  if (gameActive || viewport.querySelector('.native-game')) { padLoop = false; return; }
  const pad = [...(navigator.getGamepads?.() || [])].find(p => p && p.mapping === 'standard');
  if (!pad || document.hidden) { oldPadButtons = []; padLoop = false; return; }
  requestAnimationFrame(pollPads);
  if (document.hidden || now - lastPadPoll < 45) return;
  lastPadPoll = now;
  const buttons = pad.buttons.map(b => b.pressed);
  const pressed = i => buttons[i] && !oldPadButtons[i];
  let direction = 0;
  if (buttons[12] || pad.axes[1] < -0.55) direction = -1;
  if (buttons[13] || pad.axes[1] > 0.55) direction = 1;
  if (direction && (now - lastPadAction > 200 || direction !== oldPadDirection)) { move(direction); lastPadAction = now; }
  if (pressed(14) || (pad.axes[0] < -0.55 && now - lastPadAction > 200)) { horizontal(-1); lastPadAction = now; }
  if (pressed(15) || (pad.axes[0] > 0.55 && now - lastPadAction > 200)) { horizontal(1); lastPadAction = now; }
  if (pressed(0) || pressed(9)) { audio.unlock(settings); activate(); }
  if (pressed(1)) back();
  oldPadButtons = buttons; oldPadDirection = direction;
}
function startPadPolling() { if (!padLoop) { padLoop = true; requestAnimationFrame(pollPads); } }
window.addEventListener('gamepadconnected', () => { padConnected = true; renderHints(); startPadPolling(); });
window.addEventListener('gamepaddisconnected', () => { padConnected = [...navigator.getGamepads()].some(Boolean); renderHints(); });
document.addEventListener('visibilitychange', () => { audio.visibility(); if (!document.hidden && padConnected) startPadPolling(); });
document.querySelector('#sound-toggle').addEventListener('click', () => { settings.muted = !settings.muted; saveSettings(); window.dispatchEvent(new Event('game-audio-settings')); audio.unlock(settings); document.querySelectorAll('.native-game audio, .native-game video').forEach(media => { media.volume = settings.muted ? 0 : settings.effects; }); });
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('#game').requestFullscreen(); } catch { /* Unsupported on some mobile browsers. */ }
});

try { await initFonts(); applySettings(); render(); startPadPolling(); if(['combat-test','interactions-test','play','game'].some(key=>new URLSearchParams(location.search).get(key)==='1'))enterGame(); }
catch (err) { screen.replaceChildren(note(settings.language === 'pt' ? 'Não foi possível carregar o menu. Reabra pelo servidor local.' : 'Could not load the menu. Open it through the local server.')); console.error(err); }
