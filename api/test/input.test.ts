import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryFilter, fromTime, project } from '../src/routes/input.ts';
test('date ranges use valid calendar dates and inclusive bounds', () => {
  const base = {project_id:1,from:'2028-02-29',to:'2028-02-29'};
  assert.ok(fromTime.safeParse(base).success);
  assert.equal(fromTime.safeParse({...base,from:'2026-02-29'}).success,false);
  assert.equal(fromTime.safeParse({...base,to:'2028-02-28'}).success,false);
});
test('rates must be exact integer strings within database bounds', () => {
  const base = {name:'Press',client_id:1};
  for (const rate of [1,'-1','1.0','9223372036854775808','','one']) {
    assert.equal(project.safeParse({...base,default_hourly_rate_minor:rate}).success,false);
  }
  assert.ok(project.safeParse({...base,default_hourly_rate_minor:'0'}).success);
});
test('query booleans preserve false and reject ambiguous values', () => {
  assert.equal(entryFilter.parse({invoiced:'false'}).invoiced,false);
  assert.equal(entryFilter.safeParse({billable:'yes'}).success,false);
});
