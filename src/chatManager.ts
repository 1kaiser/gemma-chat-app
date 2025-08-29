// Chat Manager - Coordinates between UI and Worker
export class ChatManager {
    private worker: Worker | null = null;
    private messagesContainer: HTMLElement | null = null;
    private typingIndicator: HTMLElement | null = null;
    private statusElement: HTMLElement | null = null;
    public isGenerating: boolean = false;
    public onProgress?: (progress: number, message: string) => void;
    
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.statusElement = document.getElementById('status');
    }
    
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Create web worker
            this.worker = new Worker(
                new URL('./modelWorker.ts', import.meta.url),
                { type: 'module' }
            );
            
            // Set up message handler
            this.worker.onmessage = (event) => {
                const { type, data, error } = event.data;
                
                switch (type) {
                    case 'ready':
                        console.log('✅ Model worker ready');
                        resolve();
                        break;
                        
                    case 'progress':
                        if (this.onProgress) {
                            this.onProgress(data.progress, data.message);
                        }
                        break;
                        
                    case 'token':
                        this.appendToCurrentMessage(data.token);
                        break;
                        
                    case 'complete':
                        this.completeGeneration();
                        break;
                        
                    case 'error':
                        console.error('Worker error:', error);
                        this.handleError(error);
                        reject(new Error(error));
                        break;
                }
            };
            
            // Initialize the worker
            this.worker.postMessage({ type: 'init' });
        });
    }
    
    addUserMessage(text: string): void {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.textContent = text;
        this.messagesContainer?.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    async generateResponse(userMessage: string): Promise<void> {
        if (!this.worker || this.isGenerating) return;
        
        this.isGenerating = true;
        this.showTypingIndicator();
        
        // Create AI message container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.id = 'current-ai-message';
        messageDiv.textContent = '';
        this.messagesContainer?.appendChild(messageDiv);
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = '🤔 Thinking...';
        }
        
        // Send message to worker
        this.worker.postMessage({
            type: 'generate',
            data: { message: userMessage }
        });
    }
    
    private appendToCurrentMessage(token: string): void {
        const currentMessage = document.getElementById('current-ai-message');
        if (currentMessage) {
            currentMessage.textContent += token;
            this.scrollToBottom();
        }
        
        // Hide typing indicator once we start receiving tokens
        this.hideTypingIndicator();
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = '💭 Generating response...';
        }
    }
    
    private completeGeneration(): void {
        this.isGenerating = false;
        this.hideTypingIndicator();
        
        // Remove the ID from the current message
        const currentMessage = document.getElementById('current-ai-message');
        if (currentMessage) {
            currentMessage.removeAttribute('id');
        }
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = '✅ Ready';
        }
        
        // Re-enable input
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
        if (chatInput) chatInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        
        // Focus input
        chatInput?.focus();
    }
    
    private handleError(error: string): void {
        this.isGenerating = false;
        this.hideTypingIndicator();
        
        // Add error message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.style.background = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.textContent = `❌ Error: ${error}`;
        this.messagesContainer?.appendChild(messageDiv);
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = '❌ Error occurred';
        }
        
        this.scrollToBottom();
    }
    
    private showTypingIndicator(): void {
        if (this.typingIndicator) {
            this.typingIndicator.classList.add('active');
        }
        
        // Disable input while generating
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
        if (chatInput) chatInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
    }
    
    private hideTypingIndicator(): void {
        if (this.typingIndicator) {
            this.typingIndicator.classList.remove('active');
        }
    }
    
    private scrollToBottom(): void {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
}