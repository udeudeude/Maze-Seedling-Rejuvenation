// Browser-level acceptance test. Run in CI after installing Playwright Chromium.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep))throw Error('Denied');
    if(!(await stat(target)).isFile())throw Error('Not a file');
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});
    res.end(await readFile(target));
  }catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#grid .tile').first().waitFor();
  assert.equal(await page.locator('#grid .tile').count(),324);
  assert.match(await page.locator('#pathStatus').textContent(),/Start to exit/);

  // Place an encounter and customize it.
  await page.locator('[data-brush="treasure"]').click();
  await page.locator('#grid .tile').nth(21).click();
  await page.locator('[data-screen="decorate"]').click();
  await page.locator('#objectNote').fill('Find the secret key.');
  await page.locator('#saveNoteBtn').click();
  assert.equal(await page.locator('#objectNote').inputValue(),'Find the secret key.');

  // Both renderers must paint actual frames.
  await page.locator('[data-screen="explore"]').click();
  await page.waitForTimeout(170);
  assert.ok(await page.locator('#view').evaluate(e=>e.width>0&&e.height>0));
  await page.locator('[data-screen="vr"]').click();
  await page.waitForTimeout(170);
  assert.ok(await page.locator('#stereo').evaluate(e=>e.width>0&&e.height>0));

  // Exercise photograph upload, wood/floor sampling and preview.
  await page.locator('[data-screen="scan"]').click();
  const png=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=240;c.height=240;const g=c.getContext('2d');
    g.fillStyle='#e3d2b8';g.fillRect(0,0,240,240);
    g.fillStyle='#705334';g.fillRect(60,60,60,25);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photoFile').setInputFiles({name:'physical-maze.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.getElementById('photoCanvas').width===240);
  const tap=async(x,y)=>page.locator('#photoCanvas').evaluate((element,coord)=>{
    const r=element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,clientX:r.left+r.width*coord[0],clientY:r.top+r.height*coord[1]
    }));
  },[x,y]);
  await page.locator('#wallSampleBtn').click();await tap(.35,.31);
  await page.locator('#floorSampleBtn').click();await tap(.8,.8);
  await page.locator('#detectBtn').click();
  assert.equal(await page.locator('#applyScanBtn').isDisabled(),false);
  await page.locator('#applyScanBtn').click();
  assert.equal(await page.locator('#grid .tile').count(),324);
  assert.equal(await page.locator('#grid .tile.start').count(),1);
  assert.equal(await page.locator('#grid .tile.exit').count(),1);

  await page.reload();
  await page.locator('#grid .tile').first().waitFor();
  assert.equal(await page.locator('#grid .tile').count(),324);
  assert.deepEqual(failures,[],'No unhandled browser exceptions');
  console.log('PASS: editor, story, renderers, scanning, auto-save and reload');
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
