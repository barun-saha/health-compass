let prompts = null

export const loadPrompts = async () => {
  if (!prompts) {
    prompts = await window.electronAPI.loadPrompts()
    console.log('Prompts loaded from main process.')
  }
}

export const getPrompt = (promptName) => {
  if (!prompts) {
    // This case should ideally not be hit if loadPrompts is called on app startup.
    throw new Error('Prompts have not been loaded yet. Call loadPrompts() first.')
  }
  if (!prompts[promptName]) {
    throw new Error(`Prompt "${promptName}" not found.`)
  }
  return prompts[promptName]
}
