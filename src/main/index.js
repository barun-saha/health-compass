import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import sqlite3 from 'sqlite3'
import icon from '../../resources/icon.png?asset'

import { initializeOllama } from './ollamaHelper'
import { readPdfFile } from './pdfHelper'

// Database setup
const dbPath = join(app.getPath('userData'), 'health_data.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message)
  } else {
    console.log('Connected to the SQLite database:', dbPath)
  }
})

// Database functions
const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_type TEXT NOT NULL,
          value TEXT NOT NULL,
          unit TEXT,
          date TEXT,
          time TEXT,
          subtype TEXT,
          notes TEXT,
          timestamp DATETIME NOT NULL
        )`,
        (err) => {
          if (err) {
            reject('Error creating metrics table: ' + err.message)
          } else {
            resolve('DB Status: Metrics table exists/created successfully.')
          }
        }
      )
    })
  })
}

const insertDummyData = async (data) => {
  return new Promise((resolve, reject) => {
    const { metric_type, value, unit, date, time, subtype, notes } = data
    const timestamp = new Date().toISOString()

    db.run(
      `INSERT INTO metrics (metric_type, value, unit, date, time, subtype, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [metric_type, value, unit, date, time, subtype, notes, timestamp],
      function (err) {
        if (err) {
          reject('Error inserting data: ' + err.message)
        } else {
          console.log(`Data inserted with ID: ${this.lastID}`, data)
          resolve(`DB Status: Data inserted with ID: ${this.lastID}`)
        }
      }
    )
  })
}

/**
 * Asynchronously queries the metrics database with dynamic parameters.
 * @param {Object} entities An object containing query parameters.
 * @param {string} entities.metric_type The type of metric to query. Required.
 * @param {string} [entities.aggregate] An optional aggregation function ('min', 'max', 'avg', 'count').
 * @param {string} [entities.date_start] Optional start date for the query (YYYY-MM-DD).
 * @param {string} [entities.date_end] Optional end date for the query (YYYY-MM-DD).
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of result rows.
 */
const queryMetrics = async ({ metric_type, aggregate, date_start, date_end }) => {
  try {
    let query
    const params = [metric_type]

    // Build the base query string and parameters
    let baseQuery = `SELECT * FROM metrics WHERE metric_type = ?`
    if (date_start && date_end) {
      baseQuery += ` AND date BETWEEN ? AND ?`
      params.push(date_start, date_end)
    }

    // Handle aggregation or default to a simple select
    if (aggregate) {
      const allowedAggregates = ['min', 'max', 'avg', 'count']
      if (!allowedAggregates.includes(aggregate.toLowerCase())) {
        throw new Error(`Unsupported aggregate function: ${aggregate}`)
      }

      // Cast value to a number for numerical aggregates, except for 'count'
      const valueExpression = aggregate.toLowerCase() === 'count' ? 'value' : 'CAST(value AS REAL)'
      query = `SELECT ${aggregate}(${valueExpression}) AS value, unit FROM (${baseQuery}) GROUP BY unit`
    } else {
      // Non-aggregate query, just use the base query
      query = baseQuery
    }

    console.log('Executing query:', query, 'with params:', params)

    // Await the database call. The `await` keyword simplifies the asynchronous flow.
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject('Error querying metrics: ' + err.message)
        } else {
          resolve(rows)
        }
      })
    })

    console.log('Query result:', rows)
    return rows
  } catch (error) {
    console.error('Error in queryMetrics:', error.message)
    // Rethrow the error so the caller can handle it
    throw error
  }
}

const getAllMetrics = async () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM metrics`, [], (err, rows) => {
      if (err) {
        reject('Error fetching metrics: ' + err.message)
      } else {
        console.log('Fetched metrics:', rows)
        resolve(rows)
      }
    })
  })
}

/**
 * Creates the main browser window.
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Handles the file open dialog to select a PDF file.
 * @returns {Promise<string | undefined>} A promise that resolves with the selected file path, or undefined if canceled.
 */
async function handleOpenPdfFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })
  if (canceled) {
    return
  } else {
    return filePaths[0]
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database on startup
  try {
    const dbStatus = await initDatabase()
    console.log(dbStatus)
  } catch (err) {
    console.error(err)
  }

  // IPC handler for the database
  ipcMain.handle('insert-dummy-data', (_, data) => insertDummyData(data))
  ipcMain.handle('get-all-metrics', getAllMetrics)

  // IPC handler for Ollama initialization
  ipcMain.handle('initialize-ollama', initializeOllama)

  // IPC handler for PDF reading
  ipcMain.handle('read-pdf-file', (_, filePath) => readPdfFile(filePath))

  // IPC handler for opening a file dialog
  ipcMain.handle('dialog:openPdfFile', handleOpenPdfFile)

  // IPC for database query
  ipcMain.handle('query-metrics', (_, data) => queryMetrics(data))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
