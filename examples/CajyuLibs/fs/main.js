import fs from 'fs';
import path from 'path';

export const CajyuLib = {
  readFile: (p, encoding = 'utf-8') => fs.readFileSync(p, encoding),
  writeFile: (p, content) => fs.writeFileSync(p, content),
  appendFile: (p, content) => fs.appendFileSync(p, content),
  exists: (p) => fs.existsSync(p),
  mkdir: (p, recursive = true) => fs.mkdirSync(p, { recursive }),
  readdir: (p) => fs.readdirSync(p),
  stat: (p) => fs.statSync(p),
  unlink: (p) => fs.unlinkSync(p),
  rmdir: (p) => fs.rmSync(p, { recursive: true, force: true }),
  copy: (src, dest) => fs.copyFileSync(src, dest),
  join: (...parts) => path.join(...parts),
  dirname: (p) => path.dirname(p),
  basename: (p) => path.basename(p),
  extname: (p) => path.extname(p)
};
