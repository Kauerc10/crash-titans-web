// Original mojo models/values/counts; attraction/scatter are native approximations.
export class Pickups {
 constructor(data){
  this.types=data.pickupTypes;this.total=0;this.items=new Map();
  for(const p of data.pickups)this.items.set(p.id,{...p,position:[...p.position],scale:p.scale||[1,1,1],collected:false,age:0,delay:0});
  this.markCheckpoint();
 }
 markCheckpoint(){this.saved={total:this.total,items:structuredClone(this.items)};}
 resetToCheckpoint(){this.total=this.saved.total;this.items=structuredClone(this.saved.items);}
 spawn(event){
  if(event.type!=='propBroken'||!event.drops)return;
  let index=0;const count=event.drops.reduce((sum,drop)=>sum+drop.count,0);
  for(const drop of event.drops)for(let n=0;n<drop.count;n++){
   const id=`drop:${event.id}:${index}`,angle=index++*Math.PI*2/Math.max(1,count);
   if(this.items.has(id)||!this.types[drop.type])continue;
   this.items.set(id,{id,type:drop.type,position:[event.position[0]+Math.cos(angle)*.55,event.position[1]+.45,event.position[2]+Math.sin(angle)*.55],scale:[1,1,1],collected:false,age:0,delay:.22});
  }
 }
 step(dt,feet){
  const events=[];
  for(const item of this.items.values()){
   if(item.collected)continue;item.age+=dt;if(item.age<item.delay)continue;
   const dx=feet[0]-item.position[0],dz=feet[2]-item.position[2];let d=Math.hypot(dx,dz),height=Math.abs(item.position[1]-feet[1]);
   if(d<=3.4&&height<=2){
    const fraction=Math.min(1,dt*8/Math.max(d,.001));item.position[0]+=dx*fraction;item.position[2]+=dz*fraction;
    item.position[1]+=(feet[1]+.5-item.position[1])*Math.min(1,dt*8);d=Math.hypot(feet[0]-item.position[0],feet[2]-item.position[2]);height=Math.abs(item.position[1]-feet[1]);
   }
   if(d<=1.1&&height<=1.6){item.collected=true;const value=this.types[item.type].value;this.total+=value;events.push({type:'mojoCollected',id:item.id,value,total:this.total});}
  }
  return events;
 }
}
