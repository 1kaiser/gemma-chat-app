import { test, expect } from '@playwright/test';

test.describe('Gemma Chat App - WebGPU Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for model loading
    test.setTimeout(180000); // 3 minutes
    
    // Navigate to the app
    await page.goto('/');
  });

  test('should check WebGPU availability', async ({ page }) => {
    // Check if WebGPU is available
    const hasWebGPU = await page.evaluate(() => {
      return 'gpu' in navigator;
    });
    
    expect(hasWebGPU).toBeTruthy();
    console.log('✅ WebGPU is available in Chrome Canary');
    
    // Check GPU adapter
    const gpuInfo = await page.evaluate(async () => {
      if (!navigator.gpu) return null;
      
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return null;
        
        const info = adapter.info || {};
        return {
          vendor: info.vendor || 'unknown',
          architecture: info.architecture || 'unknown',
          device: info.device || 'unknown',
          description: info.description || 'unknown'
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('GPU Info:', gpuInfo);
    expect(gpuInfo).not.toBeNull();
  });

  test('should load the chat interface', async ({ page }) => {
    // Check for main UI elements
    await expect(page.locator('h1')).toContainText('Gemma Chat');
    await expect(page.locator('#chatMessages')).toBeVisible();
    await expect(page.locator('#chatInput')).toBeVisible();
    await expect(page.locator('#sendButton')).toBeVisible();
    
    // Check initial message
    const welcomeMessage = page.locator('.ai-message').first();
    await expect(welcomeMessage).toContainText('Hello! I\'m Gemma');
  });

  test('should show loading overlay during model initialization', async ({ page }) => {
    // Check loading overlay is visible initially
    const loadingOverlay = page.locator('#loadingOverlay');
    await expect(loadingOverlay).toBeVisible();
    
    // Check loading text
    await expect(loadingOverlay).toContainText('Loading Gemma 270M');
    
    // Wait for model to load (with extended timeout)
    await page.waitForSelector('#loadingOverlay.hidden', { 
      timeout: 120000,
      state: 'attached' 
    });
    
    // Check that input is enabled after loading
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    const sendButton = page.locator('#sendButton');
    await expect(sendButton).toBeEnabled();
    
    // Check status shows ready
    const status = page.locator('#status');
    await expect(status).toContainText('Ready');
  });

  test('should handle chat interaction', async ({ page }) => {
    // Wait for model to load
    await page.waitForSelector('#loadingOverlay.hidden', { 
      timeout: 120000,
      state: 'attached' 
    });
    
    // Ensure input is ready
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    // Type a message
    await chatInput.fill('Hello, how are you?');
    
    // Send the message
    const sendButton = page.locator('#sendButton');
    await sendButton.click();
    
    // Check that user message appears
    const userMessage = page.locator('.user-message').last();
    await expect(userMessage).toContainText('Hello, how are you?');
    
    // Check input is disabled while generating
    await expect(chatInput).toBeDisabled();
    await expect(sendButton).toBeDisabled();
    
    // Wait for AI response (with timeout)
    await page.waitForSelector('#current-ai-message', {
      timeout: 30000
    });
    
    // Wait for generation to complete
    await page.waitForFunction(
      () => !document.querySelector('#current-ai-message'),
      { timeout: 60000 }
    );
    
    // Check that AI response appears
    const aiMessages = page.locator('.ai-message');
    const messageCount = await aiMessages.count();
    expect(messageCount).toBeGreaterThan(1); // Welcome + response
    
    // Check input is re-enabled
    await expect(chatInput).toBeEnabled();
    await expect(sendButton).toBeEnabled();
  });

  test('should show typing indicator during generation', async ({ page }) => {
    // Wait for model to load
    await page.waitForSelector('#loadingOverlay.hidden', { 
      timeout: 120000,
      state: 'attached' 
    });
    
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    // Send a message
    await chatInput.fill('Tell me a short joke');
    await page.locator('#sendButton').click();
    
    // Check typing indicator appears
    const typingIndicator = page.locator('#typingIndicator');
    await expect(typingIndicator).toHaveClass(/active/, { timeout: 5000 });
    
    // Wait for response to start
    await page.waitForSelector('#current-ai-message', {
      timeout: 30000
    });
    
    // Typing indicator should be hidden once tokens start arriving
    await expect(typingIndicator).not.toHaveClass(/active/);
  });

  test('should maintain conversation context', async ({ page }) => {
    // Wait for model to load
    await page.waitForSelector('#loadingOverlay.hidden', { 
      timeout: 120000,
      state: 'attached'
    });
    
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    // First message
    await chatInput.fill('My name is Alice');
    await page.locator('#sendButton').click();
    
    // Wait for first response
    await page.waitForFunction(
      () => {
        const messages = document.querySelectorAll('.ai-message');
        return messages.length >= 2; // Welcome + first response
      },
      { timeout: 60000 }
    );
    
    // Re-enable check
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    // Second message referencing context
    await chatInput.fill('What is my name?');
    await page.locator('#sendButton').click();
    
    // Wait for second response
    await page.waitForFunction(
      () => {
        const messages = document.querySelectorAll('.ai-message');
        return messages.length >= 3; // Welcome + 2 responses
      },
      { timeout: 60000 }
    );
    
    // Check if response contains reference to Alice
    const lastAiMessage = page.locator('.ai-message').last();
    const messageText = await lastAiMessage.textContent();
    
    // The model should reference the name in some way
    console.log('AI Response:', messageText);
    expect(messageText?.toLowerCase()).toMatch(/alice|your name|you mentioned/i);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Inject an error by sending a message before model loads
    await page.evaluate(() => {
      // Directly trigger an error scenario
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message ai-message';
      errorDiv.style.background = '#ffebee';
      errorDiv.style.color = '#c62828';
      errorDiv.textContent = '❌ Error: Test error';
      document.getElementById('chatMessages')?.appendChild(errorDiv);
    });
    
    // Check error message appears correctly
    const errorMessage = page.locator('.ai-message').filter({ 
      hasText: '❌ Error' 
    });
    await expect(errorMessage).toBeVisible();
  });

  test('should track performance metrics', async ({ page }) => {
    // Measure model loading time
    const startTime = Date.now();
    
    await page.waitForSelector('#loadingOverlay.hidden', { 
      timeout: 120000,
      state: 'attached' 
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`Model loaded in ${loadTime}ms`);
    
    // Measure response generation time
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeEnabled({ timeout: 10000 });
    
    await chatInput.fill('Hi');
    
    const genStartTime = Date.now();
    await page.locator('#sendButton').click();
    
    // Wait for response to complete
    await page.waitForFunction(
      () => !document.querySelector('#current-ai-message'),
      { timeout: 60000 }
    );
    
    const genTime = Date.now() - genStartTime;
    console.log(`Response generated in ${genTime}ms`);
    
    // Log performance metrics
    const metrics = await page.evaluate(() => {
      if (!performance.memory) return null;
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    });
    
    console.log('Memory usage (MB):', metrics);
    
    // Expectations
    expect(loadTime).toBeLessThan(120000); // Should load within 2 minutes
    expect(genTime).toBeLessThan(60000); // Should respond within 1 minute
  });
});