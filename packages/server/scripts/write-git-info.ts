const { execSync } = require('child_process');
const fs = require('fs');

//Include the GIT_COMMIT into our src so it gets compiled into the build
const OUT_FILE = 'src/serverutils/git.ts';
try {
  const commitHash = execSync('git rev-parse HEAD').toString().trim();

  const content = `export const GIT_COMMIT = '${commitHash ?? ''}';\n`;
  fs.writeFileSync(OUT_FILE, content);
  console.log(`Git info written to ${OUT_FILE}`);
} catch {
  console.error('Error getting Git info');
  process.exit(1);
}
