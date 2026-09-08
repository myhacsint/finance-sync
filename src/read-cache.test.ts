import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadCache} from './read-cache.js';
test('read cache bounds memory, expires and invalidates by epoch without rewriting timestamps',()=>{
 const c=new ReadCache<{generatedAt:string}>(100,2),v={generatedAt:'original'};
 c.set('a','epoch',v,0);assert.equal(c.get('a','epoch',99),v);assert.equal(c.get('a','changed',99),undefined);
 c.set('a','epoch',v,0);assert.equal(c.get('a','epoch',100),undefined);
 c.set('a','epoch',v,1);c.set('b','epoch',v,1);c.set('c','epoch',v,1);assert.equal(c.get('a','epoch',2),undefined);
 c.clear();assert.equal(c.get('b','epoch',2),undefined);
});
