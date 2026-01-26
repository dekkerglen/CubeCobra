import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

const getGitInfo = () => {
  try {
    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const timestamp = new Date().toISOString();

    return {
      commitHash,
      branch,
      timestamp,
    };
  } catch (error) {
    console.error('Error getting git info:', error);
    return {
      commitHash: 'unknown',
      branch: 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
};

const gitInfo = getGitInfo();
const outputPath = path.join(__dirname, '../src/git-info.ts');

const content = `// This file is auto-generated. Do not edit manually.
export const gitInfo = ${JSON.stringify(gitInfo, null, 2)};
`;

writeFileSync(outputPath, content);
console.log('Git info written to', outputPath);
