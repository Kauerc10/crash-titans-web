import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export class PropActors {
 constructor(scene,sources,data,world,RAPIER){
  this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.objects=new Map();this.world=world;this.colliderCount=0;
  const mirror=new THREE.Matrix4().makeScale(1,1,-1);
  for(const prop of data.placements){
   const definition=data.definitions[prop.kind],object=new THREE.Group(),variants=new Map();
   // Conjugate the original Euler rotation by the Z coordinate reflection.
   const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...prop.rotation,'XYZ'));
   object.quaternion.setFromRotationMatrix(mirror.clone().multiply(rotation).multiply(mirror));
   object.position.fromArray(prop.position);object.scale.fromArray(prop.scale);this.group.add(object);
   for(const url of new Set(definition.states.map(s=>s.model).filter(Boolean))){
    const source=sources.get(url),model=clone(source.scene);model.visible=false;object.add(model);
    const mixer=new THREE.AnimationMixer(model);for(const clip of source.animations)mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play().clampWhenFinished=true;
    variants.set(url,{model,mixer});
   }
   let collider;
   if(['plant-pot','mailbox','crate-mh','crate-large'].includes(prop.kind)&&definition.collisionBoxes.length){
    const [lo,hi]=definition.collisionBoxes[0];
    const center=new THREE.Vector3((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,-(lo[2]+hi[2])/2).multiply(object.scale).applyQuaternion(object.quaternion).add(object.position);
    const half=hi.map((v,i)=>Math.abs((v-lo[i])*prop.scale[i])/2);
    collider=world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(center.x,center.y,center.z).setRotation(object.quaternion));this.colliderCount++;
   }
   this.objects.set(prop.id,{object,variants,collider});
  }
 }
 sync(state){for(const [id,entry] of this.objects)if(entry.collider)entry.collider.setEnabled(!state.broken.has(id));}
 render(state,playing,camera){
  this.group.visible=playing;if(!playing)return;
  for(const [id,entry] of this.objects){
   const current=state.state(id),record=state.states.get(id);entry.object.visible=entry.object.position.distanceToSquared(camera.position)<160*160;
   if(!entry.object.visible)continue;
   for(const [url,variant] of entry.variants){
    variant.model.visible=url===current.model;if(!variant.model.visible)continue;
    const controller=current.controllers[0];if(!controller)continue;
    const length=Math.max(0,controller.end-controller.start),frames=record.age*controller.fps*controller.speed;
    const frame=controller.enabled?controller.start+(current.auto?Math.min(length,frames):length?frames%length:0):controller.start;
    variant.mixer.setTime(frame/controller.fps);
   }
  }
 }
 clear(){this.group.removeFromParent();for(const entry of this.objects.values())if(entry.collider)this.world.removeCollider(entry.collider,true);this.objects.clear();}
}
