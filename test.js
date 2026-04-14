import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-gl=swiftshader' // Try to enable WebGL for face-api
    ]
  });
  const context = await browser.newContext();
  await context.grantPermissions(['camera']);
  const page = await context.newPage();

  page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR LOG:', error));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  await page.click('#startBtn');
  await page.waitForTimeout(4000);

  await browser.close();
})();
