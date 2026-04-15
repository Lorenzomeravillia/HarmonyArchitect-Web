const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:8000/index.html');
  await page.waitForTimeout(2000);
  
  await page.evaluate(() => {
    document.getElementById('start_overlay').click();
  });
  await page.waitForTimeout(1000);
  
  const result = await page.evaluate(async () => {
    try {
      document.getElementById('play_btn').click();
      await new Promise(r => setTimeout(r, 500));
      return { msg: "Play button clicked cleanly" };
    } catch(err) {
      return { error: err.message, stack: err.stack };
    }
  });
  console.log(result);
  await browser.close();
})();
