import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

import { config } from './../renderer/src/config.browser'

const execAsync = promisify(exec)

// Constants
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const OLLAMA_API = {
  tags: `${OLLAMA_BASE_URL}/api/tags`,
  pull: `${OLLAMA_BASE_URL}/api/pull`,
  chat: `${OLLAMA_BASE_URL}/api/chat`
}

/**
 * Checks if the Ollama server is currently running by attempting to fetch its tags.
 * @returns {Promise<boolean>} A promise that resolves to true if the server is running, false otherwise.
 */
const checkOllamaStatus = async () => {
  try {
    const response = await fetch(OLLAMA_API.tags)
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Gets the path to the Ollama executable. It first tries to find it in the system's PATH,
 * and if that fails, it falls back to known default installation directories.
 * @returns {Promise<string>} A promise that resolves to the full path of the Ollama executable.
 */
const getOllamaPath = async () => {
  try {
    const command = process.platform === 'win32' ? 'where ollama' : 'which ollama'
    const { stdout } = await execAsync(command)
    return stdout.trim()
  } catch {
    // Fallback to default install paths if command fails
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

/**
 * Starts the Ollama server process in a detached state so it runs in the background.
 * The command used is OS-specific to ensure a terminal window does not appear.
 * @returns {Promise<void>} A promise that resolves when the server has started.
 */
const startOllama = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const ollamaPath = await getOllamaPath()
      let startCommand

      if (process.platform === 'win32') {
        // Use `start /B` to run the command in the background without a new window.
        // The `/MIN` flag can be added to start it minimized.
        startCommand = `start /B ${ollamaPath} serve`
      } else {
        // Use `nohup` to prevent the process from being killed when the terminal closes,
        // and `&` to run it in the background.
        startCommand = `nohup ${ollamaPath} serve > /dev/null 2>&1 &`
      }

      console.log('Attempting to start Ollama with command:', startCommand)
      exec(startCommand, (error) => {
        if (error) {
          console.error('Failed to start Ollama:', error)
          return reject(error)
        }
      })

      // Polling to wait for Ollama to be ready
      const checkInterval = setInterval(async () => {
        if (await checkOllamaStatus()) {
          console.log('Ollama is now running and ready.')
          clearInterval(checkInterval)
          resolve()
        } else {
          console.log('Waiting for Ollama to start...')
        }
      }, 1000)

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Timeout waiting for Ollama to start'))
      }, 30000)
    } catch (error) {
      console.error('Failed to start Ollama:', error)
      reject(error)
    }
  })
}

/**
 * Checks if the configured Ollama model exists and pulls it if necessary.
 * @param {string} modelName - The name of the model to check/pull.
 * @returns {Promise<boolean>} A promise that resolves to true if the model is available.
 */
const ensureModel = async (modelName) => {
  try {
    const tagsResponse = await fetch(OLLAMA_API.tags)
    const tagsData = await tagsResponse.json()
    const modelExists = tagsData.models?.some((model) => model.name === modelName)

    if (!modelExists) {
      console.log(`Model '${modelName}' not found. Pulling...`)
      const pullResponse = await fetch(OLLAMA_API.pull, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true })
      })

      if (!pullResponse.ok) {
        throw new Error(`Failed to pull model ${modelName}: ${await pullResponse.text()}`)
      }
      console.log(`Model '${modelName}' pulled successfully.`)
    } else {
      console.log(`Model '${modelName}' already exists.`)
    }
    return true
  } catch (error) {
    console.error('Model check/pull error:', error)
    throw error
  }
}

/**
 * The main initialization function for Ollama. It first checks the server status, starts it if
 * necessary, and then ensures the required model is available.
 * @returns {Promise<boolean>} A promise that resolves to true if initialization is successful.
 */
export const initializeOllama = async () => {
  try {
    const isRunning = await checkOllamaStatus()
    if (!isRunning) {
      await startOllama()
    } else {
      console.log('Ollama is already running.')
    }

    console.log('Checking model availability...')
    await ensureModel(config.llm.model)

    console.log('Ollama initialization complete!')
    return true
  } catch (error) {
    console.error('Ollama initialization failed:', error)
    throw error
  }
}
