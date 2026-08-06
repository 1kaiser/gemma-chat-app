import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  headless: false,
  args: [
    '--ozone-platform=x11',
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
  ],
});

const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await ctx.newPage();

page.on('dialog', d => { console.log('Dialog dismissed:', d.message().slice(0, 120)); d.dismiss(); });
await page.addInitScript(() => localStorage.clear());

console.log('Navigating...');
await page.goto('http://localhost:3001/gemma-chat-app/', { waitUntil: 'networkidle' });

console.log('Waiting for model ready (up to 3 min)...');
await page.waitForFunction(
  () => document.getElementById('status-text')?.textContent.trim().startsWith('Ready'),
  null,
  { timeout: 600_000 }
);
console.log('Ready! device:', await page.$eval('#device-info', e => e.textContent));

// Reset history to empty
await page.click('#clear-btn');
await page.waitForTimeout(400);

async function sendMessage(text, outFile) {
  await page.waitForSelector('#user-input:not([disabled])', { timeout: 10_000 });
  await page.fill('#user-input', text);
  await page.click('#send-btn');

  // Wait for generation to start
  await page.waitForFunction(
    () => {
      const t = document.getElementById('status-text')?.textContent.trim() ?? '';
      return t.startsWith('Generating') || t.startsWith('Error');
    },
    null,
    { timeout: 15_000 }
  );

  // Wait for terminal state (Ready or Error)
  await page.waitForFunction(
    () => {
      const t = document.getElementById('status-text')?.textContent.trim() ?? '';
      return t.startsWith('Ready') || t.startsWith('Error');
    },
    null,
    { timeout: 600_000 }
  );

  // Scroll to top of chat to capture beginning of response
  await page.evaluate(() => {
    document.getElementById('chat-container').scrollTop = 0;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outFile + '-top.png' });

  // Scroll to bottom to show end + status bar
  await page.evaluate(() => {
    const c = document.getElementById('chat-container');
    c.scrollTop = c.scrollHeight;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: outFile });

  const status = await page.$eval('#status-text', e => e.textContent);
  const device  = await page.$eval('#device-info',  e => e.textContent);
  console.log('Saved:', outFile, '| status:', status, '|', device);
  return status.startsWith('Ready');
}

const title = await page.$eval('h1', e => e.textContent);
console.log('App:', title);

if (title.includes('4')) {
  // Radeon 780M loses WebGPU context after first OrtRun error on second turn;
  // capture two distinct prompts in a single turn by asking a compound question.
  const ok1 = await sendMessage('What is Mixture-of-Experts (MoE) and why does Gemma 4 use it? Give 2 real-world browser-AI use cases.', 'screenshots/gemma4-e2b-real-1.png');
  if (ok1) {
    await sendMessage('How does quantization reduce model size? Explain q4f16.', 'screenshots/gemma4-e2b-real-2.png');
  }
} else {
  const ok1 = await sendMessage('Write a Python function that reverses a string without using slicing.', 'screenshots/gemma3-1b-real-1.png');
  if (ok1) {
    await sendMessage('What is the difference between a list and a tuple in Python?', 'screenshots/gemma3-1b-real-2.png');
  } else {
    console.log('Skipping second message due to error on first.');
  }
}

await browser.close();
console.log('Done.');
