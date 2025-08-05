import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import { config } from '../main/config.node'

const execAsync = promisify(exec)

// Constants
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const OLLAMA_API = {
  tags: `${OLLAMA_BASE_URL}/api/tags`,
  pull: `${OLLAMA_BASE_URL}/api/pull`,
  chat: `${OLLAMA_BASE_URL}/api/chat`,
  generate: `${OLLAMA_BASE_URL}/api/generate`
}

/**
 * Checks if the Ollama server is currently running by attempting to fetch its tags.
 * @returns {Promise<boolean>} A promise that resolves to true if the server is running, false otherwise.
 */
export const checkOllamaStatus = async () => {
  try {
    const response = await fetch(OLLAMA_API.tags)
    return response.ok
  } catch (error) {
    console.error('Error in checkOllamaStatus:', error)
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
export const startOllama = async () => {
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
export const ensureModel = async (modelName) => {
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

    const modelName = config.llm.model
    if (!modelName) {
      throw new Error('config.llm.model not set/found. Please set it in your .env file.')
    }

    console.log(`Checking model availability for: ${modelName}...`)
    await ensureModel(modelName)

    console.log('Ollama initialization complete!')
    return true
  } catch (error) {
    console.error('Ollama initialization failed:', error)
    throw error
  }
}

/**
 * Generates a response from Ollama using the specified prompt and model via the REST API.
 * @param {string} prompt - The system message for the LLM.
 * @param {string} model - The name of the Ollama model to use.
 * @param {boolean} stream - If false, the response will be returned as a single object.
 * @param {number} temperature - The temperature setting for the LLM.
 * @param {object | null} format - Optional JSON schema for structured output.
 * @returns {Promise<string>} A promise that resolves to the generated text response.
 */
export const generateOllama = async (prompt, model, stream, temperature, format) => {
  try {
    const requestBody = {
      prompt: prompt,
      model: model,
      stream: stream,
      options: {
        temperature: temperature
      }
    }

    // Add format and response_format (schema) if schema is provided
    if (format) {
      requestBody.format = format
    }

    console.log('Calling Ollama /api/generate with payload:', requestBody)

    const response = await fetch(OLLAMA_API.generate, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // If not streaming, parse the single JSON response
    console.log('RESPONSE:', response)
    if (!stream) {
      const data = await response.json()
      // The generated text is typically in the 'response' field for non-streaming
      return data.response
    } else {
      // Handle streaming responses (if you implement this later)
      // For now, we'll throw an error if stream is true as this function
      // is designed for non-streaming. You'd typically use a different
      // approach (e.g., ReadableStream) for streaming.
      throw new Error('Streaming not fully implemented for generateOllama via direct API call.')
    }
  } catch (error) {
    console.error('Error in generateOllama (direct API call):', error.message)
    throw new Error('Failed to generate response from Ollama API: ' + error.message)
  }
}
