import test from 'node:test';
import assert from 'node:assert/strict';
import { Breakables } from '../src/breakables.js';
const player={position:[0,0,0],yaw:0},attack={age:.2,duration:.5};
test('plants break once during the active forward swing, with distance and floor checks',()=>{
 const state=new Breakables([{id:'front',position:[0,0,1]},{id:'back',position:[0,0,-1]},{id:'far',position:[0,0,4]},{id:'up',position:[0,4,1]}]);
 assert.deepEqual(state.step({age:0,duration:.5},player),[]);
 assert.deepEqual(state.step(attack,player),[{type:'propBroken',id:'front'}]);assert.deepEqual(state.step(attack,player),[]);
});
test('retry restores plants broken since the last checkpoint and retains earlier breaks',()=>{
 const state=new Breakables([{id:'a',position:[0,0,1]},{id:'b',position:[5,0,1]}]);
 state.step(attack,player);state.markCheckpoint();state.step(attack,{position:[5,0,0],yaw:0});state.resetToCheckpoint();assert.deepEqual([...state.broken],['a']);
});
