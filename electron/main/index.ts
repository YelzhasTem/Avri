import { join } from 'node:path'
import { config as loadEnvironment } from 'dotenv'
import { app, BrowserWindow, shell } from 'electron'
import { GeminiProvider } from '../../src/services/ai/GeminiProvider'
import { isAppNavigation, isSafeExternalUrl } from '../../src/services/links'
import { AIService } from './AIService'
import { registerIpcHandlers } from './ipc'
import { LocalMemoryRepository } from './memory/LocalMemoryRepository'
import { MemoryService } from './memory/MemoryService'
import { LocalChatRepository } from './storage/LocalChatRepository'
import { SettingsRepository } from './storage/SettingsRepository'

if (!app.isPackaged) {
  const environmentPath = join(app.getAppPath(), '.env')
  const environmentResult = loadEnvironment({
    path: environmentPath,
    quiet: true,
  })
  const fileKeyConfigured = Boolean(
    environmentResult.parsed?.GEMINI_API_KEY?.trim(),
  )

  if (environmentResult.error) {
    console.error('[Avri AI] Failed to load the development .env file.', {
      name: environmentResult.error.name,
      message: environmentResult.error.message,
      stack: environmentResult.error.stack,
    })
  }

  console.info('[Avri AI] Development environment status.', {
    envFileLoaded: !environmentResult.error,
    fileKeyConfigured,
    mainProcessKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  })
}

let aiService: AIService | undefined

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: 'Avri',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Links from replies and settings open in the system browser; the app
  // window itself never navigates away from Avri.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    if (isAppNavigation(mainWindow.webContents.getURL(), event.url)) {
      return
    }

    event.preventDefault()
    if (isSafeExternalUrl(event.url)) {
      void shell.openExternal(event.url)
    }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  const dataDirectory = app.getPath('userData')
  const settings = new SettingsRepository(
    join(dataDirectory, 'settings.json'),
    () => process.env.GEMINI_API_KEY,
  )
  const chats = new LocalChatRepository(join(dataDirectory, 'chats.json'))
  const memoryRepository = new LocalMemoryRepository(
    join(dataDirectory, 'memories.json'),
  )
  const createProvider = (apiKey: string) => new GeminiProvider(apiKey)
  const memory = new MemoryService(
    memoryRepository,
    settings,
    createProvider,
  )

  aiService = new AIService(
    settings,
    createProvider,
    memory,
  )
  registerIpcHandlers({ ai: aiService, chats, settings, memory })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  aiService?.cancelAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
