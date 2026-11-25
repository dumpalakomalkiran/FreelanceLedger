import {describe,it,expect} from 'vitest';
import {MoneyPipe,parseRate,rateInput} from './money';
describe('minor units',()=>{
  const money=new MoneyPipe();
  it('formats paise using Indian digit grouping',()=>{
    expect(money.transform('123456789')).toBe('₹12,34,567.89');
  });
  it('round trips the largest supported integer without losing a paisa',()=>{
    const max='9223372036854775807';
    expect(parseRate(rateInput(max))).toBe(max);
    expect(money.transform(max)).toBe('₹92,23,37,20,36,85,47,758.07');
  });
  it('accepts zero and rejects overprecision, negative and out-of-range rates',()=>{
    expect(parseRate('0')).toBe('0');
    expect(parseRate('12.3')).toBe('1230');
    for(const value of ['1.001','-1','1e2','','92233720368547758.08']) expect(parseRate(value)).toBeNull();
  });
});
