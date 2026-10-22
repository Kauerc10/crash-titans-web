import { healthMeterGeometry as meter } from './health-meter-geometry.js';
import { label } from './bitmap.js';
import { combatTuning } from './combat.js';

const art=(name,className)=>{const img=document.createElement('img');img.src=`/assets/hud/${name}.webp`;img.alt='';img.draggable=false;img.className=className||'';return img;};
const node=className=>{const el=document.createElement('div');el.className=className;return el;};
function number(host,value,spoken,size=26,color='#fff5c1'){
 if(host.dataset.value===String(value))return;host.dataset.value=String(value);
 const accessible=document.createElement('span');accessible.className='hud-accessible';accessible.textContent=spoken;
 host.replaceChildren(accessible,label(Number(value).toLocaleString('en-US'),size,color,true));
}

// Source art and fonts; layout follows the supplied gameplay references.
// Fodder health remains internal. Its icon denotes objective progress, not HP.
export class GameplayHud {
 constructor(root){
  this.root=node('native-hud');this.root.hidden=true;root.append(this.root);this.combo=0;this.comboUntil=0;this.mojoUntil=0;this.previousMojo=0;
  this.health=node('hud-health');this.health.setAttribute('role','meter');this.health.setAttribute('aria-label','Vida do Crash');this.health.setAttribute('aria-valuemin','0');this.health.setAttribute('aria-valuemax',String(combatTuning.playerHealth));
  const bar=node('hud-health-bar');bar.style.aspectRatio=`${meter.frameWidth}/${meter.frameHeight}`;this.fill=art('health-fill','hud-meter-fill');bar.append(art('health-empty','hud-meter-empty'),this.fill,art('health-frame','hud-meter-frame'));
  this.fill.style.left=`${meter.fillLeft/meter.frameWidth*100}%`;this.fill.style.width=`${meter.fillWidth/meter.frameWidth*100}%`;
  this.health.append(art('crash-symbol','hud-health-icon'),bar);this.root.append(this.health);
  this.mojo=node('native-mojo');this.mojoNumber=node('hud-number');this.mojo.append(art('hud_mojo_icon'),this.mojoNumber);this.root.append(this.mojo);
  this.comboPanel=node('hud-combo');this.comboPanel.hidden=true;this.comboNumber=node('hud-number');this.comboPanel.append(art('combo-green'),this.comboNumber);this.root.append(this.comboPanel);

  this.tutorialPanel=node('hud-tutorial');this.tutorialPanel.hidden=true;
  const banner=node('hud-tutorial-banner');
  this.tutorialTitle=node('hud-tutorial-title');
  const content=node('hud-tutorial-content');
  this.tutorialIcon=art('tut_icon_crash','hud-tutorial-icon');
  this.tutorialText=node('hud-tutorial-text');
  content.append(this.tutorialIcon,this.tutorialText);
  this.tutorialDivider=art('fe_divider_2_flipped_sharp','hud-tutorial-divider');
  banner.append(this.tutorialTitle,content,this.tutorialDivider);
  this.tutorialPanel.append(banner);
  this.root.append(this.tutorialPanel);

  this.objective=node('hud-accessible');this.root.append(this.objective);
 }
 resize(width,height){this.root.style.setProperty('--hud-scale',String(Math.min(width/1280,height/720)));}
 updateTutorial(active){
  if(!active){this.tutorialPanel.hidden=true;return;}
  this.tutorialPanel.hidden=false;
  this.tutorialTitle.textContent=active.title||'TUTORIAL';
  this.tutorialText.textContent=active.text||'';
 }
 event(event,time){
  if(event.type==='enemyHit'){this.combo=time<this.comboUntil?this.combo+1:1;this.comboUntil=time+3;}
  else if(event.type==='tutorialStarted'){this.updateTutorial(event);}
  else if(event.type==='tutorialEnded'){this.updateTutorial(null);}
 }
 reset(total=0){this.combo=0;this.comboUntil=0;this.previousMojo=total;this.mojoUntil=0;this.updateTutorial(null);}
 update(combat,pickups,time,tutorialManager=null){
  const ratio=Math.max(0,Math.min(1,combat.player.health/combatTuning.playerHealth));
  this.health.setAttribute('aria-valuenow',String(combat.player.health));this.health.setAttribute('aria-valuetext',`${combat.player.health} de ${combatTuning.playerHealth}`);
  this.fill.style.clipPath=`inset(0 ${(1-ratio)*100}% 0 0)`;this.health.classList.toggle('is-hurt',combat.player.hitTime>0);this.health.classList.toggle('is-low',ratio>0&&ratio<=.25);
  const total=pickups?.total||0;if(total>this.previousMojo)this.mojoUntil=time+.5;this.previousMojo=total;
  number(this.mojoNumber,total,`Mojo ${total}`,38,'#61d4ff');this.mojo.classList.toggle('is-gained',time<this.mojoUntil);
  this.comboPanel.hidden=this.combo<1||time>=this.comboUntil;if(!this.comboPanel.hidden)number(this.comboNumber,this.combo,`${this.combo} acertos`,56,'#fff');
  if(tutorialManager){this.updateTutorial(tutorialManager.active);}
  const count=combat.enemies.filter(e=>e.health>0).length,text=combat.player.health<=0?'Retornando ao checkpoint…':count?`Derrote os Chirattas • ${count}`:combat.cleared.size?'Encontro vencido':'Explore a ilha';
  if(this.objective.textContent!==text)this.objective.textContent=text;
 }
}
