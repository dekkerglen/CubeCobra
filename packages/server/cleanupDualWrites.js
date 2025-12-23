/**
 * Script to remove dual write logic and model imports from all DAOs
 */

const fs = require('fs');
const path = require('path');

const daoDir = path.join(__dirname, 'src', 'dynamo', 'dao');

// Get all DAO files
const daoFiles = fs.readdirSync(daoDir).filter((f) => f.endsWith('.ts') && f !== 'BaseDynamoDao.ts');

console.log(`Found ${daoFiles.length} DAO files to process\n`);

let totalChanges = 0;

daoFiles.forEach((file) => {
  const filePath = path.join(daoDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileChanges = 0;

  // Remove model imports (../models/*)
  const modelImportRegex = /^import .+ from ['"]\.\.\/models\/.+['"];?\s*$/gm;
  const modelImports = content.match(modelImportRegex);
  if (modelImports) {
    console.log(`${file}: Removing ${modelImports.length} model import(s)`);
    content = content.replace(modelImportRegex, '');
    fileChanges += modelImports.length;
  }

  // Remove dualWriteEnabled property declaration
  if (content.includes('private readonly dualWriteEnabled: boolean')) {
    console.log(`${file}: Removing dualWriteEnabled property`);
    content = content.replace(/\s*private readonly dualWriteEnabled: boolean;?\s*/g, '\n');
    fileChanges++;
  }

  // Remove dualWriteEnabled from constructor parameter
  if (content.includes('dualWriteEnabled: boolean')) {
    console.log(`${file}: Removing dualWriteEnabled from constructor`);
    content = content.replace(/,?\s*dualWriteEnabled: boolean\s*=\s*false/g, '');
    fileChanges++;
  }

  // Remove dualWriteEnabled assignment in constructor
  if (content.includes('this.dualWriteEnabled')) {
    console.log(`${file}: Removing dualWriteEnabled assignment`);
    content = content.replace(/\s*this\.dualWriteEnabled = dualWriteEnabled;?\s*/g, '\n');
    fileChanges++;
  }

  // Remove dual write conditional blocks - this is the tricky part
  // We need to find "if (this.dualWriteEnabled)" blocks and remove them, keeping the else content
  const dualWriteIfRegex = /if \(this\.dualWriteEnabled\) \{[\s\S]*?\n\s*\}/g;
  const dualWriteMatches = content.match(dualWriteIfRegex);

  if (dualWriteMatches) {
    console.log(`${file}: Found ${dualWriteMatches.length} dual write conditional block(s) - MANUAL REVIEW NEEDED`);
    // We'll mark these files for manual review rather than auto-removing
    fileChanges += dualWriteMatches.length;
  }

  // Update DUAL WRITE comments in documentation
  content = content.replace(/DUAL WRITE MODE:[\s\S]*?when dualWriteEnabled flag is set\.\s*/g, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: Made ${fileChanges} change(s)\n`);
    totalChanges += fileChanges;
  }
});

console.log(`\n=== Summary ===`);
console.log(`Total changes made: ${totalChanges}`);
console.log(`\nNOTE: Dual write conditional blocks (if (this.dualWriteEnabled)) need manual review.`);
console.log(`Files that still contain these blocks should be reviewed to extract the non-dual-write logic.`);
