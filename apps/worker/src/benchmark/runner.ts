import { enqueueFeedSync, getRedisConnection, QUEUE_NAMES } from '@repo/domain';
import { QueueEvents } from 'bullmq';
import type { BenchmarkContext } from './harness';
import { formatMs, formatRate, mean, percentile, stddev } from './stats';

interface JobTiming {
  enqueuedAt: number;
  completedAt?: number;
  latency?: number;
  failed?: boolean;
  error?: string;
}

export interface BenchmarkResult {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalTimeMs: number;
  jobsPerSecond: number;
  latencies: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    stddev: number;
  };
  errors: Array<{ jobId: string; error: string }>;
}

const TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompletion(
  jobTimings: Map<string, JobTiming>,
  expectedCount: number,
): Promise<void> {
  const startWait = Date.now();

  while (Date.now() - startWait < TIMEOUT_MS) {
    const completed = [...jobTimings.values()].filter(
      (t) => t.completedAt !== undefined || t.failed,
    ).length;

    if (completed >= expectedCount) {
      return;
    }

    await sleep(100);
  }

  throw new Error(`Benchmark timed out after ${TIMEOUT_MS}ms`);
}

function computeResults(jobTimings: Map<string, JobTiming>, totalTimeMs: number): BenchmarkResult {
  const completed: number[] = [];
  const errors: Array<{ jobId: string; error: string }> = [];
  let failedCount = 0;

  for (const [jobId, timing] of jobTimings) {
    if (timing.failed) {
      failedCount++;
      errors.push({ jobId, error: timing.error ?? 'Unknown error' });
    } else if (timing.latency !== undefined) {
      completed.push(timing.latency);
    }
  }

  return {
    totalJobs: jobTimings.size,
    completedJobs: completed.length,
    failedJobs: failedCount,
    totalTimeMs,
    jobsPerSecond: (completed.length / totalTimeMs) * 1000,
    latencies: {
      mean: mean(completed),
      p50: percentile(completed, 50),
      p95: percentile(completed, 95),
      p99: percentile(completed, 99),
      stddev: stddev(completed),
    },
    errors,
  };
}

export function printResults(result: BenchmarkResult): void {
  console.log('\n');
  console.log('Worker Performance Benchmark');
  console.log('════════════════════════════\n');

  console.log('┌─────────────────┬──────────────┐');
  console.log('│ Metric          │ Value        │');
  console.log('├─────────────────┼──────────────┤');
  console.log(`│ Total jobs      │ ${String(result.totalJobs).padEnd(12)} │`);
  console.log(`│ Completed       │ ${String(result.completedJobs).padEnd(12)} │`);
  console.log(`│ Failed          │ ${String(result.failedJobs).padEnd(12)} │`);
  console.log(`│ Total time      │ ${formatMs(result.totalTimeMs).padEnd(12)} │`);
  console.log(`│ Jobs/sec        │ ${formatRate(result.jobsPerSecond).padEnd(12)} │`);
  console.log(`│ Mean latency    │ ${formatMs(result.latencies.mean).padEnd(12)} │`);
  console.log(`│ p50 latency     │ ${formatMs(result.latencies.p50).padEnd(12)} │`);
  console.log(`│ p95 latency     │ ${formatMs(result.latencies.p95).padEnd(12)} │`);
  console.log(`│ p99 latency     │ ${formatMs(result.latencies.p99).padEnd(12)} │`);
  console.log(`│ Std deviation   │ ${formatMs(result.latencies.stddev).padEnd(12)} │`);
  console.log('└─────────────────┴──────────────┘');

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const { jobId, error } of result.errors.slice(0, 10)) {
      console.log(`  - ${jobId}: ${error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }
}

export async function runBenchmark(ctx: BenchmarkContext): Promise<BenchmarkResult> {
  const jobTimings = new Map<string, JobTiming>();
  const queueEvents = new QueueEvents(QUEUE_NAMES.SINGLE_FEED_SYNC, {
    connection: getRedisConnection(),
  });

  queueEvents.on('completed', ({ jobId }) => {
    const timing = jobTimings.get(jobId);
    if (timing) {
      timing.completedAt = Date.now();
      timing.latency = timing.completedAt - timing.enqueuedAt;
    }
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    const timing = jobTimings.get(jobId);
    if (timing) {
      timing.failed = true;
      timing.error = failedReason;
      timing.completedAt = Date.now();
    }
  });

  console.log(`Enqueueing ${ctx.feedIds.length} feed sync jobs...`);
  const startTime = Date.now();

  for (const feedId of ctx.feedIds) {
    const job = await enqueueFeedSync(ctx.userId, feedId);
    if (job.id) {
      jobTimings.set(job.id, { enqueuedAt: Date.now() });
    }
  }

  console.log('Waiting for jobs to complete...');
  await waitForCompletion(jobTimings, ctx.feedIds.length);

  const totalTime = Date.now() - startTime;

  await queueEvents.close();

  return computeResults(jobTimings, totalTime);
}
