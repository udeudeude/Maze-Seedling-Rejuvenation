import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=new URL('../',import.meta.url);
const file=name=>fs.readFileSync(new URL(name,root),'utf8');

test('site entry points and cached resources exist',()=>{
  const index=file('index.html'),sw=file('sw.js');
  for(const asset of ['style.css','src/core.js','src/app.js','src/scanner.js','src/renderer.js','src/audio.js','manifest.webmanifest','icon.svg']){
    assert.ok(fs.existsSync(new URL(asset,root)),asset);
    assert.ok(sw.includes('./'+asset),asset+' must be cached for offline use');
  }
  assert.ok(index.includes('type="module" src="./src/app.js"'));
  assert.ok(index.includes('name="viewport"'));
});
test('all JavaScript DOM IDs exist in the HTML',()=>{
  const index=file('index.html'),app=file('src/app.js');
  const ids=new Set([...index.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  for(const m of app.matchAll(/\$\('([^']+)'\)/g)){
    assert.ok(ids.has(m[1]),'Missing ID #'+m[1]);
  }
});
test('check syntax of each browser module and service worker',()=>{
  for(const fileName of ['src/core.js','src/scanner.js','src/renderer.js','src/audio.js','src/app.js','sw.js']){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',path.resolve(new URL(fileName,root).pathname)],{encoding:'utf8'}),
      fileName+' should parse cleanly');
  }
});
test('shared URLs contain only cells and never custom notes',()=>{
  const app=file('src/app.js');
  assert.match(app,/function shareCode\(/);
  assert.match(app,/function fromShareCode\(/);
  assert.match(app,/const packed=\[board.size,THEMES.indexOf\(board.theme\),board.cells/);
});
