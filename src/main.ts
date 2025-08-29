// Main application entry point
import { ChatManager } from './chatManager';

// Check WebGPU support (optional for WASM fallback)
async function checkWebGPUSupport(): Promise<boolean> {
    if (!navigator.gpu) {
        console.warn('WebGPU is not supported in this browser, will use WASM');
        return false;
    }
    
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.warn('No WebGPU adapter found, will use WASM');
            return false;
        }
        
        const device = await adapter.requestDevice();
        console.log('✅ WebGPU is available:', device);
        return true;
    } catch (error) {
        console.warn('WebGPU initialization failed, will use WASM:', error);
        return false;
    }
}

// Initialize the application
async function initApp() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingStatus = document.getElementById('loadingStatus');
    const statusElement = document.getElementById('status');
    const chatInput = document.getElementById('chatInput') as HTMLInputElement;
    const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    
    try {
        // Check WebGPU support (but don't fail if not available)
        loadingStatus!.textContent = 'Checking device capabilities...';
        const hasWebGPU = await checkWebGPUSupport();
        
        if (hasWebGPU) {
            console.log('🚀 Using WebGPU acceleration');
        } else {
            console.log('🔧 Using WASM runtime for compatibility');
        }
        
        // Initialize chat manager
        loadingStatus!.textContent = 'Initializing chat system...';
        const chatManager = new ChatManager();
        
        // Set up progress callback
        chatManager.onProgress = (progress: number, message: string) => {
            const progressRingFill = document.getElementById('progressRingFill');
            const progressPercentage = document.getElementById('progressPercentage');
            
            // Ensure progress is between 0-100
            const clampedProgress = Math.max(0, Math.min(100, progress));
            
            if (progressRingFill) {
                // Calculate stroke-dashoffset for circular progress (314 = 2 * π * 50)
                const offset = 314 - (clampedProgress / 100) * 314;
                progressRingFill.style.strokeDashoffset = offset.toString();
            }
            
            if (progressPercentage) {
                progressPercentage.textContent = `${Math.round(clampedProgress)}%`;
            }
            
            if (loadingStatus) {
                loadingStatus.textContent = message;
            }
        };
        
        // Initialize the model
        loadingStatus!.textContent = 'Loading Gemma 270M model...';
        await chatManager.initialize();
        
        // Hide loading overlay
        loadingOverlay?.classList.add('hidden');
        
        // Enable input
        chatInput.disabled = false;
        sendButton.disabled = false;
        statusElement!.textContent = '✅ Ready - Model loaded successfully';
        
        // Set up event handlers
        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if (!message || chatManager.isGenerating) return;
            
            // Add user message to chat
            chatManager.addUserMessage(message);
            
            // Clear input
            chatInput.value = '';
            
            // Generate response
            await chatManager.generateResponse(message);
        };
        
        sendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Focus input
        chatInput.focus();
        
        // Show resource monitor and start monitoring
        const resourceMonitor = document.getElementById('resourceMonitor');
        if (resourceMonitor) {
            resourceMonitor.style.display = 'block';
            
            // Set initial runtime type
            const runtimeType = document.getElementById('runtimeType');
            if (runtimeType) {
                runtimeType.textContent = hasWebGPU ? 'WebGPU' : 'WASM';
            }
            
            // Set model status
            const modelStatus = document.getElementById('modelStatus');
            if (modelStatus) {
                modelStatus.textContent = 'Ready';
            }
            
            // Start resource monitoring
            startResourceMonitoring();
        }
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        
        // Show error message
        loadingOverlay?.classList.add('hidden');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Error: ${error instanceof Error ? error.message : 'Failed to initialize'}`;
        document.querySelector('.container')?.prepend(errorDiv);
        
        statusElement!.textContent = '❌ Failed to load model';
    }
}

// Resource monitoring functions
function formatMemoryUsage(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    if (mb < 1024) {
        return `${Math.round(mb)}MB`;
    } else {
        return `${(mb / 1024).toFixed(1)}GB`;
    }
}

function startResourceMonitoring() {
    const memoryUsage = document.getElementById('memoryUsage');
    const messageCountEl = document.getElementById('messageCount');
    
    // Update memory usage periodically
    const updateResources = () => {
        if (memoryUsage) {
            if ('memory' in performance) {
                const memory = (performance as any).memory;
                const used = memory.usedJSHeapSize;
                memoryUsage.textContent = formatMemoryUsage(used);
            } else {
                memoryUsage.textContent = 'N/A';
            }
        }
        
        if (messageCountEl) {
            const messages = document.querySelectorAll('.message');
            messageCountEl.textContent = Math.max(0, messages.length - 1).toString(); // Exclude initial greeting
        }
    };
    
    // Update immediately and then every 2 seconds
    updateResources();
    setInterval(updateResources, 2000);
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}