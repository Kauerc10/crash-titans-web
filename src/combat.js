import { containsVolume } from './episode.js';
import { combatRules } from './combat-rules.js';

// Base health, strike damage/strength and contact windows are recovered source data.
// Reach, pursuit, stagger, input grace and invulnerability are native tuning.
export const combatTuning=Object.freeze({playerHealth:combatRules.player.maxHealth,enemyHealth:combatRules.enemy.maxHealth,damage:combatRules.attacks.attack_lite_A[0].damage,enemyDamage:combatRules.attacks.attack_light[0].damage,reach:2.15,enemyReach:1.65,enemySpeed:3.2,invulnerability:.8,enemyHitStagger:.45,enemyDeathDuration:1.8});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export class Combat {
 constructor(data,durations={}){this.data=data;this.durations=durations;this.cleared=new Set();this.savedCleared=new Set();this.generation=0;this.resetToCheckpoint();}
 resetToCheckpoint(){this.cleared=new Set(this.savedCleared);this.enemies=[];this.encounter=null;this.presentation=null;this.attack=null;this.queued=false;this.combo=-1;this.sinceAttack=10;this.needsRecovery=false;this.player={health:combatTuning.playerHealth,invulnerable:0,hitTime:0,deathTime:0};this.events=[];this.generation++;}
 markCheckpoint(){this.savedCleared=new Set(this.cleared);}
 requestAttack(){if(!this.presentation&&this.player.health>0&&this.player.hitTime<=0)this.queued=true;}
 damagePlayer(amount){
  if(this.player.health<=0||this.player.invulnerable>0)return false;
  this.player.health=Math.max(0,this.player.health-amount);this.player.invulnerable=combatTuning.invulnerability;this.player.hitTime=.35;this.attack=null;this.queued=false;
  this.events.push({type:this.player.health===0?'playerDead':'playerHit'});return true;
 }
 get busy(){return !!this.presentation||this.player.health<=0||this.player.hitTime>0||!!this.attack;}
 get propAttack(){const strike=this.attack?.activeStrike;if(!strike)return null;strike.age=this.attack.age;return strike;}
 get animation(){return this.player.health<=0?'death':this.player.hitTime>0?'impact_light':this.attack?.clip||null;}
 step(dt,player){
  const events=this.events.splice(0);this.sinceAttack+=dt;this.player.invulnerable=Math.max(0,this.player.invulnerable-dt);this.player.hitTime=Math.max(0,this.player.hitTime-dt);
  if(this.player.health<=0){this.player.deathTime+=dt;this.needsRecovery=this.player.deathTime>=(this.durations.death||2);for(const e of this.enemies)e.motion=[0,0];return events;}
  if(!this.encounter){
   const source=this.data.encounters.find(e=>e.id==='L1_E1_Combat2'&&!this.cleared.has(e.id)&&containsVolume(this.data.volumes[e.trigger],player.position));
   if(source){this.encounter=source.id;this.enemies=source.spawns.map((s,i)=>({id:`${this.generation}:${source.id}:${i}`,sourceName:s.name,position:[...this.data.locators[s.locator].position],yaw:this.data.locators[s.locator].yaw||0,health:combatTuning.enemyHealth,state:'idle',age:0,motion:[0,0],hitDone:false,animation:'idle_combat'}));events.push({type:'spawn'});if(source.presentation){this.presentation={...source.presentation,age:0};events.push({type:'presentationStarted',id:this.presentation.id});}}
  }
  if(this.presentation){
   const p=this.presentation;p.age=Number.isFinite(player.presentationTime)?Math.max(p.age,player.presentationTime):p.age+dt;
   const line=p.lines.find(line=>p.age>=line.start&&p.age<line.end);
   for(const enemy of this.enemies){enemy.motion=[0,0];enemy.animation=enemy.sourceName===line?.actor?'talk':'idle_combat';}
   if(p.age<p.duration)return events;
   events.push({type:'presentationEnded',id:p.id});this.presentation=null;this.queued=false;
   for(const enemy of this.enemies)enemy.animation='idle_combat';
  }
  if(this.queued&&!this.attack&&this.player.hitTime<=0&&player.grounded){
   this.combo=this.sinceAttack<.75?(this.combo+1)%3:0;const clip=`attack_lite_${'ABC'[this.combo]}`;
   this.attack={clip,age:0,duration:this.durations[clip]||combatRules.durations[clip],strikes:combatRules.attacks[clip].map(s=>({...s,hit:new Set()}))};this.queued=false;events.push({type:'playerAttack'});
  }
  if(this.attack){
   const a=this.attack;a.age+=dt;a.activeStrike=a.strikes.find(s=>a.age>=s.start-1e-6&&a.age<=s.end+1e-6);
   const strike=a.activeStrike;
   if(strike)for(const e of this.enemies){
    const d=distance(e.position,player.position),dx=e.position[0]-player.position[0],dz=e.position[2]-player.position[2];
    const facing=d<.01?1:(dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))/d;
    if(e.health>0&&!strike.hit.has(e.id)&&d<=combatTuning.reach&&Math.abs(e.position[1]-player.position[1])<1.4&&facing>.15){
     strike.hit.add(e.id);e.health=Math.max(0,e.health-strike.damage);e.state=e.health?'hit':'dead';e.age=0;e.motion=[0,0];e.animation=e.health?'impact_light':'impact_heavy';events.push({type:'enemyHit',id:e.id,killed:e.health===0,damage:strike.damage});
    }
   }
   if(a.age>=a.duration){this.attack=null;this.sinceAttack=0;}
  }
  for(const e of this.enemies){
   e.age+=dt;e.motion=[0,0];
   if(e.health<=0)continue;
   if(e.state==='hit'){if(e.age<(this.durations.hitStagger||combatTuning.enemyHitStagger))continue;e.state='idle';e.age=0;}
   const d=distance(e.position,player.position),height=Math.abs(e.position[1]-player.position[1]);
   if(e.state==='attack'){
    const duration=this.durations.enemyAttack||combatRules.durations.attack_light,window=combatRules.attacks.attack_light[0];
    if(!e.hitDone&&e.age>=window.start&&e.age<=window.end){e.hitDone=true;events.push({type:'enemyAttack'});if(d<combatTuning.enemyReach&&height<1.4&&this.damagePlayer(window.damage))events.push(...this.events.splice(0));}
    if(e.age>=duration)e.animation='idle_combat';
    if(e.age>duration+combatRules.enemy.attackCooldown){e.state='idle';e.age=0;}continue;
   }
   if(d<18&&height<4){
    e.yaw=Math.atan2(player.position[0]-e.position[0],player.position[2]-e.position[2]);
    if(d>1.3){e.state='chase';e.animation='run';e.motion=[Math.sin(e.yaw)*combatTuning.enemySpeed,Math.cos(e.yaw)*combatTuning.enemySpeed];}
    else{e.state='attack';e.animation='attack_light';e.age=0;e.hitDone=false;}
   }else{e.state='idle';e.animation='idle_combat';}
  }
  if(this.encounter&&this.enemies.length&&this.enemies.every(e=>e.health<=0)){this.cleared.add(this.encounter);events.push({type:'cleared',id:this.encounter});this.encounter=null;}
  return events;
 }
}
