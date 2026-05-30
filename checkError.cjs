const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testBrowser() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new"
  });
  
  const page = await browser.newPage();
  
  // Listen to all console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    } else {
      console.log('BROWSER LOG:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.message);
  });

  console.log("Navigating to local game...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log("Filling player name...");
  await page.type('#playerNameInput', 'TestUser');
  
  console.log("Clicking join button...");
  await page.click('#btnJoinCreate');
  
  console.log("Waiting 2 seconds to see if an error occurs...");
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
}

testBrowser().catch(e => console.error("Test script failed:", e));
