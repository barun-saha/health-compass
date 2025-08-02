import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Extracts text from a PDF file using the 'pdftotext' command-line tool.
 *
 * This function is designed to be called from the main process. It uses a child process
 * to run the 'pdftotext' command, which must be installed on the user's system.
 *
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
export const readPdfFile = (filePath) => {
  return new Promise((resolve, reject) => {
    // Check if the file exists before trying to read it.
    if (!existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`))
      return
    }

    // Spawn a child process to run the `pdftotext` command.
    // The '-layout' flag preserves the original physical layout of the text.
    const child = spawn('pdftotext', ['-layout', filePath, '-'])

    let textData = ''
    let errorData = ''

    // Collect the stdout data from the child process.
    child.stdout.on('data', (data) => {
      textData += data.toString()
    })

    // Collect the stderr data from the child process.
    child.stderr.on('data', (data) => {
      errorData += data.toString()
    })

    // Handle the child process closing.
    child.on('close', (code) => {
      if (code === 0) {
        // Success: resolve the promise with the collected text.
        resolve(textData)
      } else {
        // Error: reject the promise with the error message.
        console.error(`pdftotext process exited with code ${code}. Error: ${errorData}`)
        reject(new Error(`Failed to extract text from PDF. Ensure 'pdftotext' is installed.`))
      }
    })

    // Handle any errors that occur while spawning the process.
    child.on('error', (err) => {
      console.error('Failed to start pdftotext process:', err)
      reject(new Error(`Failed to start 'pdftotext' process. Is it installed?`))
    })
  })
}
