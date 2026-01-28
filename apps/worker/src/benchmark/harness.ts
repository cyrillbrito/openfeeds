import { feeds, getDb } from '@repo/db';
import { createAuthClient } from 'better-auth/client';
import { eq } from 'drizzle-orm';

const BENCHMARK_EMAIL_DOMAIN = '@benchmark-test.local';

export interface BenchmarkConfig {
  apiUrl: string;
  feedCount: number;
  articlesPerFeed: number;
  mockServerPort: number;
}

export interface BenchmarkContext {
  userId: string;
  feedIds: string[];
  mockServerUrl: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function getArticleCount(index: number): number {
  const min = 4;
  const max = 20;
  const range = max - min;
  const offset = (index * 7) % 17;
  return min + Math.round((offset / 16) * range);
}

export async function setup(config: BenchmarkConfig): Promise<BenchmarkContext> {
  const { apiUrl, feedCount, mockServerPort } = config;
  const mockServerUrl = `http://localhost:${mockServerPort}`;

  const authClient = createAuthClient({ baseURL: apiUrl });

  const email = `benchmark-${Date.now()}${BENCHMARK_EMAIL_DOMAIN}`;
  const password = email;

  console.log(`Creating benchmark user via API: ${email}`);
  const result = await authClient.signUp.email({
    email,
    password,
    name: 'Benchmark User',
  });

  if (result.error) {
    throw new Error(`Failed to create user: ${result.error.message}`);
  }

  const userId = result.data?.user?.id;
  if (!userId) {
    throw new Error('User created but no ID returned');
  }

  console.log(`User created: ${userId}`);

  console.log(`Seeding ${feedCount} feeds with varying article counts...`);
  const db = getDb();
  const feedIds: string[] = [];
  const now = new Date();
  const articleCounts: number[] = [];

  for (let i = 0; i < feedCount; i++) {
    const feedId = generateId();
    const articleCount = getArticleCount(i);
    feedIds.push(feedId);
    articleCounts.push(articleCount);

    await db.insert(feeds).values({
      id: feedId,
      userId,
      title: `Benchmark Feed ${i + 1}`,
      description: `Test feed for benchmarking`,
      url: `${mockServerUrl}/feed/${feedId}`,
      feedUrl: `${mockServerUrl}/feed/${feedId}.xml?articles=${articleCount}`,
      createdAt: now,
    });
  }

  const min = Math.min(...articleCounts);
  const max = Math.max(...articleCounts);
  const avg = Math.round(articleCounts.reduce((a, b) => a + b, 0) / articleCounts.length);
  console.log(`Seeded ${feedIds.length} feeds (articles: min=${min}, max=${max}, avg=${avg})`);

  return {
    userId,
    feedIds,
    mockServerUrl,
  };
}

export async function teardown(userId: string): Promise<void> {
  console.log(`Cleaning up benchmark user ${userId}...`);

  const db = getDb();
  const user = db._.fullSchema.user;

  // Delete user (cascades to feeds, articles, etc via FK)
  await db.delete(user).where(eq(user.id, userId));

  console.log('Cleanup complete');
}
