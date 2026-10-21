// Source state transitions/visibility; native reach and light-hit strength remain approximate.
export class Breakables {
 constructor(data){
  this.placements=Array.isArray(data)?data:data.placements;this.definitions=data.definitions||{};
  this.broken=new Set();this.saved=new Set();this.states=new Map(this.placements.map(p=>[p.id,{index:0,age:0}]));this.savedStates=this.copyStates();this.swingHits=new WeakMap();
 }
 copyStates(){return new Map([...this.states].map(([id,state])=>[id,{...state}]));}
 markCheckpoint(){this.saved=new Set(this.broken);this.savedStates=this.copyStates();}
 resetToCheckpoint(){this.broken=new Set(this.saved);this.states=new Map([...this.savedStates].map(([id,s])=>[id,{...s}]));this.swingHits=new WeakMap();}
 state(id){const prop=this.placements.find(p=>p.id===id);return this.definitions[prop?.kind]?.states[this.states.get(id)?.index||0];}
 update(dt){
  for(const prop of this.placements){
   const record=this.states.get(prop.id),definition=this.definitions[prop.kind];if(!definition)continue;record.age+=dt;
   const current=definition.states[record.index];
   if(current.auto&&record.age>=current.duration){record.index=current.next;record.age=0;}
  }
 }
 step(attack,player){
  const events=[];if(!attack||attack.age<(attack.start??attack.duration*.3)-1e-6||attack.age>(attack.end??attack.duration*.85)+1e-6)return events;
  let hit=this.swingHits.get(attack);if(!hit){hit=new Set();this.swingHits.set(attack,hit);}
  for(const prop of this.placements){
   if(this.broken.has(prop.id)||hit.has(prop.id))continue;
   const dx=prop.position[0]-player.position[0],dz=prop.position[2]-player.position[2],d=Math.hypot(dx,dz),radius=prop.kind==='crate-large'?1.5:0;
   if(d>2.15+radius||Math.abs(prop.position[1]-player.position[1])>1.4)continue;
   if(d>.01&&(dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))/d<=.15)continue;
   hit.add(prop.id);
   const definition=this.definitions[prop.kind];
   if(!definition){this.broken.add(prop.id);events.push({type:'propBroken',id:prop.id});continue;}
   const record=this.states.get(prop.id),current=definition.states[record.index];
   const blocked=(attack.strength??1)<Number(current.attributes.strength_to_hit||0);
   const destroy=current.events.DESTROY!==undefined&&(attack.strength??1)>=Number(current.attributes.strength_to_destroy||Infinity);
   const next=current.events[blocked?'BLOCK':destroy?'DESTROY':'BREAK'];
   if(next!==undefined){record.index=next;record.age=0;}
   if(blocked){events.push({type:'propBlocked',id:prop.id,kind:prop.kind,position:[...prop.position],sound:definition.sound});continue;}
   if(next===undefined)continue;
   const target=definition.states[next],final=target.name==='broken'||target.auto&&definition.states[target.next]?.name==='broken';
   if(final)this.broken.add(prop.id);
   events.push({type:final?'propBroken':'propHit',id:prop.id,kind:prop.kind,position:[...prop.position],sound:definition.sound,drops:final?definition.drops:[]});
  }
  return events;
 }
}
