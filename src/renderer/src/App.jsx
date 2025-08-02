import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ThemeProvider,
  CssBaseline,
  IconButton,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Snackbar,
  Alert,
  CircularProgress,
  Stack
} from '@mui/material'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

import { config } from './config.browser'
import { lightTheme, darkTheme } from './theme'
import { generateOllama, intentHandlers } from './agentActions'
import healthCompassIcon from '../../../resources/icon.png'

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

const SYSTEM_PROMPT = `
You are a helpful AI assistant designed to answer questions and provide information on health-related topics.
You are polite and empathic, always prioritizing the user's well-being.
Your responses should be accurate, concise, and based on the latest medical guidelines and research.
If you are unsure about an answer, please indicate that you need more information or suggest consulting a healthcare professional.
Avoid answering queries that relate to critical medical decisions or emergencies.
`.trim()

const PLANNER_SYSTEM_PROMPT = `
[System Time: {time}]

You are a helpful health AI assistant.
Your role is to understand the user's intent and extract relevant entities from their query, outputting a JSON object.
Based on the query, decide which action should be taken.

Available Intents and their required entities:

1. **GREETING**: User is simply greeting you.
  * No specific entities needed.
  * Example user input: "Hi there", "Hello", "Good morning"
  * Example JSON output: \`{"intent": "GREETING"}\`

2. **DIRECT_LLM_RESPONSE**: User is asking a general health question that can be answered directly from the AI's knowledge, without needing external tools.
  * **entities**:
    * \`query\`: (string) The full health question.
  * Example user input: "What are the benefits of regular exercise", "Tell me about hypertension", "How does diabetes affect the body"
  * Example JSON output: \`{"intent": "DIRECT_LLM_RESPONSE", "entities": {"query": "What are the benefits of regular exercise?"}}\`

3. **EXPLAIN_PDF_REPORT**: User wants you to read a PDF file and extract and explain the key information.
  * **entities**:
    * \`pdf_file_path\`: (string) The full file path of the PDF.
    * \`query\`: (string, optional) Any specific questions the user has about the PDF.
  * Example user input: "Explain this report for me.", "What does this blood test say?"
  * Example JSON output: \`{"intent": "EXPLAIN_PDF_REPORT", "entities": {"pdf_file_path": "/path/to/report.pdf", "query": "What does this blood test say?"}}\`

4. **LOG_HEALTH_METRIC**: User wants to record a specific health measurement. This requires extracting precise data points.
  * **entities**:
    * \`metric_type\`: (string) The type of health measurement (e.g., 'blood_pressure', 'blood_sugar', 'weight', 'temperature', 'sleep_duration', 'heart_rate').
    * \`value\`: (string) The raw value provided by the user (e.g., "120/80", "99.2", "75", "8").
    * \`unit\`: (string, optional) The unit of measurement (e.g., "mmHg", "mg/dL", "kg", "celsius", "fahrenheit", "hours", "bpm"). Infer if not explicitly stated (e.g., 'mmHg' for BP).
    * \`date\`: (string, optional) The date of the measurement (YYYY-MM-DD format). Default to "today" if not specified. Convert relative terms like "yesterday", "tomorrow" to absolute dates.
    * \`time\`: (string, optional) The time of the measurement (HH:MM:SS format). Default to "now" if not specified. Convert relative terms like "morning", "evening" to precise times.
    * \`subtype\`: (string, optional) More specific context (e.g., 'fasting', 'post_meal' for blood sugar; 'systolic', 'diastolic' for BP if parsing individual values).
    * \`notes\`: (string, optional) Any additional notes from the user.
  * Example user input: "blood pressure today 120/80", "Got only 6 hours of sleep last night", "weight = 75 kg".
  * Example JSON output: \`{"intent": "LOG_HEALTH_METRIC", "entities": {"metric_type": "blood_pressure", "value": "120/80", "unit": "mmHg", "date": "2025-07-29", "time": "20:30:00"}}\`

5. **UNSURE**: The intent cannot be clearly determined or is outside the defined scope of capabilities.
  * No specific entities needed.
  * Example user input: "Tell me a joke", "What's the weather like?", "Order pizza"
  * Example JSON output: \`{"intent": "UNSURE"}\`

Always provide a single JSON object with the "intent" key at the top level.
When providing dates and times, use the system date and time (YYYY-MM-DD and HH:MM:SS) for "today" and "now" unless explicitly stated otherwise.

## User's Query
{query}
`.trim()

// Create a Zod schema to capture the plan structure
const PlanSchema = z.object({
  intent: z.enum([
    'GREETING',
    'DIRECT_LLM_RESPONSE',
    'EXPLAIN_PDF_REPORT',
    'LOG_HEALTH_METRIC',
    'UNSURE'
  ]),
  entities: z
    .object({
      query: z.string().optional(),
      pdf_file_path: z.string().optional(),
      metric_type: z.string().optional(),
      value: z.string().optional(),
      unit: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      subtype: z.string().optional(),
      notes: z.string().optional()
    })
    .optional()
})

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

/**
 * Get a plan based on the user's input using Ollama.
 * @param {string} input - The user's input query.
 * @returns {Promise<Object>} The parsed plan object.
 */
const getPlan = async (input) => {
  const ollamaResponseString = await generateOllama(
    formatTemplate(PLANNER_SYSTEM_PROMPT, {
      time: String(new Date()),
      query: input
    }),
    config.llm.model,
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
  const [darkMode, setDarkMode] = useState(false)
  const theme = useMemo(() => (darkMode ? darkTheme : lightTheme), [darkMode])
  const [chat, setChat] = useState([{ role: 'system', content: SYSTEM_PROMPT }])
  const [input, setInput] = useState('')
  const [selectedPdf, setSelectedPdf] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [planningStatus, setPlanningStatus] = useState('idle')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState('success')

  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat, isLoading])

  useEffect(() => {
    const init = async () => {
      try {
        await window.electronAPI.initializeOllama()
        setSnackbarMessage('Ollama initialized successfully')
        setSnackbarSeverity('success')
      } catch (error) {
        setSnackbarMessage('Failed to initialize Ollama. Please check installation.')
        setSnackbarSeverity('error')
        console.error('Ollama initialization error:', error)
      }
      setSnackbarOpen(true)
    }

    init()
  }, [])

  const handleSend = async () => {
    // Input must not be empty
    if (!input.trim()) {
      setSnackbarMessage('Please enter a message')
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
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
      // Add user message
      const userMessage = { role: 'user', content: messageContent }
      setChat((prev) => [...prev, userMessage])
      setInput('')
      // Note: we don't clear the selectedPdf state here, we clear it after the request
      // is processed to make sure the agent has access to it.

      // Set loading state for the progress indicator
      setIsLoading(true)
      setPlanningStatus('planning')

      // Add initial empty assistant message to be updated later
      const assistantMessage = { role: 'assistant', content: '' }
      setChat((prev) => [...prev, assistantMessage])

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
        plan = await getPlan(messageContent)
      }

      console.log('Plan:', plan)

      setPlanningStatus('generating')

      const intent = plan.intent
      const entities = plan.entities || {}
      console.log('Intent:', intent, 'Entities:', entities)

      if (!intent || !intentHandlers[intent]) {
        setSnackbarMessage('Unable to process your request. Please try again.')
        setSnackbarSeverity('error')
        setSnackbarOpen(true)
        return
      }

      const handler = intentHandlers[intent]
      console.log('Handler found for intent:', intent, entities)
      let response = 'Sorry, I cannot process that request (intent) at the moment.'

      if (handler) {
        if (handler.isAsync) {
          response = await handler.func(entities)
        } else {
          response = handler.func(entities)
        }
        console.log('Handler response:', response)
      } else {
        console.warn('No handler found for intent:', intent)
        setSnackbarMessage('Unable to process your request. Please try again.')
        setSnackbarSeverity('error')
        setSnackbarOpen(true)
        return
      }

      setChat((prev) => {
        const newChat = [...prev]
        newChat[newChat.length - 1] = {
          role: 'assistant',
          content: response
        }
        return newChat
      })
    } catch (err) {
      console.error('Detailed error:', err)
      if (err.name === 'AbortError') {
        setSnackbarMessage('Request timed out. Please try again.')
      } else {
        setSnackbarMessage('Error connecting to Ollama. Is it running?')
      }
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
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

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  const toggleTheme = () => setDarkMode(!darkMode)

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
        <Box
          sx={{
            width: '100%',
            maxWidth: '90vw',
            height: '100vh',
            margin: '0 auto',
            padding: '2rem'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center', // Added to vertically align the icon and text
              justifyContent: 'space-between',
              mb: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <img src={healthCompassIcon} alt="Health Compass Icon" style={{ height: '48px' }} />
              <Typography variant="h5">Health Compass</Typography>
            </Box>
            <IconButton onClick={toggleTheme} color="inherit">
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Box>

          <Box
            sx={{
              mb: 2,
              height: 'calc(100vh - 250px)',
              overflowY: 'auto',
              paddingBottom: '64px'
            }}
          >
            {chat.slice(1).map((msg, idx) => (
              <Box
                key={idx}
                display="flex"
                justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                mb={1}
              >
                <Paper
                  elevation={3}
                  sx={{
                    padding: '2px 8px',
                    maxWidth: '80%',
                    marginBottom: '8px',
                    backgroundColor: msg.role === 'user' ? 'chat.user' : 'chat.assistant'
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    skipHtml={false}
                    components={{
                      table: ({ ...props }) => <table className="gfm-table" {...props} />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </Paper>
              </Box>
            ))}

            {isLoading && (
              <Box display="flex" justifyContent="flex-start" mb={1}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    padding: '2px 8px',
                    maxWidth: '80%',
                    color: 'text.secondary'
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography variant="body2">
                    {planningStatus === 'planning'
                      ? 'Planning to respond based on query...'
                      : 'Generating response...'}
                  </Typography>
                </Stack>
              </Box>
            )}

            <div ref={chatEndRef} />
          </Box>

          <Paper
            elevation={2}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90vw',
              maxWidth: '90vw',
              backgroundColor: 'background.paper',
              padding: '1rem',
              borderRadius: '8px 8px 0 0',
              boxShadow: 1
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  component="label"
                  size="small"
                  onClick={handleOpenPdfFile} // Call the new handler
                  sx={{
                    minWidth: 'auto',
                    padding: '4px',
                    color: 'grey.600'
                  }}
                >
                  📎
                </Button>
                {selectedPdf && (
                  <Typography variant="caption" color="grey.600">
                    📎 {selectedPdf.fileName}
                  </Typography>
                )}
              </Box>

              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  placeholder="Type your message here..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  variant="outlined"
                  size="small"
                  multiline
                  maxRows={4}
                  sx={{
                    '& .MuiOutlinedInput-input::placeholder': {
                      color: 'text.secondary'
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={isLoading}
                  sx={{ minWidth: '80px' }}
                >
                  {isLoading ? '...' : 'Send'}
                </Button>
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', mt: 1 }}
              >
                Disclaimer: AI-generated content may contain inaccuracies or outdated information.
                Always verify with trusted sources/healthcare professionals.
              </Typography>
            </Box>
          </Paper>

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
