import { redis } from './redis';

/**
 * Utilitário para Cache: Tenta buscar do Redis, se não existir, executa a busca e salva.
 */
export async function getOrSetCache<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 3600): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const freshData = await fetchFn();
  await redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
  return freshData;
}

/**
 * Utilitário para Lock Distribuído: Garante que apenas um processo execute um bloco de código por vez.
 * Ideal para evitar duplicidade de agendamentos.
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlMs: number = 5000,
  retryDelayMs: number = 100
): Promise<T> {
  const fullLockKey = `lock:${lockKey}`;
  
  // Tenta adquirir o lock usando SET NX (Set if Not Exists)
  const acquired = await redis.set(fullLockKey, 'locked', 'PX', ttlMs, 'NX');

  if (!acquired) {
    // Se não adquiriu, tenta novamente após um delay (simples retry logic)
    // Em sistemas de produção, você pode querer um limite de retentativas
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    return withLock(lockKey, fn, ttlMs, retryDelayMs);
  }

  try {
    return await fn();
  } finally {
    // Sempre libera o lock ao terminar
    await redis.del(fullLockKey);
  }
}
