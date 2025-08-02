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
const handleGreeting = (entities) => {
  return 'Hello! How can I assist you today?'
}

const handleDirectResponse = async (entities) => {
  const query = entities.query || 'Hi, how can I help you?'
  const llmResponse = await generateOllama(query, config.llm.model, false, 0, null)
  return llmResponse
}

const handleExplainPdfReport = async (entities) => {
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

const handleLogHealthMetric = (entities) => {
  const { metric_type, value, unit, date, time, subtype, notes } = entities

  let response = 'Thank you for providing the information. '
  if (metric_type && value) {
    response += `I have logged your ${metric_type} with a value of ${value}.`
  } else {
    response +=
      'I am unable to log the metric with the provided information. Can you please be more specific?'
  }
  return response
}

const handleQuery = async (entities) => {
  const { metric_type, aggregate, date_start, date_end } = entities || {}
  console.log('Received query intent:', {
    metric_type,
    aggregate,
    date_start,
    date_end
  })

  // table schema for metrics:
  // CREATE TABLE metrics (
  //       metric_type TEXT NOT NULL,
  //       value TEXT NOT NULL,
  //       unit TEXT,
  //       date TEXT,
  //       time TEXT,
  //       subtype TEXT,
  //     )
  
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
      response = `The ${aggregate} for "${metric_type}" is:\n`
      queryResult.forEach((row) => {
        // Round aggregate values to 2 decimal places if they are numbers
        const value = typeof row.value === 'number' ? row.value.toFixed(2) : row.value
        response += `- ${value} ${row.unit || ''}\n`
      })
    } else {
      response = `Here are your records for "${metric_type}":\n`
      queryResult.forEach((row) => {
        response += `- ${row.date} at ${row.time || 'N/A'}: ${row.value} ${row.unit || ''}\n`
      })
    }

    return response
  } catch (error) {
    console.error('Error querying metrics:', error)
    return 'An error occurred while querying the metrics. Please try again later.'
  }

  // return 'Not yet implemented.'
}

const handleUnsure = () => {
  return "I'm not sure how to respond to that. Please ask a health-related question."
}

export const intentHandlers = {
  GREETING: { func: handleGreeting, isAsync: false },
  DIRECT_LLM_RESPONSE: { func: handleDirectResponse, isAsync: true },
  EXPLAIN_PDF_REPORT: { func: handleExplainPdfReport, isAsync: true },
  LOG_HEALTH_METRIC: { func: handleLogHealthMetric, isAsync: false },
  QUERY_METRICS: { func: handleQuery, isAsync: true },
  UNSURE: { func: handleUnsure, isAsync: false }
}
