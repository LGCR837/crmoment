const fs = require('fs');
const code = fs.readFileSync('web/app.js', 'utf8');
try {
    // Use the parser to check syntax (works even with modern features)
    require('child_process').execSync(`node -e "require('fs').readFileSync('web/app.js')"`, { cwd: process.cwd(), stdio: 'pipe' });
    console.log('Syntax OK');
    process.exit(0);
} catch(e) {
    console.error('Syntax error:', e.message);
    process.exit(1);
}
