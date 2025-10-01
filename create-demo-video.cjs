const { chromium } = require('playwright');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const execAsync = promisify(exec);

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createGemmaChatDemo() {
  console.log('🎥 Creating Gemma Chat App Demo Video...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1600,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: {
      dir: './demo-recordings',
      size: { width: 1600, height: 900 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('📹 Recording started...\n');

    // Scene 1: Load application
    console.log('Scene 1: Loading Gemma Chat App...');
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    await wait(3000);

    // Wait for model to load (show loading screen)
    console.log('Scene 2: Waiting for model to load...');
    await page.waitForSelector('#loadingOverlay.hidden', { timeout: 180000 });
    console.log('✅ Model loaded!');
    await wait(2000);

    // Scene 3: Show initial UI
    console.log('Scene 3: Showing chat interface...');
    await wait(2000);

    // Scene 4: Type first message slowly
    console.log('Scene 4: Typing first message...');
    const firstMessage = 'What is machine learning?';
    await page.click('#chatInput');
    await wait(500);
    for (let char of firstMessage) {
      await page.keyboard.type(char);
      await wait(100);
    }
    await wait(1000);

    // Scene 5: Send message
    console.log('Scene 5: Sending message...');
    await page.click('#sendButton');
    await wait(2000);

    // Scene 6: Wait for response to complete
    console.log('Scene 6: Waiting for AI response...');
    await page.waitForSelector('#sendButton:not([disabled])', { timeout: 60000 });
    await wait(3000);

    // Scene 7: Type second message
    console.log('Scene 7: Typing follow-up question...');
    const secondMessage = 'Can you explain neural networks?';
    await page.click('#chatInput');
    await wait(500);
    for (let char of secondMessage) {
      await page.keyboard.type(char);
      await wait(100);
    }
    await wait(1000);

    // Scene 8: Send second message
    console.log('Scene 8: Sending follow-up...');
    await page.click('#sendButton');
    await wait(2000);

    // Scene 9: Wait a bit for streaming to start
    console.log('Scene 9: Showing streaming response...');
    await wait(5000);

    // Scene 10: Click stop button
    console.log('Scene 10: Testing stop generation...');
    const stopButton = await page.$('#stopButton');
    if (stopButton) {
      await page.click('#stopButton');
      console.log('✅ Stop button clicked');
    }
    await wait(2000);

    // Scene 11: Type third message to show queue
    console.log('Scene 11: Testing message queue...');
    const thirdMessage = 'What about deep learning?';
    await page.click('#chatInput');
    await wait(500);
    for (let char of thirdMessage) {
      await page.keyboard.type(char);
      await wait(100);
    }
    await wait(500);
    await page.click('#sendButton');
    await wait(2000);

    // Scene 12: Wait for final response
    console.log('Scene 12: Final response...');
    await page.waitForSelector('#sendButton:not([disabled])', { timeout: 60000 });
    await wait(3000);

    // Scene 13: Show resource monitor
    console.log('Scene 13: Showing resource monitor...');
    await wait(2000);

    // Scene 14: Final state
    console.log('Scene 14: Final demo state...');
    await wait(2000);

    console.log('\n✅ Recording complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('\n🎬 Processing video...');

  // Wait for video to be written
  await wait(3000);

  // Find the video file
  const videoFiles = fs.readdirSync('./demo-recordings').filter(f => f.endsWith('.webm'));

  if (videoFiles.length === 0) {
    console.log('❌ No video file found!');
    return;
  }

  const videoFile = `./demo-recordings/${videoFiles[0]}`;
  console.log(`📹 Video file: ${videoFile}`);

  const stats = fs.statSync(videoFile);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    // Convert video to MP4
    console.log('\n🔄 Converting to MP4...');
    await execAsync(`ffmpeg -i "${videoFile}" -c:v libx264 -preset slow -crf 22 -c:a aac gemma-chat-demo.mp4 -y`);
    console.log('✅ Created: gemma-chat-demo.mp4');

    // Create GIF from video
    console.log('\n🎨 Creating GIF from video...');

    // Generate palette for better colors
    console.log('   Generating color palette...');
    await execAsync(`ffmpeg -i gemma-chat-demo.mp4 -vf "fps=8,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff" -y palette.png`);

    // Create GIF using palette
    console.log('   Creating GIF...');
    await execAsync(`ffmpeg -i gemma-chat-demo.mp4 -i palette.png -lavfi "fps=8,scale=1200:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" -y gemma-chat-demo.gif`);

    const gifStats = fs.statSync('gemma-chat-demo.gif');
    console.log(`✅ Created: gemma-chat-demo.gif (${(gifStats.size / 1024).toFixed(0)} KB)`);

    // Cleanup
    fs.unlinkSync('palette.png');

  } catch (error) {
    console.log('⚠️  FFmpeg error:', error.message);
    console.log('\n💡 Make sure ffmpeg is installed:');
    console.log('   sudo apt-get install ffmpeg');
  }

  console.log('\n🎉 Demo creation complete!');
  console.log('📁 Files created:');
  console.log('   - gemma-chat-demo.mp4 (source video)');
  console.log('   - gemma-chat-demo.gif (demo GIF)');
}

createGemmaChatDemo().catch(console.error);
