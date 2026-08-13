import { app, BrowserWindow, Menu, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const splashPath = join(here, 'splash.html')

let mainWindow
let harnessProcess
let harnessUrl
let isQuitting = false
let launchGeneration = 0
let recentLog = []

function rememberLog(source, chunk) {
  const text = chunk.toString()
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) recentLog.push(`[${source}] ${line}`)
  }
  recentLog = recentLog.slice(-30)
  return text
}

function splashUrl(state = 'starting', detail = '') {
  const url = new URL(`file://${splashPath}`)
  url.searchParams.set('state', state)
  if (detail) url.searchParams.set('detail', detail)
  return url.toString()
}

async function showSplash(state, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  await mainWindow.loadURL(splashUrl(state, detail))
}

function stopHarness() {
  harnessUrl = undefined
  if (!harnessProcess || harnessProcess.killed) return
  harnessProcess.kill('SIGTERM')
  harnessProcess = undefined
}

async function waitForHarness(url, generation) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (generation !== launchGeneration) throw new Error('Launch replaced')
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) })
      if (response.ok) return
    } catch {
      // The server announces its URL immediately before it begins accepting requests.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Harness started but its Web UI did not become ready in time.')
}

async function startHarness() {
  const generation = ++launchGeneration
  stopHarness()
  recentLog = []
  await showSplash('starting')

  const dshPackage = require.resolve('@deepseek-ai/dsh/package.json')
  const dshBin = join(dirname(dshPackage), 'lib', 'bin.js')
  const dshHome = join(app.getPath('userData'), 'harness-home')
  const workspaceRoot = app.getPath('documents')
  await mkdir(dshHome, { recursive: true })

  harnessProcess = spawn(process.execPath, ['--expose-internals', dshBin, 'web', '--port', '0'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let announced = false
  const inspectOutput = async (source, chunk) => {
    const text = rememberLog(source, chunk)
    const match = text.match(/dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/)
    if (!match || announced || generation !== launchGeneration) return
    announced = true
    harnessUrl = match[1]
    try {
      await waitForHarness(harnessUrl, generation)
      if (generation === launchGeneration && mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(harnessUrl)
      }
    } catch (error) {
      if (generation === launchGeneration && error.message !== 'Launch replaced') {
        await showSplash('error', error.message)
      }
    }
  }

  harnessProcess.stdout.on('data', chunk => void inspectOutput('dsh', chunk))
  harnessProcess.stderr.on('data', chunk => void inspectOutput('error', chunk))
  harnessProcess.on('error', error => {
    if (generation === launchGeneration) void showSplash('error', error.message)
  })
  harnessProcess.on('exit', (code, signal) => {
    if (generation !== launchGeneration || isQuitting) return
    harnessProcess = undefined
    const reason = recentLog.slice(-18).join('\n') || `Harness stopped (${signal || `exit ${code}`}).`
    void showSplash('error', reason)
  })

  setTimeout(() => {
    if (generation === launchGeneration && !announced) {
      const detail = recentLog.at(-1) || 'Harness did not report a local URL.'
      stopHarness()
      void showSplash('error', detail)
    }
  }, 45_000)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: 'DeepSeek Harness Desktop',
    backgroundColor: '#10151c',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !url.startsWith(harnessUrl || 'http://127.0.0.1:0')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === 'dsh-desktop://restart') {
      event.preventDefault()
      void startHarness()
      return
    }
    const allowed = url.startsWith('file:') || (harnessUrl && url.startsWith(harnessUrl))
    if (!allowed) {
      event.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

function installMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Restart Harness', accelerator: 'CmdOrCtrl+Shift+R', click: () => void startHarness() },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  app.setName('DeepSeek Harness Desktop')
  installMenu()
  createWindow()
  await startHarness()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      void startHarness()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  stopHarness()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
