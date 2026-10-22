// Handwritten rule fixture. Coordinates and text are invented, not extracted game content.
export function episodeFixture() {
 return {
  volumes: {entry: {position:[0,0,0],halfExtents:[1,1,1]},arena:{position:[10,0,0],halfExtents:[2,2,2]},after:{position:[20,0,0],halfExtents:[1,1,1]},PlaySpike:{position:[40,0,0],halfExtents:[1,1,1]}},
  locators:{entry:{position:[0,0,0],yaw:0},after:{position:[21,0,0],yaw:1},enemy:{position:[10,0,1],yaw:0}},
  checkpoints:[{id:'before',trigger:'entry',locator:'entry',requires:['NIS01']},{id:'after',trigger:'after',locator:'after',requires:['L1_E1_Combat2']}],
  encounters:[{id:'L1_E1_Combat2',trigger:'arena',requires:[],spawns:[{name:'test-enemy',locator:'enemy'}]}],
  tutorials:[{id:'Tutorial_Tutorial_AirJump',triggerType:'interaction',position:[30,0,0],requires:['L1_E1_Combat2'],duration:5,texts:{keyboard:'SPACE twice',gamepad:'A twice',ps2:'jump twice'},audio:'example'},
  {id:'Tutorial_Hint_BlockBreaker',triggerType:'volume',trigger:'PlaySpike',requires:[],texts:{keyboard:'unsupported heavy',gamepad:'unsupported heavy'}},
  {id:'SpikeCinematic',triggerType:'volume',trigger:'PlaySpike',requires:['L1_E1_Combat2'],texts:{keyboard:'unimplemented scene'}}]
 };
}
