import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';
import { setup, teardown, type BenchmarkConfig } from './harness';
import { startMockServer } from './mock-server';
import { printResults, runBenchmark, type BenchmarkResult } from './runner';

const DEFAULT_FEEDS = 50;
const DEFAULT_ARTICLES = 30;
const DEFAULT_PORT = 9998;
const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:3000';

interface CliOptions {
  feeds: number;
  articles: number;
  delay: number;
  json: boolean;
  output?: string;
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      feeds: { type: 'string', short: 'f', default: String(DEFAULT_FEEDS) },
      articles: { type: 'string', short: 'a', default: String(DEFAULT_ARTICLES) },
      delay: { type: 'string', short: 'd', default: '0' },
      json: { type: 'boolean', short: 'j', default: false },
      output: { type: 'string', short: 'o' },
    },
    allowPositionals: false,
  });

  return {
    feeds: parseInt(values.feeds ?? String(DEFAULT_FEEDS), 10),
    articles: parseInt(values.articles ?? String(DEFAULT_ARTICLES), 10),
    delay: parseInt(values.delay ?? '0', 10),
    json: values.json ?? false,
    output: values.output,
  };
}

function saveResults(result: BenchmarkResult, outputPath?: string): string {
  const resultsDir = 'benchmark-results';
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = outputPath ?? join(resultsDir, `${timestamp}.json`);

  writeFileSync(filename, JSON.stringify(result, null, 2));
  return filename;
}

async function main() {
  const options = parseCliArgs();

  console.log('Worker Performance Benchmark');
  console.log('════════════════════════════\n');
  console.log('Config:');
  console.log(`  Feeds: ${options.feeds}`);
  console.log(`  Articles per feed: ${options.articles}`);
  console.log(`  Mock server: http://localhost:${DEFAULT_PORT}`);
  console.log(`  API URL: ${DEFAULT_API_URL}`);
  if (options.delay > 0) {
    console.log(`  Simulated delay: ${options.delay}ms`);
  }
  console.log('');

  const mockServer = startMockServer({
    port: DEFAULT_PORT,
    articlesPerFeed: options.articles,
    delay: options.delay,
  });

  const config: BenchmarkConfig = {
    apiUrl: DEFAULT_API_URL,
    feedCount: options.feeds,
    articlesPerFeed: options.articles,
    mockServerPort: DEFAULT_PORT,
  };

  let ctx: Awaited<ReturnType<typeof setup>> | undefined;
  try {
    ctx = await setup(config);

    console.log('\nRunning benchmark...\n');
    const result = await runBenchmark(ctx);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResults(result);
    }

    const savedPath = saveResults(result, options.output);
    console.log(`\nResults saved to: ${savedPath}`);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  } finally {
    mockServer.close();
    if (ctx) {
      await teardown(ctx.userId);
    }
  }
}

main();
