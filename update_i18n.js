const fs = require('fs');

let file = fs.readFileSync('src/i18n.ts', 'utf8');

// We need to inject new translations into propTableau
// Let's do it cleanly by replacing the propTableau object in English and Portuguese.
// This is fragile if we don't know the exact string, so I'll just rewrite the file.
