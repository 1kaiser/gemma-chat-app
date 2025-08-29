// Chat Manager - Coordinates between UI and Worker
export class ChatManager {
    private worker: Worker | null = null;
    private messagesContainer: HTMLElement | null = null;
    private typingIndicator: HTMLElement | null = null;
    private statusElement: HTMLElement | null = null;
    public isGenerating: boolean = false;
    public onProgress?: (progress: number, message: string) => void;
    private startTime: number = 0;
    private timerInterval: number | null = null;
    private shouldStop: boolean = false;
    
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.typingIndicator = null; // No longer using typing indicator
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
        this.startTimer();
        
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
        // (Timer continues running on send button)
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = '💭 Generating response...';
        }
    }
    
    private completeGeneration(): void {
        if (this.shouldStop) return; // Don't complete if stopped by user
        
        this.isGenerating = false;
        this.stopTimer();
        
        // Remove the ID from the current message
        const currentMessage = document.getElementById('current-ai-message');
        if (currentMessage) {
            currentMessage.removeAttribute('id');
        }
        
        // Reset UI
        this.resetUI();
    }
    
    private handleError(error: string): void {
        this.isGenerating = false;
        this.stopTimer();
        
        // Add error message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.style.background = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.textContent = `❌ Error: ${error}`;
        this.messagesContainer?.appendChild(messageDiv);
        
        // Reset UI
        this.resetUI();
        this.scrollToBottom();
    }
    
    private startTimer(): void {
        this.shouldStop = false;
        
        // Disable input while generating
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
        const stopButton = document.getElementById('stopButton') as HTMLButtonElement;
        
        if (chatInput) chatInput.disabled = true;
        
        // Show stop button and hide send button
        if (sendButton && stopButton) {
            sendButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            stopButton.onclick = () => this.stopGeneration();
        }
        
        // Start timer on stop button
        this.startTime = Date.now();
        if (stopButton) {
            this.updateButtonTimer(stopButton);
        }
    }
    
    private updateButtonTimer(button: HTMLButtonElement): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            if (!this.isGenerating || this.shouldStop) {
                clearInterval(this.timerInterval!);
                return;
            }
            
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            button.textContent = `Stop (${elapsed}s)`;
        }, 100) as any; // Update every 100ms for smooth display
    }
    
    private stopGeneration(): void {
        this.shouldStop = true;
        this.isGenerating = false;
        this.stopTimer();
        
        // Send stop message to worker
        if (this.worker) {
            this.worker.postMessage({ type: 'stop' });
        }
        
        // Add stopped message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.style.background = '#fef3c7';
        messageDiv.style.color = '#92400e';
        messageDiv.textContent = '⏹️ Generation stopped by user';
        this.messagesContainer?.appendChild(messageDiv);
        
        // Reset UI
        this.resetUI();
        this.scrollToBottom();
    }
    
    private stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    private resetUI(): void {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
        const stopButton = document.getElementById('stopButton') as HTMLButtonElement;
        
        // Re-enable input and show send button
        if (chatInput) chatInput.disabled = false;
        if (sendButton && stopButton) {
            sendButton.style.display = 'inline-block';
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
            stopButton.style.display = 'none';
            stopButton.textContent = 'Stop';
        }
        
        // Update status
        if (this.statusElement) {
            this.statusElement.textContent = 'Universal Browser Support + Transformers.js + Web Workers';
        }
        
        // Focus input
        chatInput?.focus();
    }
    
    public setupSaveButton(): void {
        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveChatToFile());
        }
    }
    
    public resetConversation(): void {
        // Clear message history in worker
        if (this.worker) {
            this.worker.postMessage({ type: 'reset' });
        }
    }
    
    private saveChatToFile(): void {
        if (!this.messagesContainer) return;
        
        const messages = this.messagesContainer.querySelectorAll('.message');
        if (messages.length === 0) {
            alert('No messages to save!');
            return;
        }
        
        // Create chat export content
        const now = new Date();
        const timestamp = now.toLocaleString();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        let chatContent = `🪩 Gemma 3 270M Chat Export 🪩\n`;
        chatContent += `Date: ${timestamp}\n`;
        chatContent += `Model: Google Gemma 3 270M ONNX\n`;
        chatContent += `Generated with: Gemma 3 270M - Universal Browser AI\n\n`;
        chatContent += `${'='.repeat(60)}\n\n`;
        
        // Extract messages
        messages.forEach((message, index) => {
            const isUser = message.classList.contains('user-message');
            const isAI = message.classList.contains('ai-message');
            const text = message.textContent || '';
            
            if (isUser) {
                chatContent += `USER: ${text}\n\n`;
            } else if (isAI && !text.includes('⏹️ Generation stopped') && !text.includes('❌ Error:')) {
                chatContent += `GEMMA 3 270M: ${text}\n\n`;
            } else if (text.includes('⏹️ Generation stopped')) {
                chatContent += `[Generation stopped by user]\n\n`;
            } else if (text.includes('❌ Error:')) {
                chatContent += `[Error occurred: ${text.replace('❌ Error: ', '')}]\n\n`;
            }
        });
        
        chatContent += `${'='.repeat(60)}\n`;
        chatContent += `End of chat export - ${timestamp}\n`;
        chatContent += `Total messages: ${messages.length}\n`;
        
        // Create and download file
        const blob = new Blob([chatContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemma3-270m-chat-${dateStr}-${timeStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show confirmation
        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = '✅ Saved!';
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 2000);
        }
    }
    
    private scrollToBottom(): void {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
}