import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('test-results', {recursive:true});
const addressFile = resolve('test-results/offline-address.txt');
await rm(addressFile, {force:true});
const app = spawn(resolve('release/GonScan.exe'), ['--test-address', addressFile], {windowsHide:true});
let browser;
try {
  let address;
  for (let i=0;i<100;i++) {
    try { address = await readFile(addressFile,'utf8'); break; } catch { await new Promise(r=>setTimeout(r,100)); }
  }
  assert.ok(address, 'App did not start');
  browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({serviceWorkers:'block'});
  const external = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === address) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  await page.goto(address);
  assert.equal(await page.getByRole('button',{name:'Scan giấy',exact:true}).getAttribute('aria-pressed'),'true');
  const data = await page.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=600;c.height=800;
    const ctx=c.getContext('2d');ctx.fillStyle='#dcd6bb';ctx.fillRect(0,0,600,800);
    ctx.fillStyle='#222';ctx.font='30px sans-serif';ctx.fillText('OFFLINE SCAN',70,150);
    ctx.strokeStyle='#b32a37';ctx.lineWidth=4;ctx.strokeRect(300,500,120,100);
    return c.toDataURL().split(',')[1];
  });
  for (const mode of ['quick','normal']) {
    if (mode==='normal') { await page.getByRole('button',{name:'Xóa trang 1'}).click(); await page.getByRole('button',{name:/Scan bình thường/}).click(); }
    await page.locator('input[type=file]').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
    if(mode==='normal') await page.getByRole('button',{name:'Xác nhận',exact:true}).click();
    await page.locator('.status.done').waitFor({timeout:90000});
    for (const format of ['PDF','JPG']) {
      const pending = page.waitForEvent('download');
      await page.getByRole('button',{name:`Tải ${format}`}).click();
      const download = await pending;
      assert.equal(download.suggestedFilename(),`tai-lieu.${format.toLowerCase()}`);
      const path=resolve(`test-results/offline-${mode}.${format.toLowerCase()}`);
      await download.saveAs(path);
      const bytes=await readFile(path);
      if(format==='PDF') assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      else assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);
    }
  }
  assert.deepEqual(external,[]);
  console.log('PASS: packaged EXE; both scan modes; PDF/JPG; zero external requests, all non-local requests blocked.');
} finally { await browser?.close(); app.kill(); }
