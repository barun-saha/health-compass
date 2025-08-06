export const config = {
  llm: {
    model: 'gemma3n:e2b',
    timeout: parseInt(import.meta.env.VITE_REQUEST_TIMEOUT) || 30000
  },
  input: {
    maxLength: parseInt(import.meta.env.VITE_MAX_INPUT_LENGTH) || 4000,
    maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 2 * 1024 * 1024
  },
  allowedFileTypes: ['application/pdf'],
  pdf: {
    maxFileSize: 2 * 1024 * 1024,
    allowedTypes: ['application/pdf'],
    validation: {
      minPages: 1,
      maxPages: 50,
      maxTextLength: 500000,
      signatures: ['%PDF-']
    }
  }
}
