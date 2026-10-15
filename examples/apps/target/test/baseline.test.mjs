import {test} from 'node:test';
import assert from 'node:assert/strict';
import {records,brand,totalBudget} from '../src/records.ts';
test('existing studio data, brand and portfolio calculation survive',()=>{
  assert.equal(brand,'Relay');assert.equal(records.length,6);assert.equal(totalBudget(records),6600);
  assert.equal(records[1].client,'Atelier');assert.equal(records[4].project,'Tokyo 東京');
});
