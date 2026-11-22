# Multi-Model WebGPU Browser AI Chat (Gemma 3/4, Qwen 3.5, LFM 2.5/3, Granite 4.0, SmolLM2)

## 🌐 [Live Demo](https://1kaiser.github.io/gemma-chat-app/)

![Gemma Chat Demo](gemma-chat-demo-final.gif)

A client-side browser AI chat workspace built with **Transformers.js v4.3.2**, **WebGPU (`shader-f16` auto-detection)** with **WASM fallback**, **Web Workers**, and **Vue 3** — supporting Google **Gemma 3 & Gemma 4**, Alibaba **Qwen 3 & Qwen 3.5**, Liquid AI **LFM 2.5 & LFM 3**, IBM **Granite 4.0**, and Hugging Face **SmolLM2**.

## 🧠 About Gemma 3 270M

Gemma 3 270M is a compact and efficient AI model from Google's Gemma 3 family, featuring 270 million parameters. It is engineered for fast, task-specific fine-tuning without the need for powerful hardware, making it ideal for on-device applications.

The model's architecture is noteworthy: 170 million parameters are allocated to a vast 256,000-token vocabulary, while the remaining 100 million parameters power its transformer blocks. This structure provides a robust foundation for fine-tuning across various languages and specialized fields. Gemma 3 270M is available in both pre-trained and instruction-tuned versions, excelling at targeted tasks such as text classification, entity extraction, and structured text generation, rather than general, open-ended conversations. It's a text-only model and does not support image input.

### Model Architecture Overview

```
            +---------------------------+
            |      Gemma 3 270M         |
            +---------------------------+
                   |
                   V
+----------------------------------------------------+
|               Compact & Efficient AI Model         |
+----------------------------------------------------+
|                                                    |
|   +-----------------+   +------------------------+ |
|   |  Architecture   |   |      Key Features      | |
|   +-----------------+   +------------------------+ |
|   |                 |   |                        | |
|   | 270M Parameters |-->|--> Small & Lightweight  | |
|   |   - 170M Vocab  |   |--> Specialized Tasks   | |
|   |   - 100M Core   |   |--> Power Efficient      | |
|   |                 |   |--> Large Vocabulary    | |
|   +-----------------+   +------------------------+ |
|                                                    |
+----------------------------------------------------+
                   |
                   V
+----------------------------------------------------+
|                  Ideal For                         |
+----------------------------------------------------+
|                                                    |
|  - On-Device AI (Mobile Phones)                    |
|  - Text Classification                             |
|  - Data Extraction                                 |
|  - Fine-tuning for specific domains                |
|                                                    |
+----------------------------------------------------+
```

**Sources:**
- [Google Developers Blog - Introducing Gemma 3 270M](https://developers.googleblog.com/en/introducing-gemma-3-270m/)
- [Gemma 3 - Google DeepMind](https://deepmind.google/models/gemma/gemma-3/)
- [HuggingFace - google/gemma-3-270m](https://huggingface.co/google/gemma-3-270m)
- [DataCamp - Gemma 3 270M Guide](https://www.datacamp.com/tutorial/gemma-3-270m)

## ✨ Features

- 🤖 **Gemma 3 270M ONNX** model running entirely in the browser
- ⚡ **Automatic WebGPU/WASM fallback** - works in any modern browser
- 🗄️ **Smart caching** - 270MB model cached locally, 5-15s subsequent loads
- 🌐 **Network accessibility** - auto-detects local IP for cross-device access
- 🔄 **Web Workers** for non-blocking model inference
- 💬 **Real-time chat interface** with streaming responses
- 🛑 **Stop generation** - interrupt responses with timer feedback
- 💾 **Save conversations** - export chat as timestamped TXT files
- 🎯 **Context awareness** - maintains conversation history
- 📱 **Responsive design** with modern UI
- 🔒 **Complete privacy** - no data leaves your device

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GEMMA CHAT APP - FULL ARCHITECTURE              │
└─────────────────────────────────────────────────────────────────────────┘

                              [User Browser]
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              ┌─────▼─────┐                 ┌──────▼──────┐
              │  index.html│                 │  Vite Dev   │
              │    (UI)    │◄────────────────│   Server    │
              │            │  WebSocket/HTTP │  Port 3001  │
              └─────┬─────┘                 └──────┬──────┘
                    │                               │
         ┌──────────┴──────────┐           ┌───────┴───────┐
         │                     │           │   Shutdown    │
    ┌────▼────┐         ┌──────▼─────┐    │   Endpoint    │
    │main.ts  │         │chatManager │    │  /api/shutdown│
    │WebGPU   │◄────────┤   .ts      │    └───────────────┘
    │Detection│         │UI Control  │
    └────┬────┘         └──────┬─────┘
         │                     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │    Web Worker       │
         │  (modelWorker.ts)   │
         │                     │
         │ ┌─────────────────┐ │
         │ │ Transformers.js │ │
         │ │   Pipeline      │ │
         │ └────────┬────────┘ │
         │          │          │
         │ ┌────────▼────────┐ │
         │ │  Gemma 270M     │ │
         │ │  ONNX Model     │ │
         │ │   (~270MB)      │ │
         │ └────────┬────────┘ │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   WebGPU/WASM API   │
         │  Auto-Detection     │
         │                     │
         │ • WebGPU (if avail) │
         │ • WASM (fallback)   │
         │ • Cross-browser     │
         └─────────────────────┘

DATA FLOW:
=========
1. User Input → Main Thread → Web Worker Message
2. Web Worker → Device Detection → WebGPU/WASM Selection
3. Transformers.js → ONNX Model Load → Compute
4. Streaming Tokens → Web Worker → Main Thread
5. Main Thread → UI Update → User Display

NETWORK ACCESS:
==============
• Local: http://localhost:3001
• Network: http://[auto-detected-IP]:3001
• Cross-device: Access from phones, tablets, other computers

SHUTDOWN FLOW:
=============
1. User clicks Shutdown Button → POST /api/shutdown
2. Express Server → Graceful shutdown → Process exit
3. Alternative: Ctrl+C → SIGINT handler → Clean exit

PERFORMANCE:
===========
• Model Loading: 30-120s (first), 5-15s (cached)
• Token Generation: 10-50 tokens/sec
• Memory Usage: 400-800MB active
• GPU Utilization: Variable by hardware
```

### Core Components:

1. **Main Thread** (`src/main.ts`, `src/chatManager.ts`)
   - UI management and user interactions
   - Chat message display and input handling
   - Progress tracking and error handling

2. **Model Worker** (`src/modelWorker.ts`)
   - Gemma 270M model initialization
   - Text generation with streaming tokens
   - Conversation context management

3. **Device Detection & Compute**
   - Automatic WebGPU/WASM detection and selection
   - GPU-accelerated inference when available
   - WASM fallback for universal browser support
   - Memory-efficient processing

## 🚀 Quick Start

### ⚡ One-liner GitHub Execution (Recommended)

Run the app directly from GitHub without cloning:

```bash
# Run immediately from GitHub (works in any modern browser)
npx github:kaiser/gemma-chat-app
```

This will:
- ✅ Download the app temporarily  
- ✅ Install all dependencies
- ✅ Start the server at http://localhost:3001 + network IP
- ✅ Auto-detect WebGPU/WASM capabilities
- ✅ Work across devices on your local network

### Prerequisites

- Node.js 18+ 
- **Any modern browser** (Chrome, Firefox, Safari, Edge)
- ~500MB available RAM for model
- Optional: WebGPU-enabled browser for faster performance

### Manual Installation (Alternative)

```bash
# Clone and install
git clone <this-repo>
cd gemma-chat-app
npm install

# Start development server
npm run dev
```

Visit: 
- http://localhost:3001 (local access)
- http://[network-ip]:3001 (cross-device access)

### Testing

```bash
# Run Playwright tests with WebGPU
npm run test

# Run with headed browser (for debugging)
npm run test:headed
```

## 🎯 Browser Compatibility

### Automatic Device Detection:
The app automatically detects your browser's capabilities:
- **WebGPU Available**: Uses GPU acceleration for faster inference
- **WebGPU Not Available**: Falls back to WASM for universal compatibility

### Browser Support:
- ✅ Chrome (any version) - WebGPU or WASM
- ✅ Firefox (any version) - WASM fallback
- ✅ Safari (any version) - WASM fallback  
- ✅ Edge (any version) - WebGPU or WASM

### Optional WebGPU Acceleration:
For fastest performance in Chrome/Edge, enable WebGPU flags:
```bash
--enable-unsafe-webgpu
--enable-features=WebGPU
--enable-webgpu-developer-features
```

## 📊 Performance

### Model Loading:
- **First load**: ~30-120 seconds (downloads 270MB model)
- **Subsequent loads**: ~5-15 seconds (cached)

### Response Generation:
- **Typical response**: 2-10 seconds
- **Streaming**: Tokens appear in real-time
- **Memory usage**: ~400-800MB

### Benchmarks:
```
Model: Gemma 3 270M ONNX
WebGPU Mode: 10-50 tokens/second (depends on GPU)
WASM Mode: 5-25 tokens/second (CPU-based)
Cross-browser: Universal compatibility
```

## 🧪 Testing with Playwright

The project includes comprehensive Playwright tests for:

- ✅ WebGPU availability detection
- ✅ Model loading and initialization
- ✅ Chat interaction and streaming
- ✅ Conversation context maintenance
- ✅ Error handling and recovery
- ✅ Performance monitoring

### Test Configuration:

```typescript
// playwright.config.ts
projects: [
  {
    name: 'chrome-webgpu',
    use: { 
      launchOptions: {
        executablePath: '/usr/bin/google-chrome',
        args: [
          '--enable-unsafe-webgpu',
          '--enable-features=WebGPU',
          // ... more WebGPU flags
        ],
      },
    },
  },
]
```

## 📁 Project Structure

```
gemma-chat-app/
├── src/
│   ├── main.ts           # Application entry point
│   ├── chatManager.ts    # Chat logic coordination
│   └── modelWorker.ts    # Web worker for Gemma inference
├── tests/
│   └── gemma-chat.spec.ts # Comprehensive test suite
├── index.html            # Main HTML with embedded CSS
├── vite.config.ts        # Vite configuration
├── playwright.config.ts  # Testing configuration
└── package.json          # Dependencies and scripts
```

## 🔧 Development

### Available Scripts:
```bash
npm run dev         # Start Vite development server
npm run start       # Start server with shutdown endpoint
npm run dev:server  # Alternative server start command
npm run build       # Build for production
npm run preview     # Preview production build
npm run test        # Run Playwright tests

# Convenience scripts
./start-server.sh   # Start server with port check and cleanup
./stop-server.sh    # Stop all server processes on port 3001
```

### Environment Variables:
```bash
# Optional: Custom model endpoint
VITE_MODEL_URL=custom-gemma-model-url
```

## 🎨 Customization

### Modify Model Parameters:
```typescript
// src/modelWorker.ts
const output = await generator(messages, {
  max_new_tokens: 256,    // Response length
  temperature: 0.7,       // Creativity (0-1)
  top_p: 0.95,           // Nucleus sampling
  do_sample: true,       // Enable sampling
});
```

### UI Styling:
The CSS is embedded in `index.html` for simplicity. Key classes:
- `.container` - Main chat container
- `.message` - Chat message styling
- `.user-message` / `.ai-message` - Message types
- `.loading-overlay` - Model loading screen

## 🚨 Troubleshooting

### Common Issues:

**1. Automatic Fallback Working:**
```
Info: WebGPU not available, using WASM
Solution: No action needed - app will work with WASM
```

**2. Model Loading Fails:**
```
Error: Failed to load model
Solution: Check network connection, clear browser cache
```

**3. Out of Memory:**
```
Error: GPU memory exceeded
Solution: Close other tabs, reduce max_new_tokens
```

**4. Slow Performance:**
```
Issue: Responses take too long
Solution: Use WebGPU-enabled browser, close other tabs, or use WASM mode
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - feel free to use this project for learning and development!

## 🙏 Acknowledgments

### Core Technologies
- **HuggingFace Transformers.js** - Browser-based ML inference framework ([Docs](https://huggingface.co/docs/transformers.js/en/index))
- **Google Gemma 3 270M ONNX** - Open language model optimized for browsers ([Model](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX), [Base](https://huggingface.co/google/gemma-3-270m))
- **WebGPU** - GPU acceleration in browsers
- **WebAssembly (WASM)** - High-performance browser runtime
- **Vite** - Fast development and build tool

### Research & Inspiration
- **Simon Willison** - Extensive documentation of browser AI capabilities and Transformers.js applications, including early testing of Gemma 3 270M as "absolutely tiny, just a 241MB download" ([Tweet](https://x.com/simonw/status/1956044677796577457))
- **Google DeepMind** - Gemma model family and smaller efficient models approach ([Gemma 3](https://blog.google/technology/developers/gemma-3/), [Gemma 3 270M](https://developers.googleblog.com/en/introducing-gemma-3-270m/))
- **WebLLM Project** - High-performance in-browser LLM inference engine research
- **Chrome Developer Relations** - WebGPU and WebAssembly AI performance enhancements

### Key Academic References
- Gemma Team, Google DeepMind (2025). *Gemma 3 Technical Report*. [arXiv:2503.19786](https://arxiv.org/abs/2503.19786).
- Supported ONNX Models (`onnx-community`, `@huggingface/transformers@4.3.2`):
  - **Note on CPU WASM fallback**: `SmolLM2 360M Instruct` is verified for CPU-only WASM (`q4`) fallback; 4-bit quantized Gemma 3/4, LFM 2.5/3, Qwen 3/3.5, and Granite 4.0 models require WebGPU (`GatherBlockQuantized` is not implemented in ONNX Runtime CPU WASM).
  - **Google Gemma**: [`gemma-3-270m-it-ONNX`](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX), [`gemma-3-1b-it-ONNX`](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX), [`gemma-4-E2B-it-ONNX`](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX).
  - **Alibaba Qwen**: [`Qwen3-0.6B-ONNX-OPT`](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX-OPT), [`Qwen3.5-0.8B-Text-ONNX`](https://huggingface.co/onnx-community/Qwen3.5-0.8B-Text-ONNX) ([arXiv:2505.09388](https://arxiv.org/abs/2505.09388)).
  - **Liquid AI**: [`LFM2.5-350M-ONNX`](https://huggingface.co/onnx-community/LFM2.5-350M-ONNX), [`LFM3-1.7B-ONNX`](https://huggingface.co/onnx-community/LFM3-1.7B-ONNX).
  - **IBM Granite & Hugging Face SmolLM2**: [`granite-4.0-350m-ONNX-web`](https://huggingface.co/onnx-community/granite-4.0-350m-ONNX-web), [`SmolLM2-360M-Instruct-ONNX`](https://huggingface.co/onnx-community/SmolLM2-360M-Instruct-ONNX) ([arXiv:2502.02737](https://arxiv.org/abs/2502.02737)).
- Ruan, C.F., Qin, Y., Zhou, X., et al. (2024). "WebLLM: A High-Performance In-Browser LLM Inference Engine." [arXiv:2412.15803](https://arxiv.org/abs/2412.15803).
- [Hugging Face Transformers.js v4](https://huggingface.co/docs/transformers.js) & [ONNX Runtime Web](https://onnxruntime.ai/).
- Part of [1kaiser.github.io](https://1kaiser.github.io/).

### Community Inspiration  
- **Browser AI Community** - Pioneering local inference and privacy-first approaches
- **Open Source AI Movement** - Making advanced language models accessible to everyone
- **Educational AI Projects** - Including bedtime story generators ([svharivinod/ai-story-generator](https://github.com/svharivinod/ai-story-generator)) and interactive learning tools
- **Fully Local PDF Chatbot** - Complete RAG pipeline inspiration ([jacoblee93/fully-local-pdf-chatbot](https://github.com/jacoblee93/fully-local-pdf-chatbot))

## 📈 Project Status

**Current Status**: ✅ **FULLY OPERATIONAL** (Aug 29, 2025)

### Recent Updates:
- ✅ **Universal Browser Support** - Automatic WebGPU/WASM fallback system
- ✅ **Network Accessibility** - Auto-detects local IP for cross-device access
- ✅ **Comprehensive Testing Suite** - Playwright tests with multiple browser support
- ✅ **Performance Optimized** - Real-time streaming, Web Workers, memory efficient
- ✅ **Production Ready** - Complete error handling, fallbacks, and user experience
- ✅ **NPX Ready** - One-command GitHub execution via `npx github:kaiser/gemma-chat-app`

### Verification Results:
- **Model Loading**: ✅ Gemma 270M ONNX downloads and initializes correctly
- **Device Detection**: ✅ Automatic WebGPU/WASM selection and fallback
- **Network Access**: ✅ Auto-detects local IP for cross-device compatibility
- **Chat Interface**: ✅ Real-time streaming responses with typing indicators
- **Context Management**: ✅ Multi-turn conversations with history
- **Error Recovery**: ✅ Graceful handling of device failures and network issues
- **Memory Management**: ✅ Efficient model loading and cleanup

### Performance Benchmarks:
```
✅ Model Download: ~270MB (one-time)
✅ Initialization: 30-120s first run, 5-15s cached
✅ Response Time: 2-10 seconds with real-time streaming
✅ Memory Usage: 400-800MB during active chat
✅ Token Generation: 10-50 tokens/sec (WebGPU), 5-25 tokens/sec (WASM)
✅ Browser Support: Universal - Chrome, Firefox, Safari, Edge
```

### Development Environment:
- **Server**: http://localhost:3001 + network IP (auto-detected)
- **Testing**: Comprehensive Playwright multi-browser test suite
- **Build**: Production-ready Vite build system
- **Dependencies**: HuggingFace Transformers.js 3.0.2, WebGPU/WASM support

---

**Built with ❤️ for the browser AI community**

*Ready for production deployment and educational use*