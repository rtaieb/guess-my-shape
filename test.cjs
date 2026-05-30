const puppeteer = require('puppeteer-core');

async function runTests() {
  console.log("Starting E2E Tests with 4 players...");
  
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--window-size=800,600']
  });

  const pages = [];
  const roomCode = 'TEST_' + Date.now();

  try {
    for (let i = 1; i <= 4; i++) {
      console.log(`Player ${i} joining...`);
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      pages.push(page);
      
      // Navigate
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
      
      // Join
      await page.type('#playerNameInput', `Player${i}`);
      await page.evaluate(() => document.getElementById('roomCodeInput').value = '');
      await page.type('#roomCodeInput', roomCode);
      await page.click('#btnJoinCreate');
      
      // Wait for lobby to render
      await page.waitForSelector('.players-list');
    }

    console.log("All 4 players joined the lobby. Host is starting game...");
    const hostPage = pages[0];
    
    // Start Game
    await hostPage.waitForSelector('#btnStartGame');
    await hostPage.click('#btnStartGame');
    
    // Everyone should see gameCanvas
    for(let page of pages) {
      await page.waitForSelector('#gameCanvas');
    }
    console.log("Game started successfully!");

    // Check drawing logic (assuming Player 1 is drawer for first round)
    // Actually, drawer is randomized or sequential. Let's find out who the drawer is by checking who has 'disabled' on chat input
    let drawerIndex = -1;
    for(let i=0; i<4; i++) {
      const isDisabled = await pages[i].evaluate(() => document.getElementById('chatInput').hasAttribute('disabled'));
      if(isDisabled) drawerIndex = i;
    }
    console.log(`Drawer is Player ${drawerIndex + 1}`);

    const drawerPage = pages[drawerIndex];
    // Draw a straight line
    console.log("Drawing a line...");
    await drawerPage.mouse.move(100, 100);
    await drawerPage.mouse.down();
    await drawerPage.mouse.move(200, 200);
    await drawerPage.mouse.up();

    // Other players guess the word. First, we need to know the word.
    // The drawer can see it in #wordDisplay
    const wordText = await drawerPage.evaluate(() => document.getElementById('wordDisplay').innerText);
    const word = wordText.replace('Mot: ', '').trim();
    console.log(`Word is: ${word}`);

    // Guessers guess
    let correctCount = 0;
    let guessedPlayers = new Set();
    for(let i=0; i<4; i++) {
      if(i === drawerIndex) continue;
      if(correctCount >= 2) break;
      
      console.log(`Player ${i+1} guessing...`);
      await pages[i].type('#chatInput', word);
      await pages[i].evaluate(() => document.getElementById('btnSendChat').click());
      correctCount++;
      guessedPlayers.add(i);
    }
    
    console.log("Triggering round end...");
    for(let i=0; i<4; i++) {
      if(i !== drawerIndex && !guessedPlayers.has(i)) {
        await pages[i].type('#chatInput', word);
        await pages[i].evaluate(() => document.getElementById('btnSendChat').click());
        break; // Only one more guess needed
      }
    }

    // Wait for roundEnd UI (btnNextRound) on all pages
    console.log("Waiting for next round button...");
    for(let page of pages) {
      await page.waitForSelector('#btnNextRound');
    }
    
    console.log("Round ended! Testing readiness click...");
    // Click btnNextRound
    for(let page of pages) {
      await page.click('#btnNextRound');
    }
    
    console.log("All players ready. Waiting for new round to start...");
    // Game should transition back to playing, so btnNextRound disappears and chat is re-enabled for non-drawers
    await hostPage.waitForFunction(() => !document.getElementById('btnNextRound'), {timeout: 5000});

    console.log("Test Passed! All functionalities work seamlessly.");

  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
