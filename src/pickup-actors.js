import * as THREE from 'three';

// Each original mojo mesh is shared by all of its instances, including drops.
export class PickupActors {
 constructor(scene,sources,capacity=1024){
  this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.meshes=new Map();this.dummy=new THREE.Object3D();this.capacity=capacity;
  for(const [type,source] of sources){
   const meshes=[];source.scene.updateMatrixWorld(true);
   source.scene.traverse(node=>{
    if(!node.isMesh)return;
    const mesh=new THREE.InstancedMesh(node.geometry,node.material,capacity);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;this.group.add(mesh);meshes.push(mesh);
   });
   this.meshes.set(type,meshes);
  }
 }
 render(state,playing,camera,time){
  this.group.visible=playing;if(!playing)return;
  const counts=new Map([...this.meshes.keys()].map(type=>[type,0]));
  for(const item of state.items.values()){
   if(item.collected)continue;
   const [x,y,z]=item.position;if(Math.hypot(x-camera.position.x,z-camera.position.z)>100)continue;
   const index=counts.get(item.type);if(index===undefined||index>=this.capacity)continue;
   this.dummy.position.set(x,y+Math.sin(time*3+x)*.08,z);this.dummy.rotation.set(0,time*1.3,0);this.dummy.scale.fromArray(item.scale);this.dummy.updateMatrix();
   for(const mesh of this.meshes.get(item.type))mesh.setMatrixAt(index,this.dummy.matrix);counts.set(item.type,index+1);
  }
  for(const [type,meshes] of this.meshes)for(const mesh of meshes){mesh.count=counts.get(type);mesh.instanceMatrix.needsUpdate=true;}
 }
 clear(){this.group.removeFromParent();for(const meshes of this.meshes.values())for(const mesh of meshes)mesh.dispose();this.meshes.clear();}
}
