/** Pure episode state; source positions use browser Y-up / mirrored Z. */
export function containsVolume(volume, position) {
  const delta = position.map((v,i)=>v-volume.position[i]);
  // Source trigger rotations are Euler XYZ. Undo mirrored yaw first, then
  // pitch and roll, to evaluate the point in the source box's local axes.
  const [pitch,yaw,roll] = volume.rotation || [0,0,0];
  const rotate = (a,b,angle) => { const x=delta[a],y=delta[b],c=Math.cos(angle),s=Math.sin(angle);delta[a]=c*x-s*y;delta[b]=s*x+c*y; };
  rotate(0,1,-roll); rotate(0,2,-yaw); rotate(1,2,pitch);
  return delta.every((v,i)=>Math.abs(v)<=volume.halfExtents[i]+1e-6);
}

export class EpisodeProgress {
  constructor(data) { this.data=data;this.completed=new Set();this.checkpoint=null; }
  complete(id) { this.completed.add(id); }
  setEntry(position,yaw=0) { this.checkpoint={id:'entry',position:[...position],yaw}; }
  visit(position) {
    const reached=this.data.checkpoints.filter(c=>!this.completed.has(c.id)&&c.requires.every(id=>this.completed.has(id))&&containsVolume(this.data.volumes[c.trigger],position));
    for(const checkpoint of reached) this.completed.add(checkpoint.id);
    if(reached.length) {
      // Independent objectives can overlap. Choose the closest checkpoint
      // locator instead of relying on source declaration order.
      const distance=c=>this.data.locators[c.locator].position.reduce((sum,v,i)=>sum+(v-position[i])**2,0);
      reached.sort((a,b)=>distance(a)-distance(b));
      const selected=reached[0],locator=this.data.locators[selected.locator];
      this.checkpoint={id:selected.id,position:[...locator.position],yaw:locator.yaw};
    }
    return reached;
  }
  recovery() { return this.checkpoint ? {...this.checkpoint,position:[...this.checkpoint.position]} : null; }
}

export class JumpInput {
  constructor(){this.down=false;this.pending=false;this.airUsed=false;this.blocked=false;}
  press(){if(!this.down&&!this.blocked)this.pending=true;this.down=true;}
  release(){this.down=false;this.blocked=false;}
  clear(){this.down=false;this.pending=false;}
  cancelPending(){this.pending=false;}
  suspend(){this.clear();this.blocked=true;}
  reset(){this.clear();this.airUsed=false;this.blocked=false;}
  consume(grounded){
    if(grounded)this.airUsed=false;
    if(!this.pending)return null;
    this.pending=false;
    if(grounded)return 'ground';
    if(!this.airUsed){this.airUsed=true;return 'air';}
    return null;
  }
}
