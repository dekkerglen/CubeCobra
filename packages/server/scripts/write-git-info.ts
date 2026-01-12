const { execSync } = require('child_process');
const fs = require('fs');

//Include the GIT_COMMIT into our src so it gets compiled into the build
const OUT_FILE = 'src/serverutils/git.ts';
try {
  // Try to get from CodeBuild environment first
  let commitHash = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION;
  
  // Fall back to git command if not in CodeBuild
  if (!commitHash) {
    commitHash = execSync('git rev-parse HEAD').toString().trim();
  }

  const content = `export const GIT_COMMIT = '${commitHash ?? ''}';\n`;
  fs.writeFileSync(OUT_FILE, content);
  console.log(`Git info written to ${OUT_FILE}`);
} catch (error) {
  console.warn('Could not get Git info, using fallback');
  const content = `export const GIT_COMMIT = 'unknown';\n`;
  fs.writeFileSync(OUT_FILE, content);
  console.log(`Fallback git info written to ${OUT_FILE}`);
}
