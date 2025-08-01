export const config = {
  llm: {
    model: process.env.VITE_LLM_MODEL || 'gemma3:1b',
    timeout: parseInt(process.env.VITE_REQUEST_TIMEOUT) || 30000
  }
}
