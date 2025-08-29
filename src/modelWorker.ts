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

        // Create text generation pipeline with Gemma 270M
        generator = await pipeline(
            'text-generation',
            'onnx-community/gemma-3-270m-it-ONNX',
            {
                ...deviceConfig,
                progress_callback: (progress: any) => {
                    if (progress.status === 'progress') {
                        // progress.progress is already a percentage (0-100), not a decimal (0-1)
                        const percent = Math.round(progress.progress || 0);
                        self.postMessage({
                            type: 'progress',
                            data: {
                                progress: percent,
                                message: `Downloading model... ${percent}%`
                            }
                        });
                    } else if (progress.status === 'ready') {
                        self.postMessage({
                            type: 'progress',
                            data: {
                                progress: 100,
                                message: 'Initialization complete!'
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
        const messages = tempHistory.slice(-6);
        
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
        
        // Format messages as a single prompt for Gemma
        let prompt = '';
        for (const msg of messages) {
            if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Assistant: ${msg.content}\n`;
            }
        }
        prompt += 'Assistant: '; // Prompt for the next assistant response
        
        console.log('Generated prompt:', prompt.slice(-200)); // Log last 200 chars
        
        // Generate response using formatted prompt
        const output = await generator(prompt, {
            max_new_tokens: 256,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            streamer
        });
        
        // Extract generated text from string output
        let generatedText = '';
        if (output[0].generated_text) {
            // Remove the input prompt to get only the generated part
            const fullText = output[0].generated_text;
            const generatedPart = fullText.slice(prompt.length);
            generatedText = generatedPart.trim();
        }
        
        if (!generatedText) {
            generatedText = "I apologize, but I couldn't generate a response.";
        }
        
        console.log('Extracted response:', generatedText.slice(0, 100));
        
        // Now add both user and assistant messages to persistent history
        messageHistory.push({ role: 'user', content: userMessage });
        messageHistory.push({ role: 'assistant', content: generatedText });
        
        // Keep only last 10 messages for context (5 exchanges)
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