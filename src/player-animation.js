import * as THREE from 'three';

/** Gameplay-only pose transitions; cinematic mixers retain source timing. */
export class PlayerAnimation {
  constructor(object,clips,blendSeconds=.12){
    this.mixer=new THREE.AnimationMixer(object);this.clips=new Map(clips.map(c=>[c.name,c]));
    this.blendSeconds=blendSeconds;this.current=null;this.currentName=null;
  }
  play(name,once=false){
    if(name===this.currentName||!this.clips.has(name))return false;
    const next=this.mixer.clipAction(this.clips.get(name)).reset();
    next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
    next.clampWhenFinished=once;next.setEffectiveTimeScale(1);next.setEffectiveWeight(1);next.play();
    if(this.current){this.current.fadeOut(this.blendSeconds);next.fadeIn(this.blendSeconds);}
    this.current=next;this.currentName=name;return true;
  }
  update(dt){this.mixer.update(dt);}
}

export function fallingAnimation(kind,age,velocity){
  if(age<.3||velocity>0)return null;
  return kind==='air'?'jump_air_fall':'jump_single_fall_cycle';
}
