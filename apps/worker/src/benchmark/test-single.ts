import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Readability } from '@mozilla/readability';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];

if (!file) {
  console.log('Usage: bun run test-single.ts <filename>');
  process.exit(1);
}

const path = join(__dirname, 'fixtures/articles', file);
console.log(`Testing: ${file}`);

const html = readFileSync(path, 'utf-8');
console.log(`Size: ${(html.length / 1024).toFixed(1)}KB`);

const window = new Window({ url: 'http://localhost/test' });
window.document.write(html);
console.log('Window created');

const reader = new Readability(window.document as any);
console.log('Readability created');

const article = reader.parse();
console.log('Parsed');

if (article?.content) {
  console.log(`Title: ${article.title}`);
  console.log(`Content: ${article.content.length} chars`);
  console.log(`Preview: ${article.textContent?.slice(0, 150)}...`);
} else {
  console.log('No content extracted');
}
