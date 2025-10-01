// Web Worker for Gemma 270M Model Inference
import { pipeline, TextStreamer, env } from '@huggingface/transformers';

// Configure ONNX Runtime WASM backend before any model loading
env.allowLocalModels = false;
env.useBrowserCache = true;

// Fix for WASM backend initialization
// Due to bug in onnxruntime-web, must disable multithreading
if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
}

// Global model instance
let generator: any = null;
let isInitialized = false;

// Message history for context
let messageHistory: Array<{ role: string; content: string }> = [];

// AbortController for stopping generation
let currentAbortController: AbortController | null = null;

// Reset message history when worker starts
messageHistory = [];

console.log('🚀 Model worker started with WASM config:', {
    allowLocalModels: env.allowLocalModels,
    useBrowserCache: env.useBrowserCache,
    wasmThreads: env.backends?.onnx?.wasm?.numThreads
});

// Initialize the model
async function initializeModel() {
    if (isInitialized) return;

    // Set timeout for model loading (5 minutes)
    const INIT_TIMEOUT = 5 * 60 * 1000;
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model loading timeout after 5 minutes')), INIT_TIMEOUT)
    );

    try {
        // Send initial progress
        self.postMessage({
            type: 'progress',
            data: {
                progress: 10,
                message: 'Loading Transformers.js...'
            }
        });

        // Detect device capabilities and fallback to WASM if needed
        let deviceConfig = { dtype: 'fp32', device: 'webgpu' };

        // Check WebGPU support
        if (!('gpu' in navigator)) {
            console.log('🔧 WebGPU not available, falling back to WASM');
            deviceConfig = { dtype: 'fp32', device: 'wasm' };
        }

        // Create text generation pipeline with Gemma 270M (with caching and timeout)
        generator = await Promise.race([
            pipeline(
            'text-generation',
            'onnx-community/gemma-3-270m-it-ONNX',
            {
                ...deviceConfig,
                cache_dir: './.transformers-cache', // Enable file system caching
                local_files_only: false, // Allow downloading if not cached
                use_auth_token: false, // No auth required for this model
                revision: 'main', // Use main branch for consistency
                progress_callback: (progress: any) => {
                    if (progress.status === 'progress') {
                        // progress.progress is already a percentage (0-100), not a decimal (0-1)
                        const percent = Math.round(progress.progress || 0);
                        const isDownloading = progress.file && progress.file.endsWith('.onnx');
                        const message = isDownloading 
                            ? `Downloading model... ${percent}% (${Math.round(progress.loaded / 1024 / 1024)}MB)`
                            : `Loading model... ${percent}%`;
                        
                        self.postMessage({
                            type: 'progress',
                            data: {
                                progress: percent,
                                message: message
                            }
                        });
                    } else if (progress.status === 'ready') {
                        self.postMessage({
                            type: 'progress',
                            data: {
                                progress: 100,
                                message: 'Model ready! (cached for future use)'
                            }
                        });
                    } else if (progress.status === 'initiate') {
                        const isCached = progress.cache_hit;
                        const message = isCached ? 'Loading cached model...' : 'Downloading model (270MB)...';
                        self.postMessage({
                            type: 'progress',
                            data: {
                                progress: 5,
                                message: message
                            }
                        });
                    }
                }
            }),
            timeoutPromise
        ]) as any;

        isInitialized = true;
        console.log('✅ Gemma 270M model loaded successfully');
        
        // Send ready message
        self.postMessage({ type: 'ready' });
        
    } catch (error) {
        console.error('Failed to initialize model:', error);
        self.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to load model'
        });
    }
}

// Generate response
async function generateResponse(userMessage: string) {
    if (!generator) {
        self.postMessage({
            type: 'error',
            error: 'Model not initialized'
        });
        return;
    }

    // Create new abort controller for this generation
    currentAbortController = new AbortController();

    try {
        // Build conversation from history (simplified validation)
        const messages = [];

        // Add context from history (last 3 exchanges = 6 messages)
        const recentHistory = messageHistory.slice(-6);
        for (const msg of recentHistory) {
            messages.push(msg);
        }

        // Add current user message
        messages.push({ role: 'user', content: userMessage });

        // Simple validation: ensure starts with user and alternates
        const validMessages = [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const expectedRole = i % 2 === 0 ? 'user' : 'assistant';

            // If role doesn't match expected pattern, skip
            if (msg.role !== expectedRole) {
                continue;
            }

            validMessages.push(msg);
        }

        // Fallback: if validation fails, use just current message
        const finalMessages = validMessages.length > 0 && validMessages[validMessages.length - 1].role === 'user'
            ? validMessages
            : [{ role: 'user', content: userMessage }];
        
        // Debug: log the conversation structure
        console.log('Conversation structure:', finalMessages.map(m => m.role).join(' -> '));
        console.log('Message count:', finalMessages.length);

        // Create text streamer for real-time output with abort support
        const streamer = new TextStreamer(generator.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (token: string) => {
                // Check if generation was aborted
                if (currentAbortController?.signal.aborted) {
                    throw new Error('Generation aborted by user');
                }
                // Send each token to main thread
                self.postMessage({
                    type: 'token',
                    data: { token }
                });
            }
        });

        // Use validated messages for generation
        console.log('Messages for generation:', JSON.stringify(finalMessages, null, 2));

        // Generate response using message array directly
        const output = await generator(finalMessages, {
            max_new_tokens: 256,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            streamer
        });
        
        // Extract generated text from message array output
        let generatedText = '';
        if (output[0].generated_text && Array.isArray(output[0].generated_text)) {
            // Get the new assistant message from the array
            const newMessages = output[0].generated_text;
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
                generatedText = lastMessage.content.trim();
            }
        } else if (typeof output[0].generated_text === 'string') {
            // Fallback for string output
            generatedText = output[0].generated_text.trim();
        }
        
        if (!generatedText) {
            generatedText = "I apologize, but I couldn't generate a response.";
        }
        
        console.log('Extracted response:', generatedText.slice(0, 100));

        // Simplified history update: just append user + assistant
        messageHistory.push({ role: 'user', content: userMessage });
        messageHistory.push({ role: 'assistant', content: generatedText });

        // Keep only last 10 messages (5 exchanges)
        if (messageHistory.length > 10) {
            messageHistory = messageHistory.slice(-10);
        }
        
        // Send completion message
        self.postMessage({ type: 'complete' });
        
    } catch (error) {
        console.error('Generation error:', error);
        self.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Generation failed'
        });
    }
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
            await initializeModel();
            break;
            
        case 'generate':
            await generateResponse(data.message);
            break;
            
        case 'reset':
            messageHistory = [];
            self.postMessage({ type: 'reset_complete' });
            break;
            
        case 'stop':
            // Actually abort the current generation
            if (currentAbortController) {
                currentAbortController.abort();
                console.log('⏸️ Generation aborted by user');
            }
            self.postMessage({ type: 'stopped' });
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
});

// Log that worker is ready
console.log('🚀 Model worker started');