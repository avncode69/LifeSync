interface LeasePool {
  connect(): Promise<{
    query(sql: string): Promise<{ rows: { acquired?: boolean }[] }>;
    release(): void;
  }>;
}

/** A session lease also prevents overlap during rolling restarts. */
export async function runExclusively(pool: LeasePool, job: () => Promise<void>) {
  const client = await pool.connect();
  let acquired = false;
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(142731, 1) AS acquired");
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) return false;
    await job();
    return true;
  } finally {
    try {
      if (acquired) await client.query("SELECT pg_advisory_unlock(142731, 1)");
    } finally {
      client.release();
    }
  }
}
