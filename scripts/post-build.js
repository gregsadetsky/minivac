import { mkdir, unlink, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

async function reorganize() {
  // Move each extra page to its own directory: page.html -> page/index.html
  for (const page of ['simulator', 'tetris', 'tetris-debug', 'relays', 'wall']) {
    const pageDir = join(distDir, page);
    await mkdir(pageDir, { recursive: true });

    const pageHtml = join(distDir, `${page}.html`);
    const pageIndex = join(pageDir, 'index.html');

    // Read the content and update asset paths to go up one level
    let content = await readFile(pageHtml, 'utf-8');
    content = content.replace(/href="\//g, 'href="../');
    content = content.replace(/src="\//g, 'src="../');

    await writeFile(pageIndex, content);
    await unlink(pageHtml);

    console.log(`✓ Reorganized build output: ${page}.html → ${page}/index.html`);
  }
}

reorganize().catch(console.error);
