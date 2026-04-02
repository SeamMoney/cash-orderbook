import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '../../../')
// Try local node_modules first (pnpm hoists differently), then root
const localPath = path.join(__dirname, '../node_modules/@rive-app/canvas/rive.wasm')
const rootPath = path.join(rootDir, 'node_modules/@rive-app/canvas/rive.wasm')
const sourcePath = fs.existsSync(localPath) ? localPath : rootPath
const targetDir = path.resolve(__dirname, '../public/rive')
const targetPath = path.join(targetDir, 'rive.wasm')

// Ensure the target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy the file
fs.copyFileSync(sourcePath, targetPath)
