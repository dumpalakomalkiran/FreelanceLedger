import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, maxMinor } from '../src/domain/money.ts';
import { canTransition } from '../src/domain/status.ts';

test('rounds below, at and above half a minor unit', () => {
  for (const [minutes,expected] of [[29,'0'],[30,'1'],[31,'1']] as const) {
    assert.equal(calculate([{minutes,rate:'1'}],0).subtotal_minor,expected);
  }
});
test('groups by effective rate before rounding, including zero', () => {
  const result = calculate([{minutes:1,rate:'15'},{minutes:1,rate:'15'},{minutes:60,rate:'0'}],0);
  assert.deepEqual(result.lines,[{quantity_minutes:'2',unit_rate_minor:'15',amount_minor:'1'},
    {quantity_minutes:'60',unit_rate_minor:'0',amount_minor:'0'}]);
});
test('tax rounds once across lines and rounds exact ties up', () => {
  const items = [{minutes:60,rate:'1'},{minutes:30,rate:'2'}];
  assert.equal(calculate(items,5000).tax_minor,'1');
  assert.equal(calculate(items,2500).total_minor,'3');
});
test('retains precision beyond the JavaScript safe integer limit', () => {
  assert.equal(calculate([{minutes:60,rate:String(maxMinor)}],0).total_minor,String(maxMinor));
});
test('rejects overflow of a line, subtotal or final total', () => {
  const huge = {minutes:60,rate:String(maxMinor)};
  for (const run of [() => calculate([{...huge,minutes:61}],0),
    () => calculate([huge,{minutes:60,rate:'1'}],0),() => calculate([huge],1)]) {
    assert.throws(run,RangeError);
  }
});
test('rejects invalid units and tax bounds', () => {
  for (const minutes of [0,-1,1.5]) assert.throws(() => calculate([{minutes,rate:'0'}],0),RangeError);
  assert.throws(() => calculate([{minutes:1,rate:'-1'}],0),RangeError);
  for (const rate of [-1,0.1,10001]) assert.throws(() => calculate([],rate),RangeError);
});
test('allows exactly two of the nine status pairs', () => {
  const states = ['draft','sent','paid'] as const;
  for (const from of states) for (const to of states) {
    assert.equal(canTransition(from,to),['draft-sent','sent-paid'].includes(from+'-'+to));
  }
});
