import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import RAPIER from '../node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
import { PlayerAnimation } from './player-animation.js';

export class EnemyActors {
 constructor(scene,world,source){this.scene=scene;this.world=world;this.source=source;this.views=new Map();const box=new THREE.Box3().setFromObject(source.scene);this.height=Math.max(.8,box.max.y-box.min.y);}
 clear(){for(const v of this.views.values()){this.scene.remove(v.object);if(v.body)this.world.removeRigidBody(v.body);this.world.removeCharacterController(v.controller);}this.views.clear();}
 beforeStep(enemies,dt){
  const ids=new Set(enemies.map(e=>e.id));
  for(const[id,v]of this.views)if(!ids.has(id)){this.scene.remove(v.object);if(v.body)this.world.removeRigidBody(v.body);this.world.removeCharacterController(v.controller);this.views.delete(id);}
  for(const e of enemies){
   if(!this.views.has(e.id)){
    const object=clone(this.source.scene);object.visible=true;object.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});this.scene.add(object);
    const center=this.height/2,body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(e.position[0],e.position[1]+center,e.position[2]));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(.1,center-.25),.25),body),controller=this.world.createCharacterController(.03);controller.enableAutostep(.3,.2,true);controller.enableSnapToGround(.3);
    this.views.set(e.id,{object,body,collider,controller,center,velocity:0,animation:new PlayerAnimation(object,this.source.animations,.08)});
   }
   const v=this.views.get(e.id);
   if(e.health<=0){if(v.body){this.world.removeRigidBody(v.body);v.body=null;}continue;}
   v.velocity-=24*dt;v.controller.computeColliderMovement(v.collider,{x:e.motion[0]*dt,y:v.velocity*dt,z:e.motion[1]*dt});
   const p=v.body.translation(),d=v.controller.computedMovement();v.body.setNextKinematicTranslation({x:p.x+d.x,y:p.y+d.y,z:p.z+d.z});if(v.controller.computedGrounded()&&v.velocity<0)v.velocity=0;
  }
 }
 afterStep(enemies){for(const e of enemies){const v=this.views.get(e.id);if(v?.body){const p=v.body.translation();e.position=[p.x,p.y-v.center,p.z];}}}
 render(enemies,dt){
  for(const e of enemies){
   const v=this.views.get(e.id);if(!v)continue;
   v.object.position.fromArray(e.position);v.object.rotation.y=e.yaw;
   if(e.health<=0){
    v.object.visible=e.age<1.8;
    const fade=e.age>1.5?Math.max(0,(1.8-e.age)/.3):1;
    v.object.traverse(o=>{if(o.isMesh&&o.material){for(const m of [].concat(o.material)){m.transparent=fade<1;m.opacity=fade;}}});
   }else{
    v.object.visible=true;
   }
   v.animation.play(`PTRN_chiratta_${e.animation}`,['attack','hit','dead'].includes(e.state));v.animation.update(dt);
  }
 }
}
