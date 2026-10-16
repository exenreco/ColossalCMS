/** Cache duplicate reads only within this request; any write invalidates them. */
export function requestDatabase(database) {
  const reads = new Map();
  const stats = { count: 0, duration: 0, reused: 0 };
  const measured = async (operation) => {
    const start = performance.now();
    stats.count++;
    try {
      return await operation();
    } finally {
      stats.duration += performance.now() - start;
    }
  };
  const prepare = (sql, args = []) => {
    const statement = database.prepare(sql);
    const bound = args.length ? statement.bind(...args) : statement;
    const read = async (kind) => {
      const key = JSON.stringify([sql, args, kind]);
      if (reads.has(key)) stats.reused++;
      else {
        const pending = measured(() => bound[kind]());
        reads.set(key, pending);
        pending.catch(() => {
          if (reads.get(key) === pending) reads.delete(key);
        });
      }
      // Callers sometimes edit parsed rows. Do not share mutable results.
      return structuredClone(await reads.get(key));
    };
    return {
      ...bound,
      sql,
      args,
      bind: (...values) => prepare(sql, values),
      first: () => read("first"),
      all: () => read("all"),
      run: () => {
        reads.clear();
        return measured(() => bound.run()).finally(() => reads.clear());
      },
    };
  };
  const db = Object.create(database);
  db.cacheIdentity = database.cacheIdentity || database;
  db.prepare = prepare;
  db.batch = (statements) => {
    reads.clear();
    // Reconstruct native statements for adapters whose batch relies on private fields.
    return measured(() =>
      database.batch(
        statements.map(({ sql, args = [] }) =>
          database.prepare(sql).bind(...args),
        ),
      ),
    ).finally(() => reads.clear());
  };
  return { db, stats };
}
