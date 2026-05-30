const fs = require('fs');
let txt = fs.readFileSync('src/main.ts', 'utf8');
txt = txt.replace(/\\`/g, '`');
fs.writeFileSync('src/main.ts', txt);
