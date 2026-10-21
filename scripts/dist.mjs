// Builds Avri installers with electron-builder.
//
//   node scripts/dist.mjs          installers for the current system
//   node scripts/dist.mjs mac      macOS dmg for Apple silicon and Intel
//   node scripts/dist.mjs win      Windows NSIS installer
//   node scripts/dist.mjs linux    Linux AppImage
//
// The two macOS dmgs are built one after the other: built in parallel they
// mount volumes with the same name and break each other.
import { execSync } from 'node:child_process'

const ELECTRON_BUILDER = 'npx --yes electron-builder@26.0.12'
const CURRENT = { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform]
const platform = process.argv[2] ?? CURRENT

const runs = {
  mac: ['--mac --arm64', '--mac --x64'],
  win: ['--win'],
  linux: ['--linux'],
}[platform]

if (!runs) {
  console.error(`Unknown platform "${platform}". Use mac, win or linux.`)
  process.exit(1)
}

for (const args of runs) {
  console.log(`\n> electron-builder ${args}`)
  execSync(`${ELECTRON_BUILDER} ${args} --publish never`, { stdio: 'inherit' })
}
