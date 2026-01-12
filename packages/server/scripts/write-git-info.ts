const { execSync } = require('child_process');
const fs = require('fs');

//Include the GIT_COMMIT into our src so it gets compiled into the build
const OUT_FILE = 'src/serverutils/git.ts';

// Try to get from CodeBuild environment first
let commitHash = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION;

// Fall back to git command if not in CodeBuild
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    console.warn('Git command failed (not a git repository or git not available)');
    commitHash = 'unknown';
  }
}

const content = `export const GIT_COMMIT = '${commitHash}';\n`;
try {
  fs.writeFileSync(OUT_FILE, content);
  console.log(`Git info written to ${OUT_FILE}: ${commitHash}`);
} catch (error) {
  console.error(`Failed to write git info to ${OUT_FILE}:`, error);
  process.exit(1);
}
