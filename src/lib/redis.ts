import Redis from 'ioredis';

// Obtenha a URL do Redis das variáveis de ambiente
// Para desenvolvimento local usando docker: redis://localhost:6379
// Para produção (Upstash, Render, etc.): redis://default:password@host:port
const redisUrl = process.env.VITE_REDIS_URL || process.env.REDIS_URL || '';

// Configuração do cliente Redis
// Em ambientes edge/serverless (como Next.js Edge ou Cloudflare Workers),
// considere usar @upstash/redis ao invés de ioredis.
// Aqui usando ioredis padrão para NodeJS/Express.
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL não está definida no .env. Inicializando o cliente sem URL (tentará localhost:6379 por padrão).');
    }
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      console.error('❌ Erro no Redis:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Conectado ao Redis!');
    });
  }

  return redisClient;
}

export const redis = getRedisClient();
