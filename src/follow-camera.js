import * as THREE from 'three';

/** Follow boom adapter. Collision response is native-web, not the PS2 solver. */
export class FollowCamera {
  constructor(camera) { this.camera=camera;this.ray=new THREE.Raycaster();this.ready=false;this.distance=0; }
  reset(){this.ready=false;}
  update(position,dt,occluders){
    const target=new THREE.Vector3(position.x,position.y+1,position.z);
    const offset=new THREE.Vector3(0,5,12),length=offset.length();
    this.ray.set(target,offset.clone().normalize());this.ray.far=length;
    const hit=this.ray.intersectObjects(occluders,false)[0];
    const allowed=hit ? Math.max(.6,hit.distance-.35) : length;
    if(!this.ready||allowed<this.distance)this.distance=allowed;
    else this.distance+=(allowed-this.distance)*(1-Math.exp(-6*dt));
    this.camera.position.copy(target).addScaledVector(offset,this.distance/length);
    this.camera.up.set(0,1,0);this.camera.lookAt(target);this.ready=true;
    return this.distance;
  }
}
