export const config = {
  llm: {
    model: 'gemma3n:e2b',
    timeout: parseInt(process.env.VITE_REQUEST_TIMEOUT) || 30000
  }
}
