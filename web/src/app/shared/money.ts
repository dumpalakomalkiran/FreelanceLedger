import { Pipe, type PipeTransform } from '@angular/core';
import type { Currency } from '../api/ledger';
export function parseRate(text:string):string|null {
  if (!/^\d{1,17}(\.\d{1,2})?$/.test(text)) return null;
  const [whole,fraction=''] = text.split('.');
  const minor = BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0'));
  return minor <= 9223372036854775807n ? minor.toString() : null;
}
export function rateInput(minor:string):string {
  return (BigInt(minor)/100n).toString()+'.'+(BigInt(minor)%100n).toString().padStart(2,'0');
}
@Pipe({name:'money'})
export class MoneyPipe implements PipeTransform {
  transform(minor:string,currency:Currency):string {
    const [major,cents] = rateInput(minor).split('.');
    return new Intl.NumberFormat(currency==='INR'?'en-IN':'en-US',{style:'currency',currency})
      .formatToParts(BigInt(major)).map(part => part.type==='fraction'?cents:part.value).join('');
  }
}
