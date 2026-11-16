const path = require('node:path');

async function main() {
  const { packager } = await import('@electron/packager');
  const root = path.join(__dirname, '..');
  const [build] = await packager({
    dir: root,
    out: process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(root, '..', 'windows-build'),
    name: 'Charly the Clown',
    executableName: 'Charly the Clown',
    platform: 'win32',
    arch: 'x64',
    asar: true,
    overwrite: true,
    icon: path.join(__dirname, 'charly.ico'),
    ignore: [/^\/(?:\.openai|node_modules|test|android)(?:\/|$)/, /^\/capacitor\.config\.json$/],
    win32metadata: { ProductName: 'Charly the Clown • Run for Fun', FileDescription: 'Charly the Clown' },
  });
  console.log(build);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
