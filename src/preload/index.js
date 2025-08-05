import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Ollama
  initializeOllama: () => ipcRenderer.invoke('initialize-ollama'),
  generateOllama: (prompt, model, stream, temperature, format) =>
    ipcRenderer.invoke('generate-ollama', prompt, model, stream, temperature, format),

  // Database
  // insertDummyData: (data) => ipcRenderer.invoke('insert-dummy-data', data),
  // getAllMetrics: () => ipcRenderer.invoke('get-all-metrics'),
  queryMetrics: (data) => ipcRenderer.invoke('query-metrics', data),
  insertMetric: (data) => ipcRenderer.invoke('insert-metric', data),

  // File system
  openPdfFile: () => ipcRenderer.invoke('dialog:openPdfFile'),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath)
}

// Use `contextBridge` to expose provided APIs to the renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.electronAPI = api
}
