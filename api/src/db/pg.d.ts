declare module 'pg' {
  export interface Queryable {
    query<R extends object = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{rows: R[]; rowCount: number | null}>;
  }
  export interface Connection extends Queryable { release(error?: boolean): void }
  export class Pool implements Queryable {
    constructor(options: { database: string; user: string; host: string; options?: string });
    query: Queryable['query'];
    connect(): Promise<Connection>;
    end(): Promise<void>;
    on(event: 'error', listener: (err: Error) => void): this;
  }
  const pg: {Pool: typeof Pool; types: {setTypeParser(oid: number, parse: (value: string) => string): void}};
  export default pg;
}
