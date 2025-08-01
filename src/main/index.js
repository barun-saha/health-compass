import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import sqlite3 from 'sqlite3'

import icon from '../../resources/icon.png?asset'
import { initializeOllama } from './ollamaHelper'

// Database setup
const dbPath = join(app.getPath('userData'), 'health_data.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message)
  } else {
    console.log('Connected to the SQLite database.')
  }
})

// Database functions
const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      value TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
      (err) => {
        if (err) {
          reject('Error creating metrics table: ' + err.message)
        } else {
          resolve('DB Status: Metrics table created successfully.')
        }
      }
    )
  })
}

const insertDummyData = async (data) => {
  return new Promise((resolve, reject) => {
    const { metric_type, value } = data
    db.run(
      `INSERT INTO metrics (metric_type, value) VALUES (?, ?)`,
      [metric_type, value],
      function (err) {
        if (err) {
          reject('Error inserting dummy data: ' + err.message)
        } else {
          resolve(`DB Status: Data inserted with ID: ${this.lastID}`)
        }
      }
    )
  })
}

const getAllMetrics = async () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM metrics`, [], (err, rows) => {
      if (err) {
        reject('Error fetching metrics: ' + err.message)
      } else {
        resolve(rows)
      }
    })
  })
}

function createWindow() {
  // Create the browser window
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

  // Set a comprehensive Content Security Policy
  const csp = `
    default-src 'self' 'unsafe-inline'; 
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data:;
    connect-src 'self' http://127.0.0.1:11434;
  `
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handler for the database
  ipcMain.handle('init-database', initDatabase)
  ipcMain.handle('insert-dummy-data', (_, data) => insertDummyData(data))
  ipcMain.handle('get-all-metrics', getAllMetrics)

  // IPC handler for Ollama initialization
  ipcMain.handle('initialize-ollama', initializeOllama)

  // IPC handler for PDF reading
  // ipcMain.handle('read-pdf-file', (_, filePath) => readPdfFile(filePath))

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
