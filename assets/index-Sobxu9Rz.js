(function(){const d=document.createElement("link").relList;if(d&&d.supports&&d.supports("modulepreload"))return;for(const c of document.querySelectorAll('link[rel="modulepreload"]'))b(c);new MutationObserver(c=>{for(const p of c)if(p.type==="childList")for(const B of p.addedNodes)B.tagName==="LINK"&&B.rel==="modulepreload"&&b(B)}).observe(document,{childList:!0,subtree:!0});function P(c){const p={};return c.integrity&&(p.integrity=c.integrity),c.referrerPolicy&&(p.referrerPolicy=c.referrerPolicy),c.crossOrigin==="use-credentials"?p.credentials="include":c.crossOrigin==="anonymous"?p.credentials="omit":p.credentials="same-origin",p}function b(c){if(c.ep)return;c.ep=!0;const p=P(c);fetch(c.href,p)}})();const{createApp:ye,ref:l,computed:W,onMounted:he,nextTick:ve,watch:be}=Vue,I=[{id:"onnx-community/gemma-3-270m-it-ONNX",label:"Gemma 3 270M IT",sizeLabel:"~273 MB",tier:"fast",note:"Compact Google Gemma 3",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:800,supportsSystemRole:!1},{id:"onnx-community/LFM2.5-350M-ONNX",label:"Liquid LFM 2.5 350M",sizeLabel:"~255 MB",tier:"fast",note:"2026 fast edge architecture",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/Qwen3-0.6B-ONNX-OPT",label:"Qwen 3 0.6B Opt",sizeLabel:"~355 MB",tier:"fast",note:"Reasoning + <think> tags",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/granite-4.0-350m-ONNX-web",label:"IBM Granite 4.0 350M",sizeLabel:"~350 MB",tier:"fast",note:"Hybrid Mamba/Transformer",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/SmolLM2-360M-Instruct-ONNX",label:"SmolLM2 360M Instruct (WASM OK)",sizeLabel:"~272 MB",tier:"fast",note:"WebGPU + CPU WASM compatible",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/Qwen3.5-0.8B-Text-ONNX",label:"Qwen 3.5 0.8B Text",sizeLabel:"~469 MB",tier:"fast",note:"2026 Qwen 3.5 text model",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/gemma-3-1b-it-ONNX",label:"Gemma 3 1B IT",sizeLabel:"~763 MB",tier:"large",note:"Higher quality Gemma 3",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:800,supportsSystemRole:!1},{id:"onnx-community/LFM3-1.7B-ONNX",label:"Liquid LFM 3 1.7B",sizeLabel:"~1.09 GB",tier:"large",note:"2026 Liquid 1.7B model",webgpuF16Dtype:"q4f16",webgpuNoF16Dtype:"q4",wasmDtype:"q4",maxHistoryChars:3200,supportsSystemRole:!0},{id:"onnx-community/gemma-4-E2B-it-ONNX",label:"Gemma 4 E2B IT (8GB+)",sizeLabel:"~3.1 GB",tier:"large",note:"Oct 2026 Gemma 4 E2B",webgpuF16Dtype:{embed_tokens:"q4f16",decoder_model_merged:"q4f16"},webgpuNoF16Dtype:{embed_tokens:"q4",decoder_model_merged:"q4"},wasmDtype:{embed_tokens:"q4",decoder_model_merged:"q4"},maxHistoryChars:3200,supportsSystemRole:!0}],j="You are a helpful AI assistant running locally in the browser. Answer concisely and accurately.",we=`
    import { pipeline, TextStreamer, InterruptableStoppingCriteria, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

    let generator = null;
    let history = [];
    let memoryBlock = '';
    let activeModelConfig = null;
    let customSystemPrompt = '';
    let activeStoppingCriteria = null;
    let tpsStart = null;
    let tokenCount = 0;

    async function detectWebGPU() {
        if (!('gpu' in navigator)) return { supported: false, hasF16: false };
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return { supported: false, hasF16: false };
            const hasF16 = !!(adapter.features && adapter.features.has('shader-f16'));
            return { supported: true, hasF16 };
        } catch {
            return { supported: false, hasF16: false };
        }
    }

    function describeError(err) {
        const message = (err && err.message) || (err && typeof err.toString === 'function' && err.toString()) || String(err);
        return { message, name: err && err.name };
    }

    function normalizeHistory(rawHistory, maxTurns = 8, maxChars = 3200) {
        const cleaned = [];
        for (const item of rawHistory || []) {
            if (!item || item.isGreeting) continue;
            const text = typeof item.content === 'string' ? item.content.trim() : '';
            if (!text) continue;
            const rawRole = item.role === 'bot' ? 'assistant' : item.role;
            if (rawRole !== 'user' && rawRole !== 'assistant') continue;
            if (cleaned.length && cleaned[cleaned.length - 1].role === rawRole) {
                cleaned[cleaned.length - 1] = {
                    role: rawRole,
                    content: cleaned[cleaned.length - 1].content + '\\n\\n' + text
                };
            } else {
                cleaned.push({ role: rawRole, content: text });
            }
        }
        while (cleaned.length && cleaned[0].role !== 'user') {
            cleaned.shift();
        }
        const lastUser = cleaned.filter(m => m.role === 'user').at(-1);
        const sliced = cleaned.slice(-maxTurns);
        while (sliced.length && sliced[0].role !== 'user') {
            sliced.shift();
        }
        if (sliced.length > 1) {
            const perOlderCap = Math.max(120, Math.floor(maxChars * 0.45));
            for (let i = 0; i < sliced.length - 1; i++) {
                if (sliced[i].content.length > perOlderCap) {
                    sliced[i] = {
                        role: sliced[i].role,
                        content: sliced[i].content.slice(0, perOlderCap).trimEnd() + '...'
                    };
                }
            }
        }
        const totalChars = () => sliced.reduce((sum, m) => sum + m.content.length, 0);
        while (totalChars() > maxChars && sliced.length > 1) {
            sliced.shift();
            while (sliced.length && sliced[0].role !== 'user') {
                sliced.shift();
            }
        }
        if (!sliced.length && lastUser) {
            return [lastUser];
        }
        return sliced;
    }

    function buildMessagesForModel(baseInstruction, isDefaultPrompt) {
        const recent = normalizeHistory(history, 8, activeModelConfig?.maxHistoryChars || 3200);
        if (!recent.length) return [];
        const fullInstruction = (baseInstruction || '') + (memoryBlock ? '\\n\\nPast context (memories):\\n' + memoryBlock : '');
        if (activeModelConfig?.supportsSystemRole) {
            return [{ role: 'system', content: fullInstruction }, ...recent];
        }
        // Gemma 3 chat template forbids system role; only inject context when customized or memory exists
        if (!memoryBlock && isDefaultPrompt) {
            return recent;
        }
        return recent.map((m, idx) => (idx === 0 && m.role === 'user')
            ? { role: 'user', content: 'Context:\\n' + fullInstruction + '\\n\\nQuestion: ' + m.content }
            : m
        );
    }

    function dtypeLabel(dtypeVal) {
        if (typeof dtypeVal === 'string') return dtypeVal;
        if (dtypeVal && typeof dtypeVal === 'object') return dtypeVal.decoder_model_merged || dtypeVal.model || 'q4';
        return 'q4';
    }

    self.addEventListener('message', async (event) => {
        const { type, data } = event.data;

        if (type === 'init') {
            activeModelConfig = data.modelConfig;
            memoryBlock = data.memoryBlock || '';
            customSystemPrompt = data.systemPrompt || '';
            const modelId = activeModelConfig.id;
            const forceWasm = data.backendPref === 'wasm';
            const fileProgress = new Map();

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
                    if (!p || !p.file) return;
                    if (p.status === 'progress') {
                        fileProgress.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
                    } else if (p.status === 'done') {
                        const prev = fileProgress.get(p.file);
                        if (prev && prev.total) {
                            fileProgress.set(p.file, { loaded: prev.total, total: prev.total });
                        }
                    } else {
                        return;
                    }
                    let loadedBytes = 0;
                    let totalBytes = 0;
                    for (const v of fileProgress.values()) {
                        loadedBytes += v.loaded;
                        totalBytes += v.total;
                    }
                    const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
                    self.postMessage({
                        type: 'progress',
                        data: { file: p.file, loadedBytes, totalBytes, percent }
                    });
                };

                const gpuInfo = forceWasm ? { supported: false, hasF16: false } : await detectWebGPU();
                if (gpuInfo.supported) {
                    const chosenGpuDtype = gpuInfo.hasF16 ? activeModelConfig.webgpuF16Dtype : activeModelConfig.webgpuNoF16Dtype;
                    const label = dtypeLabel(chosenGpuDtype);
                    self.postMessage({
                        type: 'status',
                        data: { message: 'Loading ' + activeModelConfig.label + ' (' + activeModelConfig.sizeLabel + ', WebGPU ' + label + ')...' }
                    });
                    try {
                        generator = await pipeline('text-generation', modelId, {
                            dtype: chosenGpuDtype,
                            device: 'webgpu',
                            progress_callback: progressCb
                        });
                        self.postMessage({ type: 'ready', data: { device: 'webgpu', dtype: label } });
                        return;
                    } catch (gpuErr) {
                        console.warn('WebGPU pipeline failed, falling back to WASM:', gpuErr);
                    }
                }

                const wasmDtype = activeModelConfig.wasmDtype || 'q4';
                const wasmLabel = dtypeLabel(wasmDtype);
                self.postMessage({
                    type: 'status',
                    data: { message: 'Loading ' + activeModelConfig.label + ' (' + activeModelConfig.sizeLabel + ', WASM ' + wasmLabel + ')...' }
                });
                generator = await pipeline('text-generation', modelId, {
                    dtype: wasmDtype,
                    device: 'wasm',
                    progress_callback: progressCb
                });
                self.postMessage({ type: 'ready', data: { device: 'wasm', dtype: wasmLabel } });
            } catch (err) {
                console.error('Model init failed:', err);
                const desc = describeError(err);
                if (desc.message.includes('GatherBlockQuantized')) {
                    desc.message = activeModelConfig.label + ' requires WebGPU (its 4-bit quantized graph uses GatherBlockQuantized, which is unsupported in CPU WASM). Switch Execution Backend to Auto (WebGPU), or choose "SmolLM2 360M Instruct (WASM OK)" for CPU-only WASM.';
                }
                self.postMessage({ type: 'error', data: desc });
            }
        } else if (type === 'restore') {
            history = normalizeHistory(data || [], 12);
        } else if (type === 'memory_update') {
            memoryBlock = data || '';
        } else if (type === 'system_prompt') {
            customSystemPrompt = data || '';
        } else if (type === 'reset') {
            history = [];
        } else if (type === 'stop') {
            if (activeStoppingCriteria) {
                activeStoppingCriteria.interrupt();
            }
        } else if (type === 'generate') {
            tpsStart = null;
            tokenCount = 0;
            const responseTokens = [];
            history = normalizeHistory([...history, { role: 'user', content: data.message }], 12);

            try {
                activeStoppingCriteria = new InterruptableStoppingCriteria();
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

                const maxNewTokens = Number(data.maxNewTokens) || 256;
                const temperature = Number(data.temperature ?? 0.7);
                const genOpts = {
                    max_new_tokens: maxNewTokens,
                    do_sample: temperature > 0.01,
                    repetition_penalty: 1.12,
                    stopping_criteria: [activeStoppingCriteria],
                    streamer
                };
                if (genOpts.do_sample) {
                    genOpts.temperature = temperature;
                    genOpts.top_p = 0.95;
                }

                const promptMessages = buildMessagesForModel(customSystemPrompt, !!data.isDefaultSystemPrompt);
                const out = await generator(promptMessages, genOpts);
                const interrupted = !!activeStoppingCriteria.interrupted;
                activeStoppingCriteria = null;

                const fallbackText = out?.[0]?.generated_text?.at?.(-1)?.content || '';
                const response = (responseTokens.length ? responseTokens.join('') : fallbackText).trim();
                if (interrupted && response.length < 40) {
                    history.pop();
                } else if (response) {
                    history = normalizeHistory([...history, { role: 'assistant', content: response }], 12);
                } else {
                    history.pop();
                }
                self.postMessage({ type: 'complete', data: { response, interrupted } });
            } catch (err) {
                activeStoppingCriteria = null;
                if (responseTokens.length) {
                    const partial = responseTokens.join('').trim();
                    if (partial) {
                        history = normalizeHistory([...history, { role: 'assistant', content: partial }], 12);
                    } else {
                        history.pop();
                    }
                } else {
                    history.pop();
                }
                console.error('Generation failed:', err);
                self.postMessage({ type: 'error', data: describeError(err) });
            }
        }
    });
    `;function Me(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Se(v){let d=v.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,(P,b,c)=>`<pre><code>${c}</code></pre>`);return d=d.replace(/`([^`\n]+)`/g,"<code>$1</code>"),d=d.replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>"),d}ye({setup(){const v="gemma_chat_history_v2",d="gemma_chat_selected_model",P="gemma_chat_settings_v1",b="gmem4_",p=I,B=W(()=>p.filter(e=>e.tier==="fast")),Z=W(()=>p.filter(e=>e.tier==="large")),X=localStorage.getItem(d),A=l(I.some(e=>e.id===X)?X:I[0].id),w=W(()=>I.find(e=>e.id===A.value)||I[0]);let M={};try{M=JSON.parse(localStorage.getItem(P)||"{}")}catch{}const T=l(Number(M.maxNewTokens)||256),q=l(typeof M.temperature=="number"?M.temperature:.7),S=l(M.systemPrompt||j),L=l(M.backendPref==="wasm"?"wasm":"auto"),k=l(!!M.useMemoryInPrompt),n=l([]),x=l(""),f=l(!1),_=l(!0),D=l(!1),G=l(0),R=l(""),u=l("Initializing model worker..."),C=l("Detecting WebGPU / WASM..."),E=l(null),O=l(!1),ee=l(!1),te=l(!1),oe=l(!1),F=l([]),se=["Explain WebGPU inference in 2 sentences.","Write a Python one-liner to reverse words in a string.","Name three differences between glaciers and rivers."],re=W(()=>n.value.some(e=>e.role==="user"));let m=null,g=null,U="";const y=e=>{m&&m.postMessage(JSON.parse(JSON.stringify(e)))},$=()=>{localStorage.setItem(P,JSON.stringify({maxNewTokens:T.value,temperature:q.value,systemPrompt:S.value,backendPref:L.value,useMemoryInPrompt:k.value})),y({type:"system_prompt",data:S.value}),y({type:"memory_update",data:k.value?z():""})},ae=()=>{T.value=256,q.value=.7,S.value=j,k.value=!1;const e=L.value!=="auto";L.value="auto",$(),e&&K()},ne=e=>{const s=e.content||(f.value&&e.id===n.value.at(-1)?.id?"...":"");let t=Me(s);const i=[],a=(h,N)=>{const Y=N.trim();return Y&&i.push(Y),""};t=t.replace(/&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g,a),t=t.replace(/&lt;\|thought\|&gt;([\s\S]*?)&lt;\|end_thought\|&gt;/g,a),t=t.replace(/&lt;\|channel&gt;thought\s*([\s\S]*?)&lt;channel\|&gt;/g,a),t=t.replace(/&lt;think&gt;([\s\S]*)$/g,a),t=t.replace(/&lt;\|channel&gt;thought\s*([\s\S]*)$/g,a);const o=Se(t.trim());return(i.length?`<details class="thought-box"><summary>Thought process</summary><div class="thought-content">${i.join(`

`)}</div></details>`:"")+(o||(i.length?"<em>Thinking...</em>":""))},H=()=>{const e=[];for(let s=0;s<localStorage.length;s++){const t=localStorage.key(s);if(t&&t.startsWith(b))try{e.push(JSON.parse(localStorage.getItem(t)))}catch{}}F.value=e.sort((s,t)=>s.ts-t.ts)},le=(e,s)=>{const t=s.replace(/<think>[\s\S]*?<\/think>/g,"").trim();if(!t)return;const i=Date.now();localStorage.setItem(b+i,JSON.stringify({ts:i,q:e.slice(0,140),a:t.slice(0,220)}));const a=Object.keys(localStorage).filter(o=>o.startsWith(b)).sort();a.length>20&&a.slice(0,a.length-20).forEach(o=>localStorage.removeItem(o)),H()},z=(e=5)=>{const s=F.value.slice(-e);return s.length?s.map(t=>`[${new Date(t.ts).toLocaleString()}]
Q: ${t.q}
A: ${t.a}`).join(`

`):""},ie=()=>{Object.keys(localStorage).filter(e=>e.startsWith(b)).forEach(e=>localStorage.removeItem(e)),H(),y({type:"memory_update",data:""})},ce=()=>{const e=[`# Browser AI Chat — Conversation Memory
`];F.value.forEach(a=>{e.push(`## ${new Date(a.ts).toLocaleString()}
**Q:** ${a.q}

**A:** ${a.a}
`)});const s=new Blob([e.join(`
`)],{type:"text/markdown"}),t=URL.createObjectURL(s),i=document.createElement("a");i.href=t,i.download=`chat-memory-${new Date().toISOString().slice(0,10)}.md`,i.click(),URL.revokeObjectURL(t)},pe=()=>({id:0,role:"bot",isGreeting:!0,content:`Hello! Ready to run ${w.value.label} entirely in your browser.`}),ue=()=>{const e=localStorage.getItem(v);if(e)try{const s=JSON.parse(e);if(Array.isArray(s)&&s.length){n.value=s;return}}catch{}n.value=[pe()]},Q=async()=>{await ve(),E.value&&(E.value.scrollTop=E.value.scrollHeight)};be(n,()=>{localStorage.setItem(v,JSON.stringify(n.value)),Q()},{deep:!0});const de=()=>{localStorage.removeItem(v),n.value=[{id:Date.now(),role:"bot",isGreeting:!0,content:`Chat history cleared. ${w.value.label} is ready.`}],y({type:"reset"})},me=()=>{if(O.value){g?.stop();return}const e=window.SpeechRecognition||window.webkitSpeechRecognition;if(!e){u.value="Voice input not supported in this browser.";return}g=new e,g.continuous=!0,g.interimResults=!0,g.lang="en-US";let s=x.value;g.onstart=()=>{O.value=!0},g.onend=()=>{O.value=!1},g.onerror=()=>{O.value=!1},g.onresult=t=>{let i="",a="";for(let o=t.resultIndex;o<t.results.length;o++){const r=t.results[o][0].transcript;t.results[o].isFinal?a+=r:i+=r}a&&(s=(s+" "+a).trim()),x.value=(s+(i?" "+i:"")).trim()},g.start()},ge=()=>{!f.value||!m||(u.value="Stopping generation...",y({type:"stop"}))},V=()=>{const e=x.value.trim();!e||f.value||_.value||(U=e,n.value.push({id:Date.now(),role:"user",content:e}),n.value.push({id:Date.now()+1,role:"bot",content:""}),x.value="",f.value=!0,u.value="Generating...",y({type:"generate",data:{message:e,maxNewTokens:T.value,temperature:q.value,isDefaultSystemPrompt:S.value===j}}))},fe=e=>{x.value=e,V()},J=e=>{m&&(m.terminate(),m=null),_.value=!0,f.value=!1,D.value=!1,G.value=0,R.value=`Preparing ${w.value.label}...`;const s=new Blob([we],{type:"application/javascript"});m=new Worker(URL.createObjectURL(s),{type:"module"}),m.onerror=i=>{D.value=!0,f.value=!1,u.value="Worker error: "+(i?.message||"Failed to start worker"),C.value="Worker failed"},m.onmessage=i=>{const{type:a,data:o}=i.data;if(a==="progress"){G.value=o.percent;const r=(o.loadedBytes/(1024*1024)).toFixed(1),h=o.totalBytes>0?(o.totalBytes/(1024*1024)).toFixed(1):"?";u.value=`Downloading ${w.value.label}... (${o.percent}%)`,R.value=`${r} / ${h} MB (${o.file})`}else if(a==="ready"){_.value=!1,D.value=!1,G.value=100,R.value="",u.value="Ready";const r=o.device==="webgpu"?`WebGPU (${o.dtype||"q4"})`:`WASM (${o.dtype||"q4"})`;C.value=`${w.value.label} · ${r}`,e?.length&&y({type:"restore",data:e})}else if(a==="token"){const r=n.value[n.value.length-1];r&&r.role==="bot"&&!r.isGreeting&&(r.content+=o.token),o.tps&&(u.value=`Generating... ${o.tps} tok/s`)}else if(a==="complete"){f.value=!1;const r=n.value[n.value.length-1];r&&r.role==="bot"&&!r.isGreeting&&!r.content.trim()&&o?.response&&(r.content=o.response),r&&r.role==="bot"&&!r.isGreeting&&!r.content.trim()&&n.value.pop(),u.value=o?.interrupted?"Stopped (Ready)":"Ready",document.getElementById("user-input")?.focus();const h=n.value.filter(N=>N.role==="bot"&&!N.isGreeting&&N.content.trim()).at(-1);!o?.interrupted&&U&&h?.content&&(le(U,h.content),y({type:"memory_update",data:k.value?z():""}))}else if(a==="status")u.value=o.message;else if(a==="error"){const r=o&&o.message||String(o),h=n.value[n.value.length-1];h?.role==="bot"&&!h.isGreeting&&!h.content.trim()&&n.value.pop(),f.value=!1,D.value=_.value,r.includes("OrtRun")?(u.value="GPU session ended (memory limit). Switch to a smaller model or reload.",C.value="GPU Memory Error"):(u.value=`Error: ${r}`,C.value=r)}};const t=location.search.includes("local=1");y({type:"init",data:{modelConfig:w.value,backendPref:L.value,systemPrompt:S.value,localModelPath:t?location.origin+"/gemma-chat-app/models/":null,memoryBlock:k.value?z():""}})},K=()=>{localStorage.setItem(d,A.value),$();const e=n.value.filter(s=>!s.isGreeting&&s.content.trim());u.value=`Switching to ${w.value.label}...`,C.value="Restarting worker...",J(e)};return he(()=>{window.addEventListener("beforeunload",()=>{m&&(m.terminate(),m=null)}),H(),ue(),Q();const e=n.value.filter(s=>!s.isGreeting&&s.content.trim());J(e)}),{fastModels:B,largerModels:Z,selectedModelId:A,activeModelMeta:w,messages:n,inputText:x,isGenerating:f,isLoading:_,loadError:D,loadingProgress:G,progressDetail:R,statusText:u,deviceInfo:C,chatContainer:E,isRecording:O,showMemory:ee,showSettings:te,showRefs:oe,memories:F,starterPrompts:se,hasUserTurns:re,maxNewTokens:T,temperature:q,systemPrompt:S,backendPref:L,useMemoryInPrompt:k,formatBotMessage:ne,sendMessage:V,stopGeneration:ge,useStarterPrompt:fe,clearMessages:de,exportMemories:ce,clearMemories:ie,toggleVoice:me,switchModel:K,saveSettings:$,resetSettings:ae}}}).mount("#app");
