import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FollowCamera } from '../src/follow-camera.js';
test('camera shortens against an obstacle immediately, then recovers smoothly',()=>{
  const camera=new THREE.PerspectiveCamera(),follow=new FollowCamera(camera);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  wall.position.set(0,4,6);wall.updateMatrixWorld(true);
  const p={x:0,y:0,z:0};const full=follow.update(p,1/60,[]);
  const blocked=follow.update(p,1/60,[wall]);
  assert.ok(blocked<full/1.5);assert.ok(camera.position.z<6);
  const recovering=follow.update(p,1/60,[]);
  assert.ok(recovering>blocked&&recovering<full);
  follow.reset();assert.equal(follow.update(p,1/60,[]),full);
  wall.geometry.dispose();wall.material.dispose();
});
