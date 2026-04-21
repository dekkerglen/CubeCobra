import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import 'dotenv/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const EMBEDDINGS_DIR = path.join(currentDir, '..', '..', 'data', 'embeddings');
const OUTPUT_DIR = path.join(currentDir, '..', '..', 'data', 'reduced');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const embeddingsPath = path.join(EMBEDDINGS_DIR, 'embeddings.ndjson');

  // --- Pass 1: compute mean ---
  console.log('Pass 1: computing mean...');
  let dim = 0;
  let count = 0;
  let mean: number[] = [];

  const rl1 = readline.createInterface({ input: fs.createReadStream(embeddingsPath), crlfDelay: Infinity });
  for await (const line of rl1) {
    if (line.length === 0) continue;
    const { embedding } = JSON.parse(line);
    if (count === 0) {
      dim = embedding.length;
      mean = new Array(dim).fill(0);
    }
    for (let d = 0; d < dim; d++) mean[d] += embedding[d];
    count += 1;
    if (count % 500000 === 0) console.log(`  ${count} rows...`);
  }

  for (let d = 0; d < dim; d += 1) mean[d] /= count;
  console.log(`${count} embeddings, dimension ${dim}`);

  // --- Pass 2: compute covariance matrix (dim x dim) ---
  console.log('Pass 2: computing covariance matrix...');
  const cov = Array.from({ length: dim }, () => new Float64Array(dim));

  const rl2 = readline.createInterface({ input: fs.createReadStream(embeddingsPath), crlfDelay: Infinity });
  let rowCount = 0;
  for await (const line of rl2) {
    if (line.length === 0) continue;
    const { embedding } = JSON.parse(line);
    const centered = new Float64Array(dim);
    for (let d = 0; d < dim; d++) centered[d] = embedding[d] - mean[d];
    for (let i = 0; i < dim; i += 1) {
      for (let j = i; j < dim; j++) {
        cov[i][j] += centered[i] * centered[j];
      }
    }
    rowCount += 1;
    if (rowCount % 500000 === 0) console.log(`  ${rowCount} rows...`);
  }

  // Normalize and symmetrize
  for (let i = 0; i < dim; i += 1) {
    for (let j = i; j < dim; j++) {
      cov[i][j] /= count - 1;
      cov[j][i] = cov[i][j];
    }
  }

  // --- Compute top 2 eigenvectors via power iteration ---
  console.log('Computing top 2 principal components...');
  const topVectors: Float64Array[] = [];

  for (let pc = 0; pc < 2; pc += 1) {
    let vec = new Float64Array(dim);
    // Random initialization
    for (let d = 0; d < dim; d += 1) vec[d] = Math.random() - 0.5;

    for (let iter = 0; iter < 300; iter += 1) {
      // Matrix-vector multiply
      const newVec = new Float64Array(dim);
      for (let i = 0; i < dim; i += 1) {
        let sum = 0;
        for (let j = 0; j < dim; j++) sum += cov[i][j] * vec[j];
        newVec[i] = sum;
      }

      // Deflate: remove component of previously found eigenvectors
      for (const prev of topVectors) {
        let dot = 0;
        for (let d = 0; d < dim; d += 1) dot += newVec[d] * prev[d];
        for (let d = 0; d < dim; d += 1) newVec[d] -= dot * prev[d];
      }

      // Normalize
      let norm = 0;
      for (let d = 0; d < dim; d += 1) norm += newVec[d] * newVec[d];
      norm = Math.sqrt(norm);
      for (let d = 0; d < dim; d += 1) newVec[d] /= norm;

      vec = newVec;
    }

    topVectors.push(vec);
    console.log(`  PC${pc + 1} found.`);
  }

  // --- Pass 3: project all points and stream-write NDJSON ---
  console.log('Pass 3: projecting to 2D...');
  const outPath = path.join(OUTPUT_DIR, 'reduced.ndjson');
  const outStream = fs.createWriteStream(outPath);
  let written = 0;

  const rl3 = readline.createInterface({ input: fs.createReadStream(embeddingsPath), crlfDelay: Infinity });
  for await (const line of rl3) {
    if (line.length === 0) continue;
    const { deckId, embedding } = JSON.parse(line);

    let x = 0;
    let y = 0;
    for (let d = 0; d < dim; d += 1) {
      const c = embedding[d] - mean[d];
      x += c * topVectors[0][d];
      y += c * topVectors[1][d];
    }

    outStream.write(JSON.stringify({ deckId, x, y }) + '\n');
    written += 1;
    if (written % 500000 === 0) console.log(`  ${written} projected...`);
  }

  await new Promise<void>((resolve) => {
    outStream.on('error', (err) => {
      console.warn('Stream close warning:', err.message);
      resolve();
    });
    outStream.end(() => resolve());
  });

  console.log(`Done. Wrote ${written} 2D points to ${outPath}`);
}

main().catch((err) => {
  console.error('Dimensionality reduction failed:', err);
  process.exit(1);
});
