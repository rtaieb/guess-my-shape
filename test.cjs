const puppeteer = require('puppeteer-core');

async function runTests() {
  console.log("Starting E2E Tests with 4 players...");
  
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--window-size=800,600']
  });

  const pages = [];
  const roomCode = 'T' + Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    for (let i = 1; i <= 4; i++) {
      console.log(`Player ${i} joining...`);
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      pages.push(page);
      
      // Navigate
      await page.goto('http://localhost:5173/guess-my-shape/', { waitUntil: 'networkidle0' });
      
      // Join
      await page.type('#playerNameInput', `Player${i}`);
      await page.evaluate(() => document.getElementById('roomCodeInput').value = '');
      await page.type('#roomCodeInput', roomCode);
      await page.click('#btnJoinCreate');
      
      // Wait for lobby to render
      await page.waitForSelector('.players-list');
    }

    console.log("All 4 players joined the lobby. Host is configuring game...");
    const hostPage = pages[0];
    
    // Set matchTurns to 1
    await hostPage.waitForFunction(() => document.getElementById('settingMatchTurns') !== null, {timeout: 30000});
    await new Promise(r => setTimeout(r, 1000));
    await hostPage.evaluate(() => {
      document.getElementById('settingMatchTurns').value = '1';
      document.getElementById('settingMatchTurns').dispatchEvent(new Event('change'));
    });
    
    // Start Game
    await hostPage.waitForSelector('#btnStartGame');
    await hostPage.click('#btnStartGame');
    
    // Everyone should see gameCanvas
    for(let page of pages) {
      await page.waitForSelector('#gameCanvas');
    }
    console.log("Game started successfully!");

    // Play 4 rounds (since 4 players and matchTurns = 1)
    for (let round = 1; round <= 4; round++) {
      console.log(`--- Round ${round} ---`);
      
      let drawerIndex = -1;
      for(let i=0; i<4; i++) {
        await pages[i].waitForFunction(() => {
          const input = document.getElementById('chatInput');
          return input !== null;
        }, {timeout: 10000});
        // small wait to ensure UI updates
        await new Promise(r => setTimeout(r, 500));
        const isDisabled = await pages[i].evaluate(() => document.getElementById('chatInput').hasAttribute('disabled'));
        if(isDisabled) drawerIndex = i;
      }
      
      if (drawerIndex === -1) {
        throw new Error("Could not find drawer!");
      }
      console.log(`Drawer is Player ${drawerIndex + 1}`);

      const drawerPage = pages[drawerIndex];
      
      // Wait for choosing modal and pick a word
      console.log("Choosing a word...");
      await drawerPage.waitForSelector('.btn-choose-word', {visible: true});
      await drawerPage.click('.btn-choose-word');
      
      // Wait for word to be displayed
      await drawerPage.waitForFunction(() => {
        const text = document.getElementById('wordDisplay').innerText;
        return text && !text.includes('---');
      });

      // Draw a straight line
      console.log("Drawing a line...");
      await drawerPage.mouse.move(100, 100);
      await drawerPage.mouse.down();
      await drawerPage.mouse.move(200, 200);
      await drawerPage.mouse.up();

      // Other players guess the word. First, we need to know the word.
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
        await new Promise(r => setTimeout(r, 500));
        correctCount++;
        guessedPlayers.add(i);
      }
      
      console.log("Triggering round end...");
      for(let i=0; i<4; i++) {
        if(i !== drawerIndex && !guessedPlayers.has(i)) {
          await pages[i].type('#chatInput', word);
          await pages[i].evaluate(() => document.getElementById('btnSendChat').click());
          await new Promise(r => setTimeout(r, 500));
          break; // Only one more guess needed
        }
      }

      if (round < 4) {
        // Wait for roundEnd UI (btnNextRound) on all pages
        console.log("Waiting for next round button...");
        for(let page of pages) {
          await page.waitForSelector('#btnNextRound', {visible: true});
        }
        
        console.log("Round ended! Testing readiness click...");
        // Click btnNextRound
        for(let page of pages) {
          await page.click('#btnNextRound');
          await new Promise(r => setTimeout(r, 500));
        }

        console.log("All players ready. Waiting for new round to start...");
        await hostPage.waitForFunction(() => !document.getElementById('btnNextRound'), {timeout: 5000});
      } else {
        console.log("Match ended! Waiting for podium...");
        for(let page of pages) {
          await page.waitForSelector('.podium-overlay', {visible: true, timeout: 5000});
        }
        
        console.log("Closing podium on player 2 to check canvas...");
        await pages[1].click('#btnClosePodium');
        await pages[1].waitForFunction(() => {
          const el = document.getElementById('podiumOverlay');
          return el && el.style.display === 'none';
        });
        const strokesText = await pages[1].evaluate(() => document.getElementById('strokesDisplay').innerText);
        if (strokesText.includes('Traits: 0 /')) {
          throw new Error("BUG: Canvas was reset, strokes are 0!");
        }
        console.log("Canvas is preserved: " + strokesText);
        
        console.log("Podium displayed. Clicking Nouvelle Manche...");
        await hostPage.waitForSelector('.btn-return-lobby', {visible: true});
        await hostPage.click('.btn-return-lobby');
        
        console.log("Waiting for host to return to lobby...");
        await hostPage.waitForSelector('.lobby-container', {visible: true});
        
        console.log("Verifying other players are still on podium...");
        for(let i=2; i<4; i++) {
          await pages[i].waitForSelector('.podium-overlay', {visible: true, timeout: 2000});
        }
        
        console.log("Host is restarting the game...");
        await hostPage.waitForSelector('#btnStartGame', {visible: true});
        await hostPage.click('#btnStartGame');
        
        console.log("Waiting for game to restart for everyone...");
        for(let page of pages) {
          await page.waitForSelector('#wordDisplay', {visible: true, timeout: 5000});
        }
      }
    }

    console.log("Test Passed! All functionalities work seamlessly.");

  } catch (error) {
    console.error("TEST FAILED:", error);
    try {
      if (pages.length > 0) {
        const content = await pages[0].content();
        console.log("HTML Content of hostPage:");
        console.log(content);
        await pages[0].screenshot({path: 'test_failure.png'});
        console.log("Screenshot saved to test_failure.png");
      }
    } catch(e) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
