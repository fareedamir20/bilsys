const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/components/ui');
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.tsx')) {
    const full = path.join(dir, file);
    let content = fs.readFileSync(full, 'utf8');
    content = content.replace(/@\/lib\//g, '@/src/lib/');
    content = content.replace(/@\/components\//g, '@/src/components/');
    fs.writeFileSync(full, content);
  }
}
