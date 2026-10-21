// Buffers are decoded once. Late loads never replay an old combat event.
export class GameplayAudio {
 constructor(settings){this.settings=settings;this.sources=new Set();this.buffers=new Map();this.paused=false;this.closed=false;this.playCount=0;this.lastPlayed=new Map();}
 async unlock(){
  if(this.closed)return;
  if(!this.context){
   const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
   this.context=new Context();this.output=this.context.createGain();this.output.connect(this.context.destination);this.apply();
   this.loading=Promise.all(['swing','hit','hurt','enemy','death','leaf','pot','wood','metal','mojo','defeat','disappear','bodyfall','health','freejack'].map(async name=>{
    try{const response=await fetch(`/assets/audio/combat/${name}.ogg`);if(!response.ok)throw Error(response.status);const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(!this.closed)this.buffers.set(name,buffer);}catch{/* Audio failure does not block gameplay. */}
   }));
  }
  if(!this.paused)await this.context.resume().catch(()=>{});
 }
 apply(){if(!this.output)return;this.output.gain.value=this.settings.muted?0:this.settings.effects;this.output.channelCount=this.settings.sound==='mono'?1:2;this.output.channelCountMode='explicit';}
 play(name){
  this.apply();if(this.closed||this.paused||this.settings.muted||this.context?.state!=='running'||!this.buffers.has(name)||this.sources.size>=8)return;
  if(this.context.currentTime-(this.lastPlayed.get(name)??-10)<.06)return;this.lastPlayed.set(name,this.context.currentTime);
  const source=this.context.createBufferSource();source.buffer=this.buffers.get(name);source.connect(this.output);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};source.start();this.playCount++;
 }
 event(event){
  if(event.type==='enemyHit'){
   this.play(event.killed?'defeat':'hit');
  }else if(event.type==='playerAttack'){
   this.play('swing');
  }else if(event.type==='playerHit'){
   this.play('hurt');
  }else if(event.type==='playerDead'){
   this.play('death');
  }else if(event.type==='enemyAttack'){
   this.play('enemy');
  }else if(event.type==='enemyReward'){
   this.play('defeat');
  }else if(event.type==='enemyDeathDone'){
   this.play('disappear');
  }else if(event.type==='mojoCollected'){
   this.play('mojo');
  }else if(event.type==='healthCollected'){
   this.play('health');
  }else if(event.type==='freeJackCollected'){
   this.play('freejack');
  }else if(event.type==='propBroken'||event.type==='propHit'||event.type==='propBlocked'&&event.sound!=='wood'){
   this.play(event.sound);
  }
 }
 clear(){for(const source of this.sources){source.stop();source.disconnect();}this.sources.clear();}
 pause(value){this.paused=value;this.clear();if(value)this.context?.suspend().catch(()=>{});else this.context?.resume().catch(()=>{});}
 stop(){this.closed=true;this.clear();this.context?.close().catch(()=>{});this.buffers.clear();}
}
