export type Status = 'draft' | 'sent' | 'paid';
export function canTransition(from: Status, to: Status): boolean {
  return (from === 'draft' && to === 'sent') || (from === 'sent' && to === 'paid');
}
