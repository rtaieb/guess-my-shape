# Agent Testing Policy

**CRITICAL RULE FOR ALL FUTURE MODIFICATIONS:**
As per the user's explicit request, before delivering any modifications, you MUST verify that the game is fully functional.

## Steps to Verify:
1. Ensure the Vite development server is running (`npm run dev`).
2. Run the puppeteer browser error checking script (`node checkError.cjs`) to ensure the application loads without a white page or JS console exceptions.
3. If structural logic was changed, run the full game logic test script (`node test.cjs`) to simulate 4 players connecting and verifying the round/points logic.
4. ONLY after verifying that there are no Javascript runtime errors and that the game mechanics work, you may inform the user that the delivery is ready.

Do not deliver untested code.
