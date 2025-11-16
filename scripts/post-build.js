import { mkdir, unlink, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

async function reorganize() {
  // Create simulator directory
  const simulatorDir = join(distDir, 'simulator');
  await mkdir(simulatorDir, { recursive: true });

  // Move simulator.html to simulator/index.html
  const simulatorHtml = join(distDir, 'simulator.html');
  const simulatorIndex = join(simulatorDir, 'index.html');

  // Read the content and update asset paths
  let content = await readFile(simulatorHtml, 'utf-8');

  // Update asset paths to go up one level (from /assets/... to ../assets/...)
  content = content.replace(/href="\//g, 'href="../');
  content = content.replace(/src="\//g, 'src="../');

  // Write to new location
  await writeFile(simulatorIndex, content);

  // Remove old file
  await unlink(simulatorHtml);

  console.log('✓ Reorganized build output: simulator.html → simulator/index.html');
}

reorganize().catch(console.error);
