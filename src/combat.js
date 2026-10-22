import { containsVolume } from './episode.js';
import { combatRules } from './combat-rules.js';

// Base health, strike damage/strength and contact windows are recovered source data.
// Reach, pursuit, stagger, input grace and invulnerability are native tuning.
export const combatTuning=Object.freeze({
  playerHealth:combatRules.player.maxHealth,
  enemyHealth:combatRules.enemy.maxHealth,
  damage:combatRules.attacks.attack_lite_A[0].damage,
  enemyDamage:combatRules.attacks.attack_light[0].damage,
  reach:2.15,
  enemyReach:1.65,
  enemySpeed:3.2,
  invulnerability:.8,
  enemyHitStagger:.45,
  enemyDeathDuration:1.8,
  // Titan / Spike tuning
  spikeHealth: combatRules.spike?.maxHealth || 30.0,
  spikeDamage: combatRules.spike?.damage || 5.0,
  spikeReach: combatRules.spike?.reach || 3.5,
  spikeSpeed: combatRules.spike?.speed || 3.8,
  spikeHitStagger: combatRules.spike?.hitStagger || 0.5,
  spikeStumbleDuration: combatRules.spike?.stumbleDuration || 1.7,
  spikeStunDuration: combatRules.spike?.stunDuration || 12.0
});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);

// Chiratta drops: 7 c_mojoS guaranteed; negative count -5 slots give 5% freeJack, 4.75% health (mutually exclusive)
export function calculateEnemyDrops(rng=Math.random){
 const drops=[{type:'c_mojoS',count:7}];
 let negativeWon=false;
 if(rng()<.05){negativeWon=true;drops.push({type:'c_freeJack',count:1});}
 if(!negativeWon&&rng()<.05){drops.push({type:'c_health',count:1});}
 return drops;
}

export class Combat {
 constructor(data,durations={},options={}){
  this.data=data;this.durations=durations;this.rng=options.rng||durations.rng||Math.random;
  this.cleared=new Set();this.savedCleared=new Set();this.generation=0;this.resetToCheckpoint();
 }
 resetToCheckpoint(){
  this.cleared=new Set(this.savedCleared);
  this.enemies=structuredClone(this.savedEncounter?.enemies||[]);
  this.encounter=this.savedEncounter?.encounter||null;
  this.presentation=structuredClone(this.savedEncounter?.presentation||null);
  this.attack=null;this.queued=false;this.queuedHeavy=false;this.combo=-1;this.sinceAttack=10;this.needsRecovery=false;
  this.player={health:combatTuning.playerHealth,invulnerable:0,hitTime:0,deathTime:0};
  this.events=[];this.generation++;
  this.jackedTitan=this.savedEncounter?.jackedTitanId?this.enemies.find(e=>e.id===this.savedEncounter.jackedTitanId)||null:null;
 }
 markCheckpoint(){
  this.savedCleared=new Set(this.cleared);
  this.savedEncounter=structuredClone({enemies:this.enemies,encounter:this.encounter,presentation:this.presentation,jackedTitanId:this.jackedTitan?.id||null});
 }
 get isJacked(){return !!this.jackedTitan;}
 requestAttack(){if(!this.presentation&&!this.jackedTitan&&this.player.health>0&&this.player.hitTime<=0)this.queued=true;return !this.jackedTitan;}
 requestHeavyAttack(){if(!this.presentation&&!this.jackedTitan&&this.player.health>0&&this.player.hitTime<=0)this.queuedHeavy=true;return !this.jackedTitan;}
 skipPresentation(){
  if(this.presentation){
   const id=this.presentation.id;
   this.presentation=null;
   this.queued=false;this.queuedHeavy=false;
   for(const enemy of this.enemies)enemy.animation=enemy.isTitan?'idle':'idle_combat';
   this.events.push({type:'presentationEnded',id,skipped:true});
  }
 }
 canJack(playerPos){
  if(this.jackedTitan)return false;
  const titan=this.enemies.find(e=>e.isTitan&&e.isStunned&&e.jackable&&!e.isJacked);
  if(!titan)return false;
  const pos=playerPos?.position||playerPos||[0,0,0];
  return distance(titan.position,pos)<=4.5;
 }
 requestJack(playerPos){
  if(!playerPos&&this.jackedTitan){
   return this.requestDismount();
  }
  if(!this.canJack(playerPos)){
   this.events.push({type:'jackRejected'});
   return false;
  }
  const titan=this.enemies.find(e=>e.isTitan&&e.isStunned&&e.jackable&&!e.isJacked);
  titan.isJacked=true;
  titan.jackable=false;
  titan.isStunned=false;
  titan.state='jacked';
  titan.animation='idle';
  titan.age=0;
  titan.motion=[0,0];
  this.jackedTitan=titan;
  this.events.push({type:'jackAccepted',id:titan.id,titan});
  this.events.push({type:'jackMounted',id:titan.id,titan});
  return true;
 }
 requestDismount(){
  if(!this.jackedTitan)return false;
  const titan=this.jackedTitan;
  titan.isJacked=false;
  titan.state='idle';
  titan.animation='idle';
  titan.motion=[0,0];
  const yaw=titan.yaw||0;
  const dist=combatRules.spike?.dismountDistance||1.5;
  const dismountPos=[
   titan.position[0]-Math.sin(yaw)*dist,
   titan.position[1],
   titan.position[2]-Math.cos(yaw)*dist
  ];
  this.jackedTitan=null;
  this.events.push({type:'titanDismounted',id:titan.id,titan,position:dismountPos});
  return true;
 }
 requestTitanMove(direction){
  if(!this.jackedTitan)return;
  if(direction&&(direction[0]!==0||direction[1]!==0)){
   const len=Math.hypot(direction[0],direction[1]);
   const dx=direction[0]/len;
   const dz=direction[1]/len;
   const speed=combatRules.spike?.jackedSpeed||11.3;
   this.jackedTitan.motion=[dx*speed,dz*speed];
   this.jackedTitan.yaw=Math.atan2(dx,dz);
   this.jackedTitan.animation='run';
  }else{
   this.jackedTitan.motion=[0,0];
   this.jackedTitan.animation='idle';
  }
 }
 damagePlayer(amount){
  if(this.player.health<=0||this.player.invulnerable>0)return false;
  this.player.health=Math.max(0,this.player.health-amount);this.player.invulnerable=combatTuning.invulnerability;this.player.hitTime=.35;this.attack=null;this.queued=false;this.queuedHeavy=false;
  this.events.push({type:this.player.health===0?'playerDead':'playerHit'});return true;
 }
 healPlayer(amount){
  if(this.player.health<=0)return 0;
  const before=this.player.health;
  this.player.health=Math.min(combatTuning.playerHealth,this.player.health+amount);
  return this.player.health-before;
 }
 get busy(){return !!this.presentation||this.player.health<=0||this.player.hitTime>0||!!this.attack;}
 get propAttack(){const strike=this.attack?.activeStrike;if(!strike)return null;strike.age=this.attack.age;return strike;}
 get animation(){return this.player.health<=0?'death':this.player.hitTime>0?'impact_light':this.attack?.clip||null;}
 step(dt,player,titanInput){
  const events=this.events.splice(0);
  if(this.jackedTitan){
   if(titanInput)this.requestTitanMove(titanInput.direction);
   this.jackedTitan.age+=dt;
  }this.sinceAttack+=dt;this.player.invulnerable=Math.max(0,this.player.invulnerable-dt);this.player.hitTime=Math.max(0,this.player.hitTime-dt);
  if(this.player.health<=0){this.player.deathTime+=dt;this.needsRecovery=this.player.deathTime>=(this.durations.death||2);for(const e of this.enemies)e.motion=[0,0];return events;}
  if(!this.encounter){
   const source=this.data.encounters?.find(e=>(e.id==='L1_E1_Combat2'||e.id==='L1_E1_Combat7')&&!this.cleared.has(e.id)&&containsVolume(this.data.volumes[e.trigger],player.position));
   if(source){
    this.encounter=source.id;
    this.enemies=source.spawns.map((s,i)=>{
     const isSpike=s.template==='Characters:Spike'||(s.name&&s.name.includes('Spike'));
     const loc=this.data.locators[s.locator]||{position:[0,0,0],yaw:0};
     return {
      id:`${this.generation}:${source.id}:${i}`,
      sourceName:s.name,
      template:s.template||(isSpike?'Characters:Spike':'Characters:Chiratta'),
      isTitan:isSpike,
      isJacked:false,
      position:[...loc.position],
      yaw:loc.yaw||0,
      health:isSpike?combatTuning.spikeHealth:combatTuning.enemyHealth,
      maxHealth:isSpike?combatTuning.spikeHealth:combatTuning.enemyHealth,
      state:'idle',
      age:0,
      motion:[0,0],
      hitDone:false,
      rewardEmitted:false,
      deathDone:false,
      isStunned:false,
      jackable:false,
      animation:isSpike?'idle':'idle_combat'
     };
    });
    events.push({type:'spawn'});
    if(source.presentation){this.presentation={...source.presentation,age:0};events.push({type:'presentationStarted',id:this.presentation.id});}
   }
  }
  if(this.presentation){
   const p=this.presentation;p.age=Number.isFinite(player.presentationTime)?Math.max(p.age,player.presentationTime):p.age+dt;
   const line=p.lines.find(line=>p.age>=line.start&&p.age<line.end);
   for(const enemy of this.enemies){enemy.motion=[0,0];enemy.animation=enemy.sourceName===line?.actor?'talk':enemy.isTitan?'idle':'idle_combat';}
   if(p.age<p.duration)return events;
   events.push({type:'presentationEnded',id:p.id});this.presentation=null;this.queued=false;this.queuedHeavy=false;
   for(const enemy of this.enemies)enemy.animation=enemy.isTitan?'idle':'idle_combat';
  }
  if(this.queuedHeavy&&!this.attack&&this.player.hitTime<=0&&player.grounded){
   const clip='attack_lite_C';
   this.attack={clip,age:0,duration:this.durations[clip]||combatRules.durations[clip],strikes:combatRules.attacks[clip].map(s=>({...s,hit:new Set()})),heavy:true};
   this.queuedHeavy=false;this.queued=false;this.sinceAttack=0;events.push({type:'playerAttack',heavy:true});
  } else if(this.queued&&!this.attack&&this.player.hitTime<=0&&player.grounded){
   this.combo=this.sinceAttack<.75?(this.combo+1)%3:0;const clip=`attack_lite_${'ABC'[this.combo]}`;
   this.attack={clip,age:0,duration:this.durations[clip]||combatRules.durations[clip],strikes:combatRules.attacks[clip].map(s=>({...s,hit:new Set()}))};this.queued=false;events.push({type:'playerAttack'});
  }
  if(this.attack){
   const a=this.attack;a.age+=dt;a.activeStrike=a.strikes.find(s=>a.age>=s.start-1e-6&&a.age<=s.end+1e-6);
   const strike=a.activeStrike;
   if(strike)for(const e of this.enemies){
    const d=distance(e.position,player.position),dx=e.position[0]-player.position[0],dz=e.position[2]-player.position[2];
    const facing=d<.01?1:(dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))/d;
    const maxReach=e.isTitan?combatTuning.reach+0.7:combatTuning.reach;
    if(e.health>0&&!strike.hit.has(e.id)&&d<=maxReach&&Math.abs(e.position[1]-player.position[1])<2.0&&facing>.15){
     strike.hit.add(e.id);e.health=Math.max(0,e.health-strike.damage);e.age=0;e.motion=[0,0];
     if(e.isTitan){
      if(e.health===0){
       e.state='stumble';e.animation='stumble';e.isStunned=true;e.jackable=true;
       events.push({type:'titanStunned',id:e.id,template:e.template,position:[...e.position]});
      }else{
       e.state='hit';e.animation='impact_light';
       events.push({type:'enemyHit',id:e.id,killed:false,damage:strike.damage,position:[...e.position]});
      }
     }else{
      e.state=e.health?'hit':'dead';e.animation=e.health?'impact_light':'impact_heavy';
      events.push({type:'enemyHit',id:e.id,killed:e.health===0,damage:strike.damage,position:[...e.position]});
     }
    }
   }
   if(a.age>=a.duration){this.attack=null;this.sinceAttack=0;}
  }
  for(const e of this.enemies){
   if(e.isTitan&&e.isJacked){
    continue;
   }
   e.age+=dt;e.motion=[0,0];
   if(e.isTitan){
    if(e.isStunned){
     if(e.state==='stumble'){
      if(e.age>=combatTuning.spikeStumbleDuration){e.state='stunned';e.animation='stun';e.age=0;}
     }else if(e.state==='stunned'){
      e.animation='stun';
     }
     continue;
    }
    if(e.state==='hit'){if(e.age<combatTuning.spikeHitStagger)continue;e.state='idle';e.age=0;}
    const d=distance(e.position,player.position),height=Math.abs(e.position[1]-player.position[1]);
    if(e.state==='attack'){
     const duration=this.durations.spikeAttack||combatRules.spike?.attackDuration||2.8;
     const window=combatRules.spike?.attackContactWindow||{start:.7,end:1.2};
     if(!e.hitDone&&e.age>=window.start&&e.age<=window.end){
      e.hitDone=true;events.push({type:'enemyAttack',titan:true});
      if(d<combatTuning.spikeReach&&height<2.0&&this.damagePlayer(combatTuning.spikeDamage)){
       events.push(...this.events.splice(0));
      }
     }
     if(e.age>=duration){e.animation='idle';e.state='idle';e.age=0;}
     continue;
    }
    if(d<25&&height<5){
     e.yaw=Math.atan2(player.position[0]-e.position[0],player.position[2]-e.position[2]);
     if(d>2.8){
      e.state='chase';e.animation='run';e.motion=[Math.sin(e.yaw)*combatTuning.spikeSpeed,Math.cos(e.yaw)*combatTuning.spikeSpeed];
     }else{
      e.state='attack';e.animation='attack_light';e.age=0;e.hitDone=false;e.motion=[0,0];
     }
    }else{e.state='idle';e.animation='idle';}
    continue;
   }
   if(e.health<=0){
    if(!e.rewardEmitted&&e.age>=.6){
     e.rewardEmitted=true;
     const drops=calculateEnemyDrops(this.rng);
     events.push({type:'enemyReward',id:e.id,position:[...e.position],drops});
    }
    if(!e.deathDone&&e.age>=(this.durations.enemyDeath||combatTuning.enemyDeathDuration)){
     e.deathDone=true;
     events.push({type:'enemyDeathDone',id:e.id,position:[...e.position]});
    }
    continue;
   }
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
  if(this.encounter&&this.enemies.length&&this.enemies.every(e=>(e.isTitan?e.isStunned:e.health<=0))){
   this.cleared.add(this.encounter);events.push({type:'cleared',id:this.encounter});this.encounter=null;
  }
  return events;
 }
}
