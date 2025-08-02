import ollama from 'ollama'

import { config } from './config.browser'

export const generateOllama = async (
  prompt,
  model = config.llm.model,
  stream = true,
  temperature = 0,
  format = null
) => {
  const response = await ollama.generate({
    model: model,
    prompt: prompt,
    stream: stream,
    temperature: temperature,
    format: format
  })

  // The generate() call returns an object, so we return the string part
  return response.response
}

// System prompt for explaining a PDF report
const EXPLAIN_REPORT_PROMPT = `
You are a helpful health assistant.
You can accurately interpret lab test results, e.g., blood test reports and others.
Your task is to explain medical reports to the user in simple, easy-to-understand language.
- Start with a general overview of the report's purpose, what tests.
- Correctly identify the test result values (and referene values, where available) and report them faithfully.
- Highlight any key findings or values that are outside the normal/reference range.
- Explain what these results/findings might mean, but **do not provide a diagnosis**.
- Be clear and factual, avoiding medical jargon. Do NOT make up any information.
- Always recommend that the user consult a healthcare professional for a proper interpretation.

Note: Sometimes text extracted from the PDF reports may be improperly formatted. misaligned, or contain errors.
E.g., a number "78" might appear as "7 8". Or report headers, measured values, and reference values might be misaligned.
Or sometimes a row of results might be split into two lines.
- In such cases, do your best to interpret the text correctly.
- If you are unable to interpret the text, inform the user that you cannot explain the report. NEVER misinterpret.

User's original query: {query}

---
Report Text:
{reportText}
---
`

// Define functions to handle each of the intents
const handleGreeting = (entities, history) => {
  return 'Hello! How can I assist you today?'
}

const handleDirectResponse = async (entities, history) => {
  // For this handler, the history IS the prompt, as it contains the full conversation
  // including the latest user query. The planner uses `entities.query` just to identify
  // the intent, but we use the full history for a contextual response.
  const llmResponse = await generateOllama(history, config.llm.model, false, 0, null)
  return llmResponse
}

const handleExplainPdfReport = async (entities, history) => {
  const { pdf_file_path: filePath, query } = entities
  console.log('Received intent to explain PDF report:', { filePath, query })

  // Check if the file path is valid
  if (!filePath) {
    console.warn('PDF intent received, but no file path was provided.')
    return 'I was asked to explain a PDF report, but no file path was provided. Please upload a PDF and specify your query.'
  }

  try {
    console.log('Extracting text from PDF:', filePath)
    const reportText = await window.electronAPI.readPdfFile(filePath)

    // Check if text was successfully extracted
    if (!reportText) {
      return 'I was unable to extract any text from the provided PDF file. Please ensure the file is not corrupted or password-protected.'
    }

    console.log('Extracted PDF text:', reportText)

    // Construct the new prompt for Ollama with the extracted text
    const prompt = EXPLAIN_REPORT_PROMPT.replace(
      '{query}',
      query || 'Explain this report.'
    ).replace('{reportText}', reportText)

    const ollamaResponse = await generateOllama(prompt, config.llm.model, false, 0, null)
    console.log('Ollama response length:', ollamaResponse.length)

    return (
      ollamaResponse || 'Sorry, but I was unable to explain the report. Please try again later.'
    )
  } catch (error) {
    console.error('Error in handleExplainPdfReport:', error)
    return 'An error occurred while processing the PDF. Please try again or check the console for details.'
  }
}

// A simple function to resolve relative date strings to YYYY-MM-DD format
const resolveRelativeDate = (dateString) => {
  const date = new Date()
  const lowerCaseString = dateString.toLowerCase()

  if (lowerCaseString === 'yesterday') {
    date.setDate(date.getDate() - 1)
  } else if (lowerCaseString === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }

  // Format the date to YYYY-MM-DD
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// A simple function to resolve relative time strings to HH:MM:SS format
const resolveRelativeTime = (timeString) => {
  const date = new Date()
  const lowerCaseString = timeString.toLowerCase()

  if (lowerCaseString.includes('night')) {
    date.setHours(21, 0, 0) // 9 PM
  } else if (lowerCaseString.includes('morning')) {
    date.setHours(9, 0, 0) // 9 AM
  } else if (lowerCaseString.includes('afternoon')) {
    date.setHours(14, 0, 0) // 2 PM
  } else if (lowerCaseString.includes('evening')) {
    date.setHours(18, 0, 0) // 6 PM
  }

  // Format the time to HH:MM:SS
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Logs a health metric to the database via an IPC call.
 * It handles composite values like blood pressure by splitting them into separate entries.
 * @param {Object} entities An object containing the metric data.
 * @returns {Promise<string>} A promise that resolves to a confirmation or error message.
 */
const handleLogHealthMetric = async (entities, history) => {
  const { metric_type, value, unit, date, time, subtype, notes } = entities

  try {
    if (!metric_type || !value) {
      throw new Error('Metric type and value are required.')
    }

    const resolvedDate = date ? resolveRelativeDate(date) : resolveRelativeDate('today')
    const resolvedTime = time ? resolveRelativeTime(time) : 'now'

    // Special handling for blood pressure, which comes in as "systolic/diastolic"
    if (metric_type === 'blood_pressure' && typeof value === 'string' && value.includes('/')) {
      const [systolic, diastolic] = value.split('/')
      if (!systolic || !diastolic || isNaN(systolic) || isNaN(diastolic)) {
        throw new Error(`Invalid blood pressure value: ${value}. Expected "systolic/diastolic".`)
      }

      const systolicData = {
        metric_type,
        value: parseFloat(systolic.trim()),
        unit: unit || 'mmHg',
        date: resolvedDate,
        time: resolvedTime,
        subtype: 'systolic',
        notes: notes || null
      }
      const diastolicData = {
        metric_type,
        value: parseFloat(diastolic.trim()),
        unit: unit || 'mmHg',
        date: resolvedDate,
        time: resolvedTime,
        subtype: 'diastolic',
        notes: notes || null
      }

      // Insert both metrics concurrently and combine their results
      const results = await Promise.all([
        window.electronAPI.insertMetric(systolicData),
        window.electronAPI.insertMetric(diastolicData)
      ])

      return results.join('\n')
    } else {
      // For all other metrics, ensure the value is numeric
      const numericValue = parseFloat(value)
      if (isNaN(numericValue)) {
        throw new Error(`Invalid numeric value provided: "${value}"`)
      }

      const metricData = {
        metric_type,
        value: numericValue,
        unit: unit || null,
        date: resolvedDate,
        time: resolvedTime,
        subtype: subtype || null,
        notes: notes || null
      }

      console.log('Sending metric data via IPC:', metricData)
      const result = await window.electronAPI.insertMetric(metricData)

      console.log(result)
      return result
    }
  } catch (error) {
    console.error('Error logging health metric:', error.message)
    return 'I am unable to log the metric with the provided information. Please be more specific or try again.'
  }
}

const handleQuery = async (entities, history) => {
  const { metric_type, aggregate, date_start, date_end } = entities || {}
  console.log('Received query intent:', {
    metric_type,
    aggregate,
    date_start,
    date_end
  })

  if (!metric_type) {
    return 'Please specify a metric type to query. For example, "heart_rate", "weight", etc.'
  }
  try {
    const queryResult = await window.electronAPI.queryMetrics({
      metric_type,
      aggregate,
      date_start,
      date_end
    })

    if (queryResult.length === 0) {
      return `No records found for the metric type "${metric_type}".`
    }

    // Format the response based on the query result
    let response
    if (aggregate) {
      response = `The ${aggregate} for "${metric_type}" is:\n\n`
      const headers = `| **Value** | **Unit** |`
      const separator = `|---|---|`
      const rows = queryResult
        .map((row) => {
          // Round aggregate values to 2 decimal places if they are numbers
          const value = typeof row.value === 'number' ? row.value.toFixed(2) : row.value
          return `| ${value} | ${row.unit || ''} |`
        })
        .join('\n')
      response += `${headers}\n${separator}\n${rows}`
    } else {
      response = `Here are your records for "${metric_type}":\n\n`
      const headers = `| **Date** | **Time** | **Subtype** | **Value** | **Unit** |`
      const separator = `|---|---|---|---|---|`
      const rows = queryResult
        .map(
          (row) =>
            `| ${row.date} | ${row.time || 'N/A'} | ${row.subtype || ''} | ${row.value} | ${row.unit || ''} |`
        )
        .join('\n')
      response += `${headers}\n${separator}\n${rows}`
    }

    return response
  } catch (error) {
    console.error('Error querying metrics:', error)
    return 'An error occurred while querying the metrics. Please try again later.'
  }

  // return 'Not yet implemented.'
}

const handleUnsure = (entities, history) => {
  return "I'm not sure how to respond to that. Please ask a health-related question."
}

export const intentHandlers = {
  GREETING: { func: handleGreeting, isAsync: false },
  DIRECT_LLM_RESPONSE: { func: handleDirectResponse, isAsync: true },
  EXPLAIN_PDF_REPORT: { func: handleExplainPdfReport, isAsync: true },
  LOG_HEALTH_METRIC: { func: handleLogHealthMetric, isAsync: true },
  QUERY_METRICS: { func: handleQuery, isAsync: true },
  UNSURE: { func: handleUnsure, isAsync: false }
}
