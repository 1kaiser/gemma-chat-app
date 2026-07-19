#!/usr/bin/env node
// Downloads Gemma ONNX model files into public/models/ for local serving.
// Run once before `npm run dev` to avoid downloading from HuggingFace every session.
//
// Usage:
//   node download-models.js          # downloads Gemma 3 1B (q4f16 + q4, ~1.6 GB)
//   node download-models.js gemma4   # downloads Gemma 4 E2B (q4f16, ~3+ GB)

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const target = process.argv[2] || 'gemma3';

const MODELS = {
  gemma3: {
    repo: 'onnx-community/gemma-3-1b-it-ONNX',
    files: [
      'onnx/model_q4f16.onnx', 'onnx/model_q4f16.onnx_data',
      'onnx/model_q4.onnx',    'onnx/model_q4.onnx_data',
    ],
    size: '~1.6 GB',
  },
  gemma4: {
    repo: 'onnx-community/gemma-4-E2B-it-ONNX',
    files: [
      'onnx/decoder_model_merged_q4f16.onnx', 'onnx/decoder_model_merged_q4f16.onnx_data',
      'onnx/embed_tokens_q4f16.onnx',         'onnx/embed_tokens_q4f16.onnx_data',
    ],
    size: '~3+ GB',
  },
};

const spec = MODELS[target];
if (!spec) {
  console.error(`Unknown target "${target}". Use "gemma3" or "gemma4".`);
  process.exit(1);
}

const localDir = join('public', 'models', spec.repo);
mkdirSync(localDir, { recursive: true });

console.log(`Downloading ${spec.repo} (${spec.size}) → ${localDir}`);
console.log('Step 1/2: config + tokenizer files...');

// Config files first (fast)
execSync(
  `hf download ${spec.repo} --local-dir "${localDir}" --exclude "onnx/*"`,
  { stdio: 'inherit' }
);

console.log(`Step 2/2: ONNX model files (${spec.size})...`);

// ONNX weights (large)
const fileArgs = spec.files.map(f => `"${f}"`).join(' ');
execSync(
  `hf download ${spec.repo} --local-dir "${localDir}" ${fileArgs}`,
  { stdio: 'inherit' }
);

console.log(`Done! Model at: ${localDir}`);
console.log('The Vite dev server will now serve it at /gemma-chat-app/models/');
