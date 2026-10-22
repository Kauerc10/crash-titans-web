import * as THREE from 'three';

// Bounded particle pool for hit sparks, defeat flash and pickup bursts.
// Native billboard simulation; recovered textures do not reproduce Pure3D emitters.
export class GameplayEffects {
 constructor(scene, capacity = 128) {
  this.scene = scene;
  this.capacity = capacity;
  this.particles = Array.from({ length: capacity }, () => ({
   active: false,
   x: 0, y: 0, z: 0,
   vx: 0, vy: 0, vz: 0,
   age: 0,
   duration: 0.35,
   scale: 1,
   color: [1, 1, 1]
  }));

  this.group = new THREE.Group();
  if (scene) scene.add(this.group);

  this.disposed = false;
  this.batches = ['impact/star03.webp', 'death/flash09.webp'].map(path => {
   const geom = new THREE.PlaneGeometry(0.35, 0.35);
   geom.setAttribute('particleOpacity', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
   const mat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, depthWrite:false,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide});
   mat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float particleOpacity; varying float vParticleOpacity;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvParticleOpacity = particleOpacity;');
    shader.fragmentShader = 'varying float vParticleOpacity;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= vParticleOpacity;\n#include <opaque_fragment>');
   };
   const mesh = new THREE.InstancedMesh(geom, mat, capacity);
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   mesh.count=0; mesh.frustumCulled=false; mesh.visible=false;
   mesh.userData.texturePath=path;
   this.group.add(mesh); return mesh;
  });
  this.mesh=this.batches[0];
  this.color=new THREE.Color();

  this.dummy = new THREE.Object3D();
 }

 async loadTextures(load = url => new THREE.TextureLoader().loadAsync(url)) {
  await Promise.all(this.batches.map(async mesh => {
   const texture=await load('/assets/effects/'+mesh.userData.texturePath);
   if(this.disposed){texture.dispose();return;}
   texture.colorSpace=THREE.SRGBColorSpace;
   mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.visible=true;
  }));
 }

 spawnBurst(x, y, z, count = 5, speed = 3.0, duration = 0.35, color = [1, 0.9, 0.5], kind=0) {
  for (let i = 0; i < count; i++) {
   const p = this.particles.find(pt => !pt.active) || this.particles[i % this.capacity];
   p.active = true;
   p.x = x; p.y = y; p.z = z;
   const angle = Math.random() * Math.PI * 2;
   const elevation = (Math.random() - 0.2) * Math.PI;
   const s = speed * (0.6 + Math.random() * 0.8);
   p.vx = Math.cos(angle) * Math.cos(elevation) * s;
   p.vy = Math.sin(elevation) * s + 0.8;
   p.vz = Math.sin(angle) * Math.cos(elevation) * s;
   p.age = 0;
   p.duration = duration * (0.8 + Math.random() * 0.4);
   p.scale = 0.8 + Math.random() * 0.5;
   p.color = color; p.kind=kind;
  }
 }

 event(event, defaultPos = [0, 0, 0]) {
  if (event.type === 'enemyHit') {
   const pos = event.position || defaultPos;
   this.spawnBurst(pos[0], pos[1] + 0.7, pos[2], event.killed ? 12 : 5, event.killed ? 4.5 : 2.5, 0.35, [1, 0.8, 0.3]);
  } else if (event.type === 'playerHit') {
   const pos = event.position || defaultPos;
   this.spawnBurst(pos[0], pos[1] + 0.9, pos[2], 6, 2.5, 0.4, [1, 0.3, 0.2]);
  } else if (event.type === 'enemyReward' || event.type === 'enemyDeathDone') {
   const pos = event.position || defaultPos;
   this.spawnBurst(pos[0], pos[1] + 0.5, pos[2], 10, 3.5, 0.5, [0.4, 0.8, 1], 1);
  } else if (['mojoCollected', 'healthCollected', 'freeJackCollected'].includes(event.type)) {
   const pos = event.position || defaultPos;
   const color = event.type === 'healthCollected' ? [1, 0.4, 0.2] : event.type === 'freeJackCollected' ? [1, 0.9, 0.2] : [0.4, 0.8, 1];
   this.spawnBurst(pos[0], pos[1] + 0.3, pos[2], 4, 1.8, 0.3, color);
  }
 }

 update(dt, camera) {
  for(const mesh of this.batches) mesh.count=0;
  for (const p of this.particles) {
   if (!p.active) continue;
   p.age += dt;
   if (p.age >= p.duration) {
    p.active = false;
    continue;
   }
   p.x += p.vx * dt;
   p.y += p.vy * dt;
   p.z += p.vz * dt;
   p.vy -= 4.0 * dt;

   const life = 1 - (p.age / p.duration);
   this.dummy.position.set(p.x, p.y, p.z);
   if (camera) this.dummy.quaternion.copy(camera.quaternion);
   const s = p.scale * life;
   this.dummy.scale.set(s, s, s);
   this.dummy.updateMatrix();

   const mesh=this.batches[p.kind||0], index=mesh.count++;
   mesh.setMatrixAt(index, this.dummy.matrix);
   mesh.setColorAt(index,this.color.setRGB(...p.color));
   mesh.geometry.getAttribute('particleOpacity').setX(index,life*.9);
  }
  for(const mesh of this.batches){
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   mesh.geometry.getAttribute('particleOpacity').needsUpdate=true;
  }
 }

 clear() {
  for (const p of this.particles) p.active = false;
  for(const mesh of this.batches){mesh.count=0;mesh.instanceMatrix.needsUpdate=true;}
 }

 dispose() {
  this.clear();
  this.group.removeFromParent();
  this.disposed=true;
  for(const mesh of this.batches){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
 }
}
