(function(){const y=document.createElement("link").relList;if(y&&y.supports&&y.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))I(n);new MutationObserver(n=>{for(const c of n)if(c.type==="childList")for(const g of c.addedNodes)g.tagName==="LINK"&&g.rel==="modulepreload"&&I(g)}).observe(document,{childList:!0,subtree:!0});function v(n){const c={};return n.integrity&&(c.integrity=n.integrity),n.referrerPolicy&&(c.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?c.credentials="include":n.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function I(n){if(n.ep)return;n.ep=!0;const c=v(n);fetch(n.href,c)}})();const{createApp:X,ref:u,computed:F,onMounted:Y,nextTick:H,watch:J}=Vue,O=[{id:"onnx-community/gemma-3-270m-it-ONNX",label:"Gemma 3 270M IT",sizeLabel:"~200 MB",webgpuDtype:"q4",wasmDtype:"q4",supportsSystemRole:!1},{id:"onnx-community/gemma-3-1b-it-ONNX",label:"Gemma 3 1B IT",sizeLabel:"~600 MB",webgpuDtype:"q4f16",wasmDtype:"q4",supportsSystemRole:!1},{id:"onnx-community/gemma-4-E2B-it-ONNX",label:"Gemma 4 E2B IT",sizeLabel:"~1.5 GB",webgpuDtype:{embed_tokens:"fp16",decoder_model_merged:"q4"},wasmDtype:"q4",supportsSystemRole:!0},{id:"onnx-community/granite-4.0-350m-ONNX-web",label:"IBM Granite 4.0 350M",sizeLabel:"~350 MB",webgpuDtype:"q4f16",wasmDtype:"q4",supportsSystemRole:!0}],K=`
    import { pipeline, TextStreamer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js';
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

    let generator = null;
    let history = [];
    let memoryBlock = '';
    let activeModelConfig = null;
    let tpsStart = null;
    let tokenCount = 0;

    const SYSTEM_PROMPT = 'You are a helpful AI assistant running locally in the browser. Answer concisely and accurately.';

    async function hasWebGPU() {
        if (!('gpu' in navigator)) return false;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            return !!adapter;
        } catch {
            return false;
        }
    }

    function describeError(err) {
        const message = (err && err.message) || (err && typeof err.toString === 'function' && err.toString()) || String(err);
        return { message, name: err && err.name };
    }

    function buildFullHistory() {
        const instruction = SYSTEM_PROMPT + (memoryBlock ? '\\n\\nPast context (memories):\\n' + memoryBlock : '');
        const recent = history.slice(-6).filter(m => m.role !== 'system' && m.content);
        if (activeModelConfig?.supportsSystemRole) {
            return [{ role: 'system', content: instruction }, ...recent];
        }
        // Gemma 3 chat template rejects role === 'system'; prepend context to first user turn instead
        if (!recent.length) return [];
        return recent.map((m, idx) => (idx === 0 && m.role === 'user')
            ? { role: 'user', content: instruction + '\\n\\nUser: ' + m.content }
            : m
        );
    }

    self.addEventListener('message', async (event) => {
        const { type, data } = event.data;

        if (type === 'init') {
            activeModelConfig = data.modelConfig;
            memoryBlock = data.memoryBlock || '';
            const modelId = activeModelConfig.id;

            try {
                let isLocal = false;
                if (data?.localModelPath) {
                    try {
                        const check = await fetch(data.localModelPath + modelId + '/config.json', { method: 'HEAD' });
                        isLocal = check.ok && (check.headers.get('content-type') || '').includes('json');
                    } catch {}
                }
                if (isLocal) env.localModelPath = data.localModelPath;
                env.allowLocalModels = isLocal;

                const progressCb = (p) => {
                    if (p.status === 'progress') {
                        self.postMessage({ type: 'progress', data: p });
                    }
                };

                const webgpuReady = await hasWebGPU();
                if (webgpuReady) {
                    self.postMessage({ type: 'status', data: { message: isLocal ? 'Loading ' + activeModelConfig.label + ' (local WebGPU)...' : 'Loading ' + activeModelConfig.label + ' (' + activeModelConfig.sizeLabel + ', WebGPU)...' } });
                    try {
                        generator = await pipeline('text-generation', modelId, {
                            dtype: activeModelConfig.webgpuDtype,
                            device: 'webgpu',
                            progress_callback: progressCb
                        });
                        self.postMessage({ type: 'ready', data: { device: 'webgpu' } });
                        return;
                    } catch (gpuErr) {
                        console.warn('WebGPU pipeline failed, falling back to WASM:', gpuErr);
                    }
                }

                self.postMessage({ type: 'status', data: { message: 'Loading ' + activeModelConfig.label + ' (' + activeModelConfig.sizeLabel + ', WASM)...' } });
                generator = await pipeline('text-generation', modelId, {
                    dtype: activeModelConfig.wasmDtype,
                    device: 'wasm',
                    progress_callback: progressCb
                });
                self.postMessage({ type: 'ready', data: { device: 'wasm' } });
            } catch (err) {
                console.error('Model init failed:', err);
                self.postMessage({ type: 'error', data: describeError(err) });
            }
        } else if (type === 'restore') {
            history = (data || [])
                .filter(m => m.role !== 'system' && m.content)
                .map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content }));
        } else if (type === 'memory_update') {
            memoryBlock = data || '';
        } else if (type === 'reset') {
            history = [];
        } else if (type === 'generate') {
            tpsStart = null;
            tokenCount = 0;
            const responseTokens = [];
            history.push({ role: 'user', content: data.message });

            try {
                const streamer = new TextStreamer(generator.tokenizer, {
                    skip_prompt: true,
                    skip_special_tokens: true,
                    callback_function: (token) => {
                        if (!tpsStart) tpsStart = performance.now();
                        tokenCount++;
                        responseTokens.push(token);
                        const elapsed = (performance.now() - tpsStart) / 1000;
                        const tps = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : '0.0';
                        self.postMessage({ type: 'token', data: { token, tps } });
                    }
                });

                const out = await generator(buildFullHistory(), {
                    max_new_tokens: 220,
                    temperature: 0.7,
                    top_p: 0.95,
                    do_sample: true,
                    streamer
                });
                const fallbackText = out?.[0]?.generated_text?.at?.(-1)?.content || '';
                const response = responseTokens.length ? responseTokens.join('') : fallbackText;
                history.push({ role: 'assistant', content: response });
                self.postMessage({ type: 'complete', data: { response } });
            } catch (err) {
                history.pop();
                console.error('Generation failed:', err);
                self.postMessage({ type: 'error', data: describeError(err) });
            }
        }
    });
    `;X({setup(){const _="gemma_chat_history",y="gemma_chat_selected_model",v="gmem4_",n=O,c=localStorage.getItem(y),g=u(O.some(e=>e.id===c)?c:O[0].id),M=F(()=>O.find(e=>e.id===g.value)||O[0]),a=u([]),b=u(""),f=u(!1),w=u(!0),S=u(!1),k=u(0),p=u("Initializing model worker..."),h=u("Detecting WebGPU / WASM..."),E=u(null),R=u(!1),G=u(!1),D=u(!1),L=u([]);let l=null,d=null,x="";const C=()=>{const e=[];for(let t=0;t<localStorage.length;t++){const o=localStorage.key(t);if(o&&o.startsWith(v))try{e.push(JSON.parse(localStorage.getItem(o)))}catch{}}L.value=e.sort((t,o)=>t.ts-o.ts)},U=(e,t)=>{const o=Date.now();localStorage.setItem(v+o,JSON.stringify({ts:o,q:e.slice(0,120),a:t.slice(0,180)}));const r=Object.keys(localStorage).filter(s=>s.startsWith(v)).sort();r.length>20&&r.slice(0,r.length-20).forEach(s=>localStorage.removeItem(s)),C()},P=(e=5)=>{const t=L.value.slice(-e);return t.length?t.map(o=>`[${new Date(o.ts).toLocaleString()}]
Q: ${o.q}
A: ${o.a}`).join(`

`):""},W=()=>{Object.keys(localStorage).filter(e=>e.startsWith(v)).forEach(e=>localStorage.removeItem(e)),C(),l&&l.postMessage({type:"memory_update",data:""})},A=()=>{const e=[`# Gemma Chat — Conversation Memory
`];L.value.forEach(s=>{e.push(`## ${new Date(s.ts).toLocaleString()}
**Q:** ${s.q}

**A:** ${s.a}
`)});const t=new Blob([e.join(`
`)],{type:"text/markdown"}),o=URL.createObjectURL(t),r=document.createElement("a");r.href=o,r.download=`gemma-memory-${new Date().toISOString().slice(0,10)}.md`,r.click(),URL.revokeObjectURL(o)},N=()=>{const e=localStorage.getItem(_);if(e)try{a.value=JSON.parse(e);return}catch{}a.value=[{id:0,role:"bot",content:`Hello! Ready to run ${M.value.label} entirely in your browser.`}]},T=async()=>{await H(),E.value&&(E.value.scrollTop=E.value.scrollHeight)};J(a,()=>{localStorage.setItem(_,JSON.stringify(a.value)),T()},{deep:!0});const $=()=>{localStorage.removeItem(_),a.value=[{id:0,role:"bot",content:"Chat history cleared."}],l&&l.postMessage({type:"reset"})},j=()=>{if(R.value){d?.stop();return}const e=window.SpeechRecognition||window.webkitSpeechRecognition;if(!e){p.value="Voice input not supported in this browser.";return}d=new e,d.continuous=!0,d.interimResults=!0,d.lang="en-US";let t=b.value;d.onstart=()=>{R.value=!0},d.onend=()=>{R.value=!1},d.onerror=()=>{R.value=!1},d.onresult=o=>{let r="",s="";for(let i=o.resultIndex;i<o.results.length;i++){const m=o.results[i][0].transcript;o.results[i].isFinal?s+=m:r+=m}s&&(t=(t+" "+s).trim()),b.value=(t+(r?" "+r:"")).trim()},d.start()},q=()=>{const e=b.value.trim();!e||f.value||w.value||(x=e,a.value.push({id:Date.now(),role:"user",content:e}),a.value.push({id:Date.now()+1,role:"bot",content:""}),b.value="",f.value=!0,p.value="Generating...",l.postMessage({type:"generate",data:{message:e}}))},B=e=>{l&&(l.terminate(),l=null),w.value=!0,S.value=!1,k.value=0;const t=new Blob([K],{type:"application/javascript"});l=new Worker(URL.createObjectURL(t),{type:"module"}),l.onerror=o=>{S.value=!0,f.value=!1,p.value="Worker error: "+(o?.message||"Failed to start worker"),h.value="Worker failed"},l.onmessage=o=>{const{type:r,data:s}=o.data;if(r==="progress")typeof s.progress=="number"&&(k.value=Math.min(100,Math.round(s.progress))),s.file&&(p.value=`Downloading ${s.file} (${k.value}%)`);else if(r==="ready")w.value=!1,S.value=!1,k.value=100,p.value="Ready",h.value=`${M.value.label} on ${s.device==="webgpu"?"WebGPU":"WASM"}`,e?.length&&l.postMessage({type:"restore",data:e});else if(r==="token"){const i=a.value[a.value.length-1];i&&i.role==="bot"&&(i.content+=s.token),s.tps&&(p.value=`Generating... ${s.tps} tok/s`)}else if(r==="complete"){f.value=!1,p.value="Ready",document.getElementById("user-input")?.focus();const i=a.value.filter(m=>m.role==="bot"&&m.content).at(-1);x&&i?.content&&(U(x,i.content),l&&l.postMessage({type:"memory_update",data:P()}))}else if(r==="status")p.value=s.message;else if(r==="error"){const i=s&&s.message||String(s),m=a.value[a.value.length-1];m?.role==="bot"&&!m.content&&a.value.pop(),f.value=!1,S.value=w.value,i.includes("OrtRun")?(p.value="GPU session ended (context memory limit). Reload page to reset.",h.value="GPU OOM"):(p.value=`Error: ${i}`,h.value=i)}},l.postMessage({type:"init",data:{modelConfig:M.value,localModelPath:location.origin+"/gemma-chat-app/models/",memoryBlock:P()}})},z=()=>{localStorage.setItem(y,g.value);const e=a.value.map(t=>({role:t.role==="bot"?"assistant":t.role,content:t.content}));p.value=`Switching to ${M.value.label}...`,h.value="Restarting worker...",B(e)};return window._appendToken=e=>{const t=a.value[a.value.length-1];t&&t.role==="bot"&&(t.content+=e)},window._setGenerating=e=>{f.value=e,e||(p.value="Ready")},Y(()=>{C(),N(),T();const e=a.value.map(t=>({role:t.role==="bot"?"assistant":t.role,content:t.content}));B(e)}),{modelOptions:n,selectedModelId:g,activeModelMeta:M,messages:a,inputText:b,isGenerating:f,isLoading:w,loadError:S,loadingProgress:k,statusText:p,deviceInfo:h,chatContainer:E,isRecording:R,showMemory:G,showRefs:D,memories:L,sendMessage:q,clearMessages:$,exportMemories:A,clearMemories:W,toggleVoice:j,switchModel:z}}}).mount("#app");
