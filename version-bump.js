const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, 'package.json');

try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const version = packageJson.version;
    const versionParts = version.split('.').map(Number);
    versionParts[2]++; // Increment patch version
    packageJson.version = versionParts.join('.');
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log(`Version updated to ${packageJson.version}`);
} catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
}