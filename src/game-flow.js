import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from '../node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
import { EpisodeProgress, JumpInput } from './episode.js';
import { FollowCamera } from './follow-camera.js';
import { PlayerAnimation, fallingAnimation } from './player-animation.js';
import { GameplayAudio } from './gameplay-audio.js';
import { Breakables } from './breakables.js';
import { PropActors } from './prop-actors.js';
import { Pickups } from './pickups.js';
import { PickupActors } from './pickup-actors.js';
import { Combat, combatTuning } from './combat.js';
import { GameplayHud } from './gameplay-hud.js';
import { EnemyActors } from './enemy-actors.js';

const base = '/assets/levels/l1-e1/';
const json = async url => { const r = await fetch(url); if (!r.ok) throw Error(`${url}: ${r.status}`); return r.json(); };
export function sampleTrack(track, frame, fallback) {
  if (!track?.frames.length) return fallback;
  const { frames, values } = track;
  let i = 0; while (i + 1 < frames.length && frames[i + 1] <= frame) i++;
  if (i === frames.length - 1 || frames[i + 1] - frames[i] === 1) return values[i];
  const t = Math.max(0, Math.min(1, (frame - frames[i]) / (frames[i + 1] - frames[i])));
  return values[i].map((v, j) => v + (values[i + 1][j] - v) * t);
}
const vector = a => new THREE.Vector3(a[0], a[1], -a[2]);

export async function startGame(viewport, onExit, settings) {
  const root = document.createElement('div'); root.className = 'native-game'; viewport.append(root);
  const status = document.createElement('div'); status.className = 'native-status'; root.append(status);
  const bar = document.createElement('div'); bar.className = 'native-controls'; root.append(bar);
  const gameplayHud=new GameplayHud(root),hud=gameplayHud.root;
  const action = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; bar.append(b); return b; };
  let stopped = false, frameId, world, renderer, dialogue, ambientAudio, phase = 'loading', paused = false;
  const effects=new GameplayAudio(settings);
  const settingsChanged=()=>{effects.apply();if(ambientAudio)ambientAudio.volume=settings.muted?0:settings.effects;};window.addEventListener('game-audio-settings',settingsChanged);
  const keys = new Set(), resources = new Set();
  const jumpInput = new JumpInput(); let progress,follow,noticeUntil=0,gameplayTime=0,jumpCount=0,recoveryCount=0,spaceHeld=false;
  let breakables,props,pickups,pickupActors;
  let combat,enemies,padAttackDown=false;
  function updateHud(){if(combat)gameplayHud.update(combat,pickups,gameplayTime);}
  const padJumpHeld=()=>[...(navigator.getGamepads?.()||[])].some(p=>p?.mapping==='standard'&&p.buttons[0]?.pressed);
  const occluders=[];
  const regionObjects=new Map();
  const collisionRegions = new Map(); let activeRegion = 'r1';
  function selectRegion(name) {
    activeRegion = name;
    for(const [region,object] of regionObjects)object.visible=region===name;
    occluders.length=0;
    regionObjects.get(name)?.traverse(o=>{
      if(!o.isMesh||!o.visible||o.material.transparent||o.material.alphaTest>0)return;
      let ancestor=o;while(ancestor){if(!ancestor.visible||ancestor.userData.collisionMaterial)return;ancestor=ancestor.parent;}
      occluders.push(o);
    });
  }
  function stop() {
    if (stopped) return; stopped = true; cancelAnimationFrame(frameId); dialogue?.pause(); ambientAudio?.pause(); observer.disconnect();
    document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
    resources.forEach(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); } });
    pickupActors?.clear();props?.clear();effects.stop();window.removeEventListener('game-audio-settings',settingsChanged);enemies?.clear();renderer?.dispose(); world?.free(); root.remove(); onExit();
  }
  action('Voltar ao menu', stop);
  const pauseButton = action('Pausar', () => { paused = !paused; effects.pause(paused);keys.clear();
    jumpInput.suspend();
    const heldPad=padJumpHeld();
    padAttackDown=[...(navigator.getGamepads?.()||[])].some(p=>p?.buttons[2]?.pressed);
    if(!spaceHeld&&!heldPad)jumpInput.release();
    pauseButton.textContent = paused ? 'Continuar' : 'Pausar'; restart.hidden=phase!=='play'||!paused; if (phase === 'cinematic') paused ? dialogue.pause() : dialogue.play().catch(showError); if(combat?.presentation)paused?ambientAudio.pause():ambientAudio.play().catch(showError); });
  const skip = action('Pular cena', () => enterPlay()); skip.hidden = true;
  const restart=action('Retomar checkpoint',()=>{recover();if(paused)pauseButton.click();});restart.hidden=true;
  function notice(text,seconds=5){status.hidden=false;status.textContent=text;noticeUntil=gameplayTime+seconds;}
  function recover(){
    const checkpoint=progress?.recovery();if(!checkpoint||!body)return;
    body.setTranslation({x:checkpoint.position[0],y:checkpoint.position[1]+.95,z:checkpoint.position[2]},true);
    crash.rotation.y=checkpoint.yaw;velocity=0;accumulator=0;keys.clear();spaceHeld=false;jumpInput.reset();follow.reset();
    recoveryCount++;
    ambientAudio?.pause();if(ambientAudio)ambientAudio.currentTime=0;effects.clear();pickups?.resetToCheckpoint();gameplayHud.reset(pickups?.total||0);breakables?.resetToCheckpoint();props?.sync(breakables);combat?.resetToCheckpoint();enemies?.clear();updateHud();
    notice('Retomando do último checkpoint',3);
  }
  function showError(e) { status.hidden = false; status.textContent = `Falha ao carregar: ${e.message}. Volte ao menu para tentar novamente.`; }
  function keyDown(e) { if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); keys.add(e.code); if(e.code==='Space'&&!e.repeat){spaceHeld=true;if(phase==='play'&&!paused)jumpInput.press();} if(e.code==='KeyJ'&&!e.repeat&&phase==='play'&&!paused)combat?.requestAttack(); if (e.code === 'Escape' && !e.repeat) pauseButton.click(); }
  function keyUp(e) { keys.delete(e.code);if(e.code==='Space'){spaceHeld=false;if(!padJumpHeld())jumpInput.release();} }
  function blur() { keys.clear();spaceHeld=false; if (!paused && phase !== 'loading') pauseButton.click(); }
  document.addEventListener('keydown', keyDown); document.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x89b8ca);
  scene.add(new THREE.HemisphereLight(0xffffff,0x7c725f,2));
  const sun = new THREE.DirectionalLight(0xffffff,2); sun.position.set(-20,50,30); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(65, 4 / 3, .1, 1800);
  const observer = new ResizeObserver(() => { if (!renderer) return; const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w,h);gameplayHud.resize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix(); }); observer.observe(root);
  let crash, playerAnimation, activeClip, body, collider, controller, velocity = 0, accumulator = 0,jumpPhase='ground',jumpAge=0;
  const actors = [], mixers = []; let cinematicCrash;
  function animate(name,once=false) { if(playerAnimation.play(name,once))activeClip=name; }
  function enterPlay() {
    if (!crash || !body || phase === 'play') return;
    phase = 'play'; dialogue?.pause(); actors.forEach(a => a.visible = false); crash.visible = true; skip.hidden = true;
    // Original PlayerSpawnPosition; cinematic handoff objectives remain under investigation.
    if (cinematicCrash) {
      const index = actors.indexOf(cinematicCrash); mixers[index].setTime(103.3333); cinematicCrash.updateMatrixWorld(true);
      let motion; cinematicCrash.traverse(o => { if (o.isBone && /Motion_Root/i.test(o.name)) motion = o; });
      if (motion) { const p = motion.getWorldPosition(new THREE.Vector3()); body.setTranslation({x:p.x,y:p.y+1,z:p.z},true); }
    }
    velocity = 0;accumulator=0;jumpInput.reset();follow.reset();
    const entry=body.translation();progress.setEntry([entry.x,entry.y-.95,entry.z],crash.rotation.y);progress.complete('NIS01');
    hud.hidden=false;updateHud();
    notice('WASD / setas: mover • Espaço: salto / salto duplo • J: ataque leve • Esc: pausa',8);
    animate('idle');
  }
  try {
    renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; root.prepend(renderer.domElement);
    observer.disconnect(); observer.observe(root);
    const manager = new THREE.LoadingManager(); manager.onProgress = (_, n, total) => { status.textContent = `CARREGANDO… ${n} / ${total} recursos`; };
    const loader = new GLTFLoader(manager);
    const add = gltf => { if (stopped) return; scene.add(gltf.scene); gltf.scene.traverse(o => {
      resources.add(o); if (o.userData.collisionMaterial) o.visible = false;
      // NIS moves bones in world space while the mesh node stays at its anchor.
      // Bind-pose bounds therefore cannot cull an animated actor correctly.
      if (o.isSkinnedMesh) o.frustumCulled = false;
      for (const material of [].concat(o.material || [])) {
        if (material.userData.properties?.ATST === 1) { material.alphaTest = .01; material.transparent = false; material.depthWrite = true; material.needsUpdate = true; }
        if (material.userData.properties?.BLMD === 2) { material.blending = THREE.AdditiveBlending; material.transparent = true; material.depthWrite = false; material.needsUpdate = true; }
      }
    }); return gltf; };
    const runtime = await json('/assets/cinematics/nis01/runtime.json');
    const gameplay=await json(base+'gameplay.json');
    const ambient=await json('/assets/cinematics/amb1/runtime.json');
    if(!new URLSearchParams(location.search).has('combat-test')&&!new URLSearchParams(location.search).has('interactions-test'))gameplay.encounters.find(e=>e.id==='L1_E1_Combat2').presentation=ambient;
    ambientAudio=new Audio(ambient.audio);ambientAudio.volume=settings.muted?0:settings.effects;ambientAudio.preload='auto';root.append(ambientAudio);
    progress = new EpisodeProgress(gameplay);follow=new FollowCamera(camera);
    const collision = await json(base + 'source-collision.json');
    const collisionBytes = await (await fetch(base + 'source-collision.bin')).arrayBuffer();
    await RAPIER.init(); if (stopped) return;
    world = new RAPIER.World({x:0,y:-24,z:0});
    for (const region of collision.regions) for (const room of region.rooms) {
      const vertices = new Float32Array(collisionBytes,room.vertices.byteOffset,room.vertices.count);
      const indices = new Uint32Array(collisionBytes,room.indices.byteOffset,room.indices.count);
      const staticCollider = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices)); collisionRegions.set(staticCollider.handle,region.name);
    }
    body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(57.412,45.556,52.091));
    collider = world.createCollider(RAPIER.ColliderDesc.capsule(.55,.4),body);
    controller = world.createCharacterController(.03); controller.enableAutostep(.35,.2,true); controller.enableSnapToGround(.4);
    function staticRegion(gltf) {
      gltf.scene.updateMatrixWorld(true); const batches = new Map();
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        let parent = o; while (parent) { if (parent.userData.collisionMaterial) return; parent = parent.parent; }
        const material = o.material; if (Array.isArray(material)) return;
        const key = material.uuid + ':' + Object.keys(o.geometry.attributes).sort().join(',');
        if (!batches.has(key)) batches.set(key,{material,geometries:[]});
        batches.get(key).geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); o.visible = false;
      });
      for (const {material,geometries} of batches.values()) {
        const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
        if (geometry) gltf.scene.add(new THREE.Mesh(geometry,material));
      }
      return add(gltf);
    }
    await Promise.all([...Array.from({length:7},(_,i)=>`r${i+1}`),'mojo'].map(name=>loader.loadAsync(base+`${name}.gltf`).then(g=>{g.scene.name=name==='mojo'?'regionmojo':`region${name.slice(1)}`;regionObjects.set(name,g.scene);return staticRegion(g);})));
    selectRegion('r1');
    const sky = add(await loader.loadAsync(base+'skybox.gltf')); sky.scene.name = 'skybox';
    sky.scene.traverse(o => { if(o.isMesh) { o.material.depthWrite = false; o.renderOrder = -100; } });
    const player = add(await loader.loadAsync('/assets/characters/crash/crash.glb')); if (stopped) return;
    crash = player.scene; crash.visible = false; playerAnimation=new PlayerAnimation(crash,player.animations);
    const enemySource=add(await loader.loadAsync('/assets/characters/chiratta/chiratta.glb'));if(stopped)return;enemySource.scene.visible=false;
    enemies=new EnemyActors(scene,world,enemySource);combat=new Combat(gameplay,{...Object.fromEntries(player.animations.map(c=>[c.name,c.duration])),enemyAttack:enemySource.animations.find(c=>c.name==='PTRN_chiratta_attack_light')?.duration});
    const propData=await json('/assets/props/episode-one.json'),propSources=new Map(),pickupSources=new Map();
    const propUrls=[...new Set(Object.values(propData.definitions).flatMap(d=>d.states.map(s=>s.model).filter(Boolean)))];
    await Promise.all(propUrls.map(async url=>{const source=add(await loader.loadAsync(url));if(!source)return;source.scene.visible=false;propSources.set(url,source);}));
    if(stopped)return;
    breakables=new Breakables(propData);props=new PropActors(scene,propSources,propData,world,RAPIER);
    pickups=new Pickups(propData);
    await Promise.all(Object.entries(pickups.types).map(async ([type,definition])=>{try{const source=add(await loader.loadAsync(definition.model));if(!source)return;source.scene.visible=false;pickupSources.set(type,source);}catch(e){console.warn('Pickup model load failed:',definition.model,e);}}));
    pickupActors=new PickupActors(scene,pickupSources);
    // Source shadow actors are projection inputs, not opaque scene geometry.
    // Keep them out until the original projected-shadow pass is implemented.
    await Promise.all(runtime.actors.filter(a => a.url && !a.name.endsWith('_shadow')).map(async actor => {
      const gltf = add(await loader.loadAsync(actor.url)); if (!gltf) return;
      gltf.scene.position.set(-66.5162964,-2.566556,-39.922077); actors.push(gltf.scene);
      if (actor.name === 'crash') cinematicCrash = gltf.scene;
      const m = new THREE.AnimationMixer(gltf.scene); for (const clip of gltf.animations) m.clipAction(clip).setLoop(THREE.LoopOnce,1).play().clampWhenFinished = true; mixers.push(m);
    }));
    if (stopped) return;
    if (new URLSearchParams(location.search).has('inspect')) root.inspection = { scene, camera, renderer, mixers, actors,
      get progress(){return {checkpoint:progress.recovery(),completed:[...progress.completed],position:body.translation(),yaw:crash.rotation.y,grounded:controller.computedGrounded(),velocity,jumpPhase,activeClip,jumpCount,recoveryCount,paused};},
      teleport(position){body.setTranslation(position,true);velocity=0;accumulator=0;},
      get breakables(){return {placements:breakables.placements,broken:[...breakables.broken],states:Object.fromEntries([...breakables.states].map(([id,r])=>[id,{...r,name:breakables.state(id).name}]))};},
      get pickups(){return {total:pickups.total,items:[...pickups.items.values()].map(p=>({...p,position:[...p.position]})),colliders:props.colliderCount};},
      get audio(){return {state:effects.context?.state,buffers:effects.buffers.size,active:effects.sources.size,played:effects.playCount};},
      get combat(){return {presentation:combat.presentation?{id:combat.presentation.id,age:combat.presentation.age,duration:combat.presentation.duration}:null,health:combat.player.health,maxHealth:combatTuning.playerHealth,enemies:combat.enemies.map(e=>({...e})),cleared:[...combat.cleared],attack:combat.attack?.clip,animation:combat.animation};},
    };
    dialogue = new Audio(runtime.audioSource); dialogue.volume = settings.muted ? 0 : settings.effects; dialogue.preload = 'auto'; root.append(dialogue);
    status.textContent = 'Cena original pronta';
    const testParams=new URLSearchParams(location.search),combatTest=testParams.get('combat-test')==='1',interactionsTest=testParams.get('interactions-test')==='1';
    function testPosition(prop){
      const foot=[...prop.position];foot[2]+=1.65;body.setTranslation({x:foot[0],y:foot[1]+.95,z:foot[2]},true);crash.rotation.y=Math.PI;velocity=0;accumulator=0;follow.reset();progress.setEntry(foot,Math.PI);combat.markCheckpoint();breakables.markCheckpoint();pickups.markCheckpoint();
    }
    const begin = action(interactionsTest?'Iniciar teste de interações':combatTest?'Iniciar teste de combate':'Iniciar cena', async () => { try {
      await effects.unlock();
      if(interactionsTest){
        enterPlay();testPosition(propData.placements.find(p=>p.id==='Potted4'));
        action('Testar caixas',()=>{if(paused)pauseButton.click();testPosition(propData.placements.find(p=>p.kind==='crate-mh'));notice('Sala bônus • J: ataque • as caixas de metal recebem cinco golpes',6);});
        notice('J: quebrar • aproxime-se para recolher mojo • Esc: pausar',8);begin.remove();return;
      }
      if(combatTest){
        enterPlay();const foot=[...gameplay.locators.L1_E1EnemyLocator3.position];foot[2]+=1.7;
        body.setTranslation({x:foot[0],y:foot[1]+.95,z:foot[2]},true);crash.rotation.y=Math.PI;progress.setEntry(foot,Math.PI);
        notice('Teste de combate • J: ataque leve • WASD: mover • Esc: pausar',8);begin.remove();return;
      }
      await dialogue.play(); phase = 'cinematic'; begin.remove(); status.hidden = true; skip.hidden = false;
    } catch(e) { showError(e); } });
    let last = performance.now();
    function tick(now) {
      if (stopped) return; frameId = requestAnimationFrame(tick); const dt = Math.min((now-last)/1000,.1); last = now;
      if (phase === 'cinematic') {
        const t = dialogue.currentTime; mixers.forEach(m => m.setTime(t));
        const tracks = runtime.camera.tracks, defaults = runtime.camera.defaults;
        camera.position.copy(vector(sampleTrack(tracks.TRAN,t*30,defaults.position)));
        camera.position.add(new THREE.Vector3(-66.5162964,-2.566556,-39.922077));
        camera.up.copy(vector(sampleTrack(tracks.UP,t*30,defaults.up))).normalize();
        camera.lookAt(camera.position.clone().add(vector(sampleTrack(tracks.LOOK,t*30,defaults.look))));
        camera.fov = THREE.MathUtils.radToDeg(defaults.fovRadians); camera.updateProjectionMatrix();
        if (dialogue.ended || t >= runtime.durationSeconds) enterPlay();
      } else if (phase === 'play' && !paused) {
        gameplayTime+=dt;if(gameplayTime>noticeUntil)status.hidden=true;
        accumulator = Math.min(accumulator+dt,.1);
        const pad=[...(navigator.getGamepads?.()||[])].find(p=>p&&p.mapping==='standard');
        const padAttack=!!pad?.buttons[2]?.pressed;if(padAttack&&!padAttackDown)combat.requestAttack();padAttackDown=padAttack;
        const deadzone=value=>Math.abs(value||0)>.2?value:0;
        const x = Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+deadzone(pad?.axes[0]);
        const z = Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+deadzone(pad?.axes[1]);
        const direction = new THREE.Vector3(x,0,z);if(direction.length()>1)direction.normalize();
        if(spaceHeld||pad?.buttons[0]?.pressed)jumpInput.press();else jumpInput.release();
        while (accumulator >= 1/60) {
          const grounded=controller.computedGrounded()&&velocity<=0;
          const pp=body.translation();
          breakables.update(1/60);
          const events=combat.step(1/60,{position:[pp.x,pp.y-.95,pp.z],yaw:crash.rotation.y,grounded,presentationTime:combat.presentation?(ambientAudio.ended?combat.presentation.duration:ambientAudio.currentTime):undefined});
          events.push(...breakables.step(combat.propAttack,{position:[pp.x,pp.y-.95,pp.z],yaw:crash.rotation.y}));
          for(const event of events)pickups.spawn(event);
          events.push(...pickups.step(1/60,[pp.x,pp.y-.95,pp.z]));props.sync(breakables);
          for(const event of events){if(event.type==='healthCollected')combat.healPlayer(event.value);if(event.type==='presentationStarted'){ambientAudio.currentTime=0;ambientAudio.play().catch(showError);notice('Conversa dos Chirattas',combat.presentation.duration);}if(event.type==='presentationEnded'){ambientAudio.pause();notice('Derrote os Chirattas • J: ataque leve',5);}gameplayHud.event(event,gameplayTime);effects.event(event);if(event.type==='spawn')notice('Derrote os Chirattas • J: ataque leve',5);if(event.type==='cleared')notice('Encontro vencido',4);if(event.type==='propBlocked')notice('Este objeto exige mais força',2);}
          const jump=combat.busy?(jumpInput.cancelPending(),null):jumpInput.consume(grounded);
          if(jump){velocity=9;jumpPhase=jump;jumpAge=0;jumpCount++;animate(jump==='air'?'jump_air':'jump_single',true);}
          jumpAge+=1/60;
          velocity -= 24/60; const speed=combat.busy?0:controller.computedGrounded()?8:7.8;controller.computeColliderMovement(collider,{x:direction.x*speed/60,y:velocity/60,z:direction.z*speed/60});
          const p = body.translation(), d = controller.computedMovement(); body.setNextKinematicTranslation({x:p.x+d.x,y:p.y+d.y,z:p.z+d.z});enemies.beforeStep(combat.enemies,1/60);world.step();enemies.afterStep(combat.enemies);
          if (controller.computedGrounded() && velocity<0) velocity = 0; accumulator -= 1/60;
        }
        let p = body.translation();
        const checkpointY=progress.checkpoint?.position[1]??0;
        if(p.y<checkpointY-30||combat.needsRecovery){recover();p=body.translation();}
        const support = world.castRay(new RAPIER.Ray({x:p.x,y:p.y+.1,z:p.z},{x:0,y:-1,z:0}),10,true,undefined,undefined,collider);
        const room = support && collisionRegions.get(support.collider.handle); if (room && room !== activeRegion) selectRegion(room);
        const reached=progress.visit([p.x,p.y,p.z]);if(reached.length){combat.markCheckpoint();breakables.markCheckpoint();pickups.markCheckpoint();notice('Checkpoint alcançado',3);}
        crash.position.set(p.x,p.y-.95,p.z); if (direction.lengthSq()&&!combat.busy) crash.rotation.y = Math.atan2(direction.x,direction.z);
        if(combat.animation)animate(combat.animation,true);
        else if(controller.computedGrounded()&&velocity<=0)animate(direction.lengthSq()>.01?'run':'idle');
        else {const falling=fallingAnimation(jumpPhase,jumpAge,velocity);if(falling)animate(falling);}
        playerAnimation.update(dt);
        enemies.render(combat.enemies,dt);updateHud();
        camera.fov = 65; camera.updateProjectionMatrix();follow.update(crash.position,dt,occluders);
      }
      sky.scene.position.copy(camera.position); props?.render(breakables,phase==='play',camera);pickupActors?.render(pickups,phase==='play',camera,gameplayTime);renderer.render(scene,camera);
      root.dataset.phase = phase;
    }
    frameId = requestAnimationFrame(tick);
  } catch(e) { showError(e); console.error(e); }
  return {stop};
}
