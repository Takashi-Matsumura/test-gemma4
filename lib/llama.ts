import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const LLAMA_BASE_URL =
  process.env.LLAMA_BASE_URL || 'http://localhost:8080/v1';

export const llama = createOpenAICompatible({
  baseURL: LLAMA_BASE_URL,
  name: 'llama-cpp',
  headers: {},
});

export const gemma4 = llama.chatModel('gemma4');
