export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  /** Executa `fn` dentro de uma transação (COMMIT ao final, ROLLBACK em erro). */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

/** Contrato mínimo de um pool Postgres (`pg.Pool` ou o Pool do driver serverless do Neon). */
export interface PoolLike {
  query(text: string, params?: any[]): Promise<any>;
  connect(): Promise<{ query(text: string, params?: any[]): Promise<any>; release(): void }>;
}

/** Adapta o pool do @netlify/database à interface Db. */
export function fromPool(pool: PoolLike): Db {
  return {
    query: (text, params) => pool.query(text, params as any[]),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: (t, p) => client.query(t, p as any[]) });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* conexão já perdida */
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
