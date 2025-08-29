// Web Worker for Gemma 270M Model Inference
import { pipeline, TextStreamer } from '@huggingface/transformers';

// Global model instance
let generator: any = null;
let isInitialized = false;

// Message history for context
let messageHistory: Array<{ role: string; content: string }> = [];

// Reset message history when worker starts
messageHistory = [];

// Initialize the model
async function initializeModel() {
    if (isInitialized) return;
    
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

        // Create text generation pipeline with Gemma 270M (with caching)
        generator = await pipeline(
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
            }
        );
        
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
    
    try {
        // Create a clean conversation for this generation
        // Don't add to persistent history until we get a response
        const tempHistory = [...messageHistory, { role: 'user', content: userMessage }];
        
        // Keep only last 6 messages for context (3 exchanges max)
        let messages = tempHistory.slice(-6);
        
        // Ensure alternating roles: user/assistant/user/assistant
        // Must always start with user message
        const cleanMessages = [];
        
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            
            // Skip consecutive messages with same role
            if (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role === msg.role) {
                continue;
            }
            
            // If this is the first message, it must be a user message
            if (cleanMessages.length === 0 && msg.role !== 'user') {
                continue; // Skip non-user first messages
            }
            
            // For subsequent messages, ensure alternation
            if (cleanMessages.length > 0) {
                const expectedRole = cleanMessages.length % 2 === 0 ? 'user' : 'assistant';
                if (msg.role !== expectedRole) {
                    continue; // Skip messages that break alternation
                }
            }
            
            cleanMessages.push(msg);
        }
        
        messages = cleanMessages;
        
        // Ensure we have at least one message and it ends with a user message
        if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
            messages = [{ role: 'user', content: userMessage }];
        }
        
        // Debug: log the conversation structure
        console.log('Conversation structure:', messages.map(m => m.role).join(' -> '));
        console.log('Message count:', messages.length);
        
        // Create text streamer for real-time output
        const streamer = new TextStreamer(generator.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (token: string) => {
                // Send each token to main thread
                self.postMessage({
                    type: 'token',
                    data: { token }
                });
            }
        });
        
        // Use direct message array format (like bedtime-story-generator)
        console.log('Messages for generation:', JSON.stringify(messages, null, 2));
        
        // Generate response using message array directly
        const output = await generator(messages, {
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
        
        // Add messages to persistent history with strict role validation
        const newMessages = [];
        
        // Only add user message if it maintains proper alternation
        if (messageHistory.length === 0 || messageHistory[messageHistory.length - 1].role === 'assistant') {
            newMessages.push({ role: 'user', content: userMessage });
        }
        
        // Only add assistant message if it maintains proper alternation
        const lastRole = messageHistory.length > 0 ? messageHistory[messageHistory.length - 1].role : null;
        const willBeLastRole = newMessages.length > 0 ? 'user' : lastRole;
        
        if (willBeLastRole === 'user') {
            newMessages.push({ role: 'assistant', content: generatedText });
        }
        
        // Add new messages to history
        messageHistory.push(...newMessages);
        
        // Keep only last 10 messages for context (5 exchanges)
        if (messageHistory.length > 10) {
            messageHistory = messageHistory.slice(-10);
        }
        
        // Final validation: rebuild history ensuring it starts with user and alternates
        const validHistory = [];
        for (const msg of messageHistory) {
            // First message must be user
            if (validHistory.length === 0 && msg.role !== 'user') {
                continue;
            }
            
            // Subsequent messages must alternate
            if (validHistory.length > 0) {
                const expectedRole = validHistory.length % 2 === 0 ? 'user' : 'assistant';
                if (msg.role !== expectedRole) {
                    continue;
                }
            }
            
            validHistory.push(msg);
        }
        
        messageHistory = validHistory;
        
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
            // Handle stop generation request
            // Note: For now we'll just clear the history to prevent further processing
            // In a more advanced implementation, we could interrupt the generation
            self.postMessage({ type: 'stopped' });
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
});

// Log that worker is ready
console.log('🚀 Model worker started');