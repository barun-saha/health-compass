import { useState, useMemo, useEffect, useRef } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

import { config } from './config.browser'
import { lightTheme, darkTheme } from './theme'
import { generateOllama, intentHandlers } from './agentActions'
import { useNotification } from './hooks/useNotification'
import { loadPrompts, getPrompt } from './promptManager'
import Header from './components/Header'
import ConversationDisplay from './components/ConversationDisplay'
import ChatInput from './components/ChatInput'
import AppNotification from './components/AppNotification'
import SettingsDrawer from './components/SettingsDrawer'

const wavyBackgroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1422 800" opacity="0.3">
  <defs>
    <linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="oooscillate-grad">
      <stop stop-color="hsl(206, 75%, 49%)" stop-opacity="1" offset="0%"></stop>
      <stop stop-color="hsl(331, 90%, 56%)" stop-opacity="1" offset="100%"></stop>
    </linearGradient>
  </defs>
  <g stroke-width="1" stroke="url(#oooscillate-grad)" fill="none" stroke-linecap="round">
    <path d="M 0 448 Q 355.5 -100 711 400 Q 1066.5 900 1422 448" opacity="0.05"></path>
    <path d="M 0 420 Q 355.5 -100 711 400 Q 1066.5 900 1422 420" opacity="0.11"></path>
    <path d="M 0 392 Q 355.5 -100 711 400 Q 1066.5 900 1422 392" opacity="0.18"></path>
    <path d="M 0 364 Q 355.5 -100 711 400 Q 1066.5 900 1422 364" opacity="0.24"></path>
    <path d="M 0 336 Q 355.5 -100 711 400 Q 1066.5 900 1422 336" opacity="0.30"></path>
    <path d="M 0 308 Q 355.5 -100 711 400 Q 1066.5 900 1422 308" opacity="0.37"></path>
    <path d="M 0 280 Q 355.5 -100 711 400 Q 1066.5 900 1422 280" opacity="0.43"></path>
    <path d="M 0 252 Q 355.5 -100 711 400 Q 1066.5 900 1422 252" opacity="0.49"></path>
    <path d="M 0 224 Q 355.5 -100 711 400 Q 1066.5 900 1422 224" opacity="0.56"></path>
    <path d="M 0 196 Q 355.5 -100 711 400 Q 1066.5 900 1422 196" opacity="0.62"></path>
    <path d="M 0 168 Q 355.5 -100 711 400 Q 1066.5 900 1422 168" opacity="0.68"></path>
    <path d="M 0 140 Q 355.5 -100 711 400 Q 1066.5 900 1422 140" opacity="0.75"></path>
    <path d="M 0 112 Q 355.5 -100 711 400 Q 1066.5 900 1422 112" opacity="0.81"></path>
    <path d="M 0 84 Q 355.5 -100 711 400 Q 1066.5 900 1422 84" opacity="0.87"></path>
    <path d="M 0 56 Q 355.5 -100 711 400 Q 1066.5 900 1422 56" opacity="0.94"></path>
  </g>
</svg>
  `.trim()

const svgBase64 = btoa(wavyBackgroundSvg)

// Create a Zod schema to capture the plan structure
const PlanSchema = z.object({
  intent: z.enum([
    'GREETING',
    'DIRECT_LLM_RESPONSE',
    'EXPLAIN_PDF_REPORT',
    'LOG_HEALTH_METRIC',
    'QUERY_METRICS',
    'UNSURE'
  ]),
  entities: z
    .object({
      query: z.string().optional(),
      answer: z.string().optional(),
      pdf_file_path: z.string().optional(),
      metric_type: z.string().optional(),
      value: z.string().optional(),
      unit: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      subtype: z.string().optional(),
      notes: z.string().optional(),
      aggregate: z.enum(['min', 'max', 'avg', 'count']).optional(),
      date_start: z.string().optional(),
      date_end: z.string().optional()
    })
    .optional()
})

/**
 * Formats the chat history into a string for the LLM prompt.
 * @param {Array<Object>} chat - The chat history array.
 * @returns {string} The formatted chat history string.
 */
const formatChatHistory = (chat) => {
  // Exclude the system prompt.
  return chat
    .slice(1)
    .map((msg) => `<${msg.role}>${msg.content}</${msg.role}>`)
    .join('\n')
}

/**
 * Formats a template string by replacing placeholders with corresponding values.
 * @param {string} template - The template string containing placeholders in the format {key}.
 * @param {Object} values - An object containing key-value pairs to replace in the template.
 * @return {string} The formatted string with placeholders replaced by actual values.
 */
function formatTemplate(template, values) {
  return template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    return values[key.trim()] ?? match // Fall back to original if key missing
  })
}

function createMessageId() {
  // Use crypto.randomUUID() if available, otherwise fallback to a timestamp-based ID
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

/**
 * Get a plan based on the user's input using Ollama.
 * @param {string} input - The user's input query.
 * @param {string} history - The conversation history.
 * @param {string} model - The LLM model to use.
 * @returns {Promise<Object>} The parsed plan object.
 */
const getPlan = async (input, history, model) => {
  const plannerSystemPrompt = getPrompt('planner_system')
  const ollamaResponseString = await generateOllama(
    formatTemplate(plannerSystemPrompt, {
      time: String(new Date()),
      query: input,
      history: history
    }),
    model,
    false,
    0,
    zodToJsonSchema(PlanSchema)
  )

  console.log('Raw Ollama Response String:', ollamaResponseString)

  let plan
  try {
    if (!ollamaResponseString) {
      console.warn('LLM returned an empty string for plan. Setting intent to UNSURE.')
      plan = { intent: 'UNSURE' }
    } else {
      plan = PlanSchema.parse(JSON.parse(ollamaResponseString))
    }
  } catch (e) {
    console.error('Failed to parse LLM response:', e)
    console.warn('LLM returned a non-JSON response. Setting intent to UNSURE.')
    plan = { intent: 'UNSURE' }
  }

  return plan
}

// Component definition
function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const savedMode = window.localStorage.getItem('darkMode')
      return savedMode ? JSON.parse(savedMode) : false
    } catch (error) {
      console.error('Error reading darkMode from localStorage:', error)
      return false
    }
  })
  const theme = useMemo(() => (darkMode ? darkTheme : lightTheme), [darkMode])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedLlm, setSelectedLlm] = useState(() => {
    try {
      const savedLlm = window.localStorage.getItem('selectedLlm')
      return savedLlm ? JSON.parse(savedLlm) : 'gemma3n:e2b' // Default model
    } catch (error) {
      console.error('Error reading selectedLlm from localStorage:', error)
      return 'gemma3n:e2b'
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem('darkMode', JSON.stringify(darkMode))
    } catch (error) {
      console.error('Error writing darkMode to localStorage:', error)
    }
  }, [darkMode])

  useEffect(() => {
    try {
      window.localStorage.setItem('selectedLlm', JSON.stringify(selectedLlm))
    } catch (error) {
      console.error('Error writing selectedLlm to localStorage:', error)
    }
  }, [selectedLlm])

  const [chat, setChat] = useState([])
  const [input, setInput] = useState('')
  const [selectedPdf, setSelectedPdf] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [planningStatus, setPlanningStatus] = useState('idle')
  const { notification, showNotification, handleSnackbarClose } = useNotification()

  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat, isLoading])

  useEffect(() => {
    const messageCount = chat.length - 1 // Exclude system prompt
    if (messageCount === 14) {
      showNotification('You can ask 3 more queries.', 'info')
    } else if (messageCount >= 20) {
      showNotification('You have reached the maximum message limit for this session.', 'info')
    }
  }, [chat])

  useEffect(() => {
    const init = async () => {
      try {
        await loadPrompts()
        let systemPrompt
        try {
          systemPrompt = getPrompt('system')
        } catch (error) {
          console.warn('System prompt missing; using fallback. Error:', error?.message)
          systemPrompt = 'You are Health Compass, a helpful assistant.'
          systemPrompt += ' You can answer questions about health metrics, explain PDF reports,'
          systemPrompt += ' and log health data.'
        }
        setChat([{ id: createMessageId(), role: 'system', content: systemPrompt }])

        const modelName = await window.electronAPI.initializeOllama()
        showNotification(`Ollama initialized successfully! Using model: ${modelName}`, 'success')
      } catch (error) {
        showNotification(
          'Failed to initialize the app. Please check installation and restart.',
          'error'
        )
        console.error('Initialization error:', error)
      }
    }

    init()
  }, [])

  const handleSend = async () => {
    const messageCount = chat.length - 1
    if (messageCount >= 20) {
      showNotification('You have reached the maximum message limit for this session.', 'info')
      return
    }

    // Input must not be empty
    if (!input.trim()) {
      showNotification('Please enter a message', 'error')
      return
    }

    // Add abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.llm.timeout)

    // Build the message content based on whether a PDF is attached
    // This is for display purposes, the actual logic will use the 'selectedPdf' state
    const messageContent = selectedPdf
      ? `${input}\n\nPDF file attached: ${selectedPdf.fileName}`
      : input

    try {
      // The user message is created here to be included in the history for the planner
      const userMessage = { id: createMessageId(), role: 'user', content: messageContent }
      const chatHistoryString = formatChatHistory(chat)

      // Add user message to the chat
      setChat((prev) => [...prev, userMessage])
      setInput('')
      // Note: we don't clear the selectedPdf state here, we clear it after the request
      // is processed to make sure the agent has access to it.

      // Set loading state for the progress indicator
      setIsLoading(true)
      setPlanningStatus('planning')

      let plan

      // Short-circuit logic: If a PDF is selected, skip the LLM planner call
      if (selectedPdf) {
        console.log('PDF selected, short-circuiting to EXPLAIN_PDF_REPORT intent.')
        plan = {
          intent: 'EXPLAIN_PDF_REPORT',
          entities: {
            query: input.trim() || 'Explain this report.',
            pdf_file_path: selectedPdf.filePath
          }
        }
      } else {
        // No PDF, proceed with the normal planning step.
        plan = await getPlan(messageContent, chatHistoryString, selectedLlm)
      }

      console.log('Plan:', plan)

      setPlanningStatus('generating')

      const intent = plan.intent
      const entities = plan.entities || {}
      console.log('Intent:', intent, 'Entities:', entities)

      if (!intent || !intentHandlers[intent]) {
        showNotification('Unable to process your request. Please try again.', 'error')
        return
      }

      const handler = intentHandlers[intent]
      console.log('Handler found for intent:', intent, entities)
      let response = 'Sorry, I cannot process that request (intent) at the moment.'

      if (handler) {
        if (handler.isAsync) {
          response = await handler.func(entities, chatHistoryString)
        } else {
          response = handler.func(entities, chatHistoryString)
        }
        console.log('Handler response:', response)
      } else {
        console.warn('No handler found for intent:', intent)
        showNotification('Unable to process your request. Please try again.', 'error')
        return
      }

      setChat((prev) => {
        const newChat = [...prev]
        newChat.push({
          id: createMessageId(),
          role: 'assistant',
          content: response
        })
        return newChat
      })
    } catch (err) {
      console.error('Detailed error:', err)
      if (err.name === 'AbortError') {
        showNotification('Request timed out. Please try again.', 'error')
      } else {
        showNotification('Error connecting to Ollama. Is it running?', 'error')
      }
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
      setPlanningStatus('idle')
      setSelectedPdf(null)
    }
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  // Function to handle the file dialog using a pure JavaScript solution
  const handleOpenPdfFile = async () => {
    try {
      const filePath = await window.electronAPI.openPdfFile()
      if (filePath) {
        // Use a simple JavaScript method to get the filename from the path
        const fileName = filePath.split(/[\\/]/).pop()
        setSelectedPdf({ filePath, fileName })
        console.log('Selected PDF file path:', filePath, 'Filename:', fileName)
      }
    } catch (error) {
      console.error('Error opening file dialog:', error)
    }
  }

  const toggleTheme = () => setDarkMode(!darkMode)

  const toggleSettings = () => setIsSettingsOpen(!isSettingsOpen)

  const handleLlmChange = (event) => {
    setSelectedLlm(event.target.value)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          // backgroundColor: 'background.default',
          backgroundImage: `url('data:image/svg+xml;base64,${svgBase64}')`,
          padding: 0,
          width: '100vw'
        }}
      >
        <SettingsDrawer
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          selectedLlm={selectedLlm}
          handleLlmChange={handleLlmChange}
        />
        <Box
          sx={{
            width: '100%',
            maxWidth: '90vw',
            height: '100vh',
            margin: '0 auto',
            padding: '2rem'
          }}
        >
          <Header toggleSettings={toggleSettings} />

          <ConversationDisplay
            chat={chat}
            isLoading={isLoading}
            planningStatus={planningStatus}
            chatEndRef={chatEndRef}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            handleKeyPress={handleKeyPress}
            handleSend={handleSend}
            isLoading={isLoading}
            chat={chat}
            selectedPdf={selectedPdf}
            handleOpenPdfFile={handleOpenPdfFile}
          />

          <AppNotification notification={notification} handleSnackbarClose={handleSnackbarClose} />
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
