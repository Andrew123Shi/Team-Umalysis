import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicIcon = path.join(root, 'public', 'icon.ico');
const publicFavicon = path.join(root, 'public', 'favicon.ico');

if (!fs.existsSync(publicIcon)) {
    console.warn('sync-icon: public/icon.ico not found');
    process.exit(0);
}

fs.copyFileSync(publicIcon, publicFavicon);
