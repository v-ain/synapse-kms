import { Redis } from 'ioredis';
import { config } from 'src/config.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = config.redisPassword;

export const redis = new Redis(redisUrl, {
  password: redisPassword,
  maxRetriesPerRequest: null, // Важно для стабильной интеграции с очередями или Pub/Sub
  lazyConnect: true, // Не падать при старте, если контейнер еще поднимается
});

redis.on('connect', () => console.log('📊 [Redis]: Connected successfully'));
redis.on('error', (err) => console.error('🚨 [Redis]: Connection error:', err));
