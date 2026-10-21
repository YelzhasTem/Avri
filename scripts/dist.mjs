// Builds Avri installers with electron-builder.
//
//   node scripts/dist.mjs          installers for the current system
//   node scripts/dist.mjs mac      macOS dmg for Apple silicon and Intel
//   node scripts/dist.mjs win      Windows NSIS installer
//   node scripts/dist.mjs linux    Linux AppImage
//
// The two macOS dmgs are built one after the other, each with its own volume
// name: built together, or with a leftover mounted volume of the same name,
// hdiutil breaks one of them.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ELECTRON_BUILDER = 'npx --yes electron-builder@26.0.12'
const CURRENT = { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform]
const platform = process.argv[2] ?? CURRENT
const { productName = 'Avri', version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

const macBuild = (arch) => `--mac --${arch} "-c.dmg.title=${productName} ${version} ${arch}"`

const runs = {
  mac: [macBuild('arm64'), macBuild('x64')],
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
