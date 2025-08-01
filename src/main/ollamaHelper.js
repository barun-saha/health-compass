import { config } from './config.node'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Constants
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const OLLAMA_API = {
  tags: `${OLLAMA_BASE_URL}/api/tags`,
  pull: `${OLLAMA_BASE_URL}/api/pull`,
  chat: `${OLLAMA_BASE_URL}/api/chat`
}

console.log('Ollama model to use:', config.llm.model)

// Check if Ollama is running
export const checkOllamaStatus = async () => {
  console.log('Checking Ollama status...')
  try {
    const response = await fetch(OLLAMA_API.tags)
    return response.ok
  } catch (error) {
    console.error('Ollama is not running:', error)
    return false
  }
}

// Get Ollama executable path
const getOllamaPath = async () => {
  try {
    const command = process.platform === 'win32' ? 'where ollama' : 'which ollama'
    const { stdout } = await execAsync(command)
    return stdout.trim()
  } catch {
    switch (process.platform) {
      case 'win32':
        return '"C:\\Program Files\\Ollama\\ollama.exe"'
      case 'darwin':
        return '/usr/local/bin/ollama'
      default:
        return '/usr/bin/ollama'
    }
  }
}

// Start Ollama process
const startOllama = async () => {
  try {
    const ollamaPath = await getOllamaPath()
    console.log('Using Ollama path:', ollamaPath)

    // Use spawn to start the process in the background
    spawn(ollamaPath, ['serve'], {
      shell: true,
      detached: true,
      stdio: 'ignore'
    }).unref()

    // Wait for a few seconds to let Ollama start up
    console.log('Waiting for Ollama to start...')
    await new Promise((resolve) => setTimeout(resolve, 5000))

    if (await checkOllamaStatus()) {
      return true
    } else {
      throw new Error('Ollama failed to start within the timeout period.')
    }
  } catch (error) {
    throw new Error('Failed to start Ollama: ' + error.message)
  }
}

// Check if model exists and pull if needed
export const ensureModel = async (modelName) => {
  try {
    const response = await fetch(OLLAMA_API.tags)
    const data = await response.json()
    const modelExists = data.models?.some((model) => model.name === modelName)

    if (!modelExists) {
      console.log(`Model ${modelName} not found, pulling...`)
      const pullResponse = await fetch(OLLAMA_API.pull, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      })

      if (!pullResponse.ok) {
        throw new Error(`Failed to pull model ${modelName}`)
      }
      console.log(`Model ${modelName} pulled successfully.`)
    } else {
      console.log(`Model ${modelName} already exists.`)
    }
    return true
  } catch (error) {
    console.error('Model check/pull error:', error)
    throw error
  }
}

// Initialize Ollama
export const initializeOllama = async () => {
  try {
    const isRunning = await checkOllamaStatus()

    if (!isRunning) {
      console.log('Starting Ollama...')
      await startOllama()
    } else {
      console.log('Ollama is already running.')
    }

    console.log('Checking model availability...')
    await ensureModel(config.llm.model)

    return true
  } catch (error) {
    console.error('Ollama initialization error:', error)
    throw error
  }
}
