export const maxMinor = 9223372036854775807n;

function bounded(value: bigint): bigint {
  if (value < 0n || value > maxMinor) throw new RangeError('Amount outside storage range.');
  return value;
}
function halfUp(numerator: bigint, denominator: bigint): bigint {
  return bounded((numerator + denominator / 2n) / denominator);
}
export function calculate(entries: Iterable<{ minutes: number; rate: string }>, bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new RangeError('Invalid tax rate.');
  const groups = new Map<bigint, bigint>();
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.minutes) || entry.minutes <= 0) throw new RangeError('Invalid minutes.');
    const rate = bounded(BigInt(entry.rate));
    groups.set(rate, bounded((groups.get(rate) ?? 0n) + BigInt(entry.minutes)));
  }
  let subtotal = 0n;
  const lines = Array.from(groups, ([rate, minutes]) => {
    const amount = halfUp(minutes * rate, 60n);
    subtotal = bounded(subtotal + amount);
    return {quantity_minutes: String(minutes), unit_rate_minor: String(rate), amount_minor: String(amount)};
  });
  const tax = halfUp(subtotal * BigInt(bps), 10000n);
  return { lines, subtotal_minor: String(subtotal), tax_minor: String(tax), total_minor: String(bounded(subtotal + tax)) };
}
