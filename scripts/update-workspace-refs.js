#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to get all package.json files
async function getPackageJsonFiles() {
  const packagesDir = path.join(process.cwd(), 'packages');
  const dirs = await fs.promises.readdir(packagesDir);
  
  return dirs.map(dir => {
    return path.join(packagesDir, dir, 'package.json');
  }).filter(file => {
    return fs.existsSync(file);
  });
}

async function updateWorkspaceRefs() {
  const packageFiles = await getPackageJsonFiles();
  let updatedCount = 0;

  for (const file of packageFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const packageJson = JSON.parse(content);
      let updated = false;

      // Update dependencies
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => {
          if (dep.startsWith('@mindburn/') && packageJson.dependencies[dep] !== 'workspace:*') {
            console.log(`Updating ${dep} in ${file}`);
            packageJson.dependencies[dep] = 'workspace:*';
            updated = true;
          }
        });
      }

      // Update devDependencies
      if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => {
          if (dep.startsWith('@mindburn/') && packageJson.devDependencies[dep] !== 'workspace:*') {
            console.log(`Updating ${dep} in ${file}`);
            packageJson.devDependencies[dep] = 'workspace:*';
            updated = true;
          }
        });
      }

      // Update peerDependencies
      if (packageJson.peerDependencies) {
        Object.keys(packageJson.peerDependencies).forEach(dep => {
          if (dep.startsWith('@mindburn/') && packageJson.peerDependencies[dep] !== 'workspace:*') {
            console.log(`Updating ${dep} in ${file}`);
            packageJson.peerDependencies[dep] = 'workspace:*';
            updated = true;
          }
        });
      }

      if (updated) {
        updatedCount++;
        await fs.promises.writeFile(file, JSON.stringify(packageJson, null, 2));
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  console.log(`Updated ${updatedCount} package.json files.`);
}

updateWorkspaceRefs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 