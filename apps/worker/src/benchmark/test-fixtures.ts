import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Readability } from '@mozilla/readability';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(__dirname, 'fixtures/articles');

const files = readdirSync(articlesDir).filter((f) => f.endsWith('.html'));

console.log(`Testing ${files.length} fixture files for Readability extraction:\n`);

for (const file of files) {
  const html = readFileSync(join(articlesDir, file), 'utf-8');
  const fileSize = (html.length / 1024).toFixed(1);

  try {
    const window = new Window({ url: 'http://localhost/test' });
    window.document.write(html);
    const reader = new Readability(window.document as any);
    const article = reader.parse();

    if (article?.content) {
      const contentLength = article.content.length;
      const textContent = article.textContent?.slice(0, 200).replace(/\s+/g, ' ').trim();
      console.log(`✅ ${file} (${fileSize}KB)`);
      console.log(`   Title: ${article.title || '(none)'}`);
      console.log(`   Content: ${contentLength} chars`);
      console.log(`   Preview: "${textContent}..."\n`);
    } else {
      console.log(`⚠️  ${file} (${fileSize}KB) - No content extracted\n`);
    }
  } catch (err) {
    console.log(`❌ ${file} (${fileSize}KB) - Error: ${err}\n`);
  }
}
