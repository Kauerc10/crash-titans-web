import * as THREE from 'three';

// Bounded particle pool for hit sparks, defeat flash and pickup bursts.
// Pre-allocated capacity guarantees zero heap allocations during gameplay.
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

  const geom = new THREE.PlaneGeometry(0.35, 0.35);
  const mat = new THREE.MeshBasicMaterial({
   color: 0xfff0aa,
   transparent: true,
   opacity: 0.9,
   depthWrite: false,
   blending: THREE.AdditiveBlending,
   side: THREE.DoubleSide
  });
  this.mesh = new THREE.InstancedMesh(geom, mat, capacity);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.mesh.count = 0;
  this.mesh.frustumCulled = false;
  this.group.add(this.mesh);

  this.dummy = new THREE.Object3D();
 }

 spawnBurst(x, y, z, count = 5, speed = 3.0, duration = 0.35, color = [1, 0.9, 0.5]) {
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
   p.color = color;
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
   this.spawnBurst(pos[0], pos[1] + 0.5, pos[2], 10, 3.5, 0.5, [0.4, 0.8, 1]);
  } else if (['mojoCollected', 'healthCollected', 'freeJackCollected'].includes(event.type)) {
   const pos = event.position || defaultPos;
   const color = event.type === 'healthCollected' ? [1, 0.4, 0.2] : event.type === 'freeJackCollected' ? [1, 0.9, 0.2] : [0.4, 0.8, 1];
   this.spawnBurst(pos[0], pos[1] + 0.3, pos[2], 4, 1.8, 0.3, color);
  }
 }

 update(dt, camera) {
  let active = 0;
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

   this.mesh.setMatrixAt(active, this.dummy.matrix);
   active++;
  }
  this.mesh.count = active;
  this.mesh.instanceMatrix.needsUpdate = true;
 }

 clear() {
  for (const p of this.particles) p.active = false;
  this.mesh.count = 0;
  this.mesh.instanceMatrix.needsUpdate = true;
 }

 dispose() {
  this.clear();
  this.group.removeFromParent();
  this.mesh.geometry.dispose();
  this.mesh.material.dispose();
 }
}
