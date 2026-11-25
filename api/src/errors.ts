export class Problem extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function required<T>(row: T | undefined): T {
  if (!row) throw new Problem(404, 'NOT_FOUND', 'Record not found.');
  return row;
}
export function conflict(message: string): never {
  throw new Problem(409, 'CONFLICT', message);
}
