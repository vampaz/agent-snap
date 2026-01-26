import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration
const PORT = 5175; // Use a different port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), 'docs/images');
const VIDEO_DIR = path.join(process.cwd(), 'temp-video');

async function startServer() {
  console.log('Starting Vite server...');
  const server = spawn('npx', ['vite', '--port', PORT.toString()], {
    cwd: path.join(process.cwd(), 'playground'),
    stdio: 'ignore',
    shell: true,
  });

  // Give it a moment to spin up
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return server;
}

async function recordDemo() {
  console.log('Launching browser for demo recording...');
  // Ensure output directories exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Clean up previous temp videos
  if (fs.existsSync(VIDEO_DIR)) {
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  }

  const browser = await chromium.launch();

  // Create context with video recording enabled
  // We record at a higher resolution and will downscale for the GIF if needed
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 }, // Good aspect ratio for a readme GIF
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1000, height: 700 },
    },
    deviceScaleFactor: 2, // High DPI for crisp text
  });

  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  try {
    await page.goto(BASE_URL);
  } catch (e) {
    console.error(`Failed to load ${BASE_URL}. Is the server running?`);
    throw e;
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // Initial pause for viewer to settle

  // --- ACT 1: Activate ---
  console.log('Activating annotator...');
  const toggleButton = page.locator('[data-testid="as-toggle"]');
  await toggleButton.waitFor({ state: 'visible' });

  // Move mouse to button realistically
  const box = await toggleButton.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  }
  await page.waitForTimeout(300);
  await toggleButton.click();
  await page.waitForTimeout(1000); // Wait for expansion animation

  // --- ACT 2: Annotate Title ---
  console.log('Annotating hero title...');
  const heroTitle = page.locator('[data-testid="hero-title"]');
  const titleBox = await heroTitle.boundingBox();
  if (titleBox) {
    await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2, {
      steps: 15,
    });
  }
  await page.waitForTimeout(400);
  await heroTitle.click({ force: true });

  // Wait for popup
  const popup = page.locator('[data-testid="popup-root"]');
  await popup.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  // Type comment
  const textarea = page.locator('[data-testid="popup-textarea"]');
  await textarea.type('Change this headline to be more engaging', { delay: 60 });
  await page.waitForTimeout(600);

  // Submit
  const submitBtn = page.locator('[data-testid="popup-submit"]');
  const submitBox = await submitBtn.boundingBox();
  if (submitBox) {
    await page.mouse.move(submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2, {
      steps: 10,
    });
  }
  await page.waitForTimeout(300);
  await submitBtn.click();
  await page.waitForTimeout(1000);

  // --- ACT 3: Annotate Button ---
  console.log('Annotating button...');
  const reviewBtn = page.locator('[data-testid="hero-request-review"]');
  const btnBox = await reviewBtn.boundingBox();
  if (btnBox) {
    await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2, { steps: 15 });
  }
  await page.waitForTimeout(400);
  await reviewBtn.click({ force: true });

  await popup.waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  await textarea.type('Make this secondary style', { delay: 60 });
  await page.waitForTimeout(600);

  if (submitBox) {
    // Re-locate box as it might have moved slightly or just use element
    await submitBtn.click();
  } else {
    await page.locator('[data-testid="popup-submit"]').click();
  }
  await page.waitForTimeout(1000);

  // --- ACT 4: Hover Interaction ---
  console.log('Hovering markers...');
  // Move mouse away first to clear any hover state
  await page.mouse.move(10, 10, { steps: 10 });
  await page.waitForTimeout(500);

  // Hover first marker
  const marker1 = page.locator('[data-testid="annotation-marker-1"]');
  if (await marker1.isVisible()) {
    const m1Box = await marker1.boundingBox();
    if (m1Box) {
      await page.mouse.move(m1Box.x + m1Box.width / 2, m1Box.y + m1Box.height / 2, { steps: 15 });
      await page.waitForTimeout(1500); // Let user read tooltip
    }
  }

  // Hover second marker
  const marker2 = page.locator('[data-testid="annotation-marker-2"]');
  if (await marker2.isVisible()) {
    const m2Box = await marker2.boundingBox();
    if (m2Box) {
      await page.mouse.move(m2Box.x + m2Box.width / 2, m2Box.y + m2Box.height / 2, { steps: 15 });
      await page.waitForTimeout(1500);
    }
  }

  // Move mouse away to finish cleanly
  await page.mouse.move(10, 10, { steps: 10 });
  await page.waitForTimeout(1000);

  // --- ACT 5: View Output ---
  console.log('Viewing output...');
  const viewOutputBtn = page.locator('[data-testid="footer-view-output"]');
  await viewOutputBtn.scrollIntoViewIfNeeded();

  const outputBox = await viewOutputBtn.boundingBox();
  if (outputBox) {
    await page.mouse.move(outputBox.x + outputBox.width / 2, outputBox.y + outputBox.height / 2, {
      steps: 15,
    });
  }
  await page.waitForTimeout(400);
  await viewOutputBtn.click();

  // Wait for modal and let user see it
  await page.waitForTimeout(3000);

  console.log('Recording finished.');
  await context.close(); // Saves the video
  await browser.close();

  // Return the path to the recorded video
  const videoFiles = fs.readdirSync(VIDEO_DIR);
  const videoFile = videoFiles.find((f) => f.endsWith('.webm'));
  return videoFile ? path.join(VIDEO_DIR, videoFile) : null;
}

function convertToGif(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    console.log(`Converting ${inputPath} to GIF at ${outputPath}...`);

    // 1. Generate palette for high quality colors
    const palettePath = path.join(path.dirname(inputPath), 'palette.png');

    // Command 1: Generate palette
    // fps=15: smoother than 10, not too huge file size
    // scale=800:-1: downscale to 800px width (good for README), maintain aspect ratio
    const filters = 'fps=15,scale=800:-1:flags=lanczos';

    const paletteCmd = spawn('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `${filters},palettegen`,
      palettePath,
    ]);

    paletteCmd.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg palette generation failed with code ${code}`));
        return;
      }

      // Command 2: Apply palette and generate GIF
      const gifCmd = spawn('ffmpeg', [
        '-y',
        '-i',
        inputPath,
        '-i',
        palettePath,
        '-lavfi',
        `${filters} [x]; [x][1:v] paletteuse`,
        outputPath,
      ]);

      gifCmd.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg gif generation failed with code ${code}`));
        } else {
          // Cleanup palette
          fs.unlinkSync(palettePath);
          resolve();
        }
      });
    });
  });
}

async function main() {
  let server;
  try {
    server = await startServer();
    const rawVideoPath = await recordDemo();

    if (rawVideoPath) {
      const gifPath = path.join(OUTPUT_DIR, 'demo.gif');
      await convertToGif(rawVideoPath, gifPath);
      console.log(`✅ Demo GIF generated successfully at: ${gifPath}`);

      // Cleanup temp video dir
      fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
    } else {
      console.error('❌ No video recorded.');
    }
  } catch (error) {
    console.error('Error generating demo:', error);
    process.exit(1);
  } finally {
    if (server) {
      console.log('Stopping server...');
      server.kill();
    }
    process.exit(0);
  }
}

main();
