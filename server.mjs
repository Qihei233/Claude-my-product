import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const root = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '')
const port = Number(process.env.PORT) || 4173
const url = `http://localhost:${port}`

function openBrowser(targetUrl) {
  if (process.env.NO_OPEN === '1') return

  const attempts =
    process.platform === 'win32'
      ? [
          `start "" "${targetUrl}"`,
          `rundll32 url.dll,FileProtocolHandler "${targetUrl}"`,
          `powershell -NoProfile -NonInteractive -Command "Start-Process '${targetUrl}'"`,
        ]
      : process.platform === 'darwin'
        ? [`open "${targetUrl}"`]
        : [`xdg-open "${targetUrl}"`]

  const tryOpen = (index) => {
    if (index >= attempts.length) {
      console.log('未能自动打开浏览器，请手动复制上面的访问地址到浏览器中打开。')
      return
    }
    exec(attempts[index], { windowsHide: true }, (error) => {
      if (error) tryOpen(index + 1)
    })
  }

  tryOpen(0)
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://localhost:${port}`)
  const pathname = decodeURIComponent(requestUrl.pathname)
  const relativePath = pathname.replace(/^\/+/, '')
  const filePath = normalize(join(root, relativePath || 'index.html'))

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const data = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    })
    response.end(data)
  } catch {
    // BrowserRouter needs every unknown path to fall back to the app shell.
    try {
      const html = await readFile(join(root, 'index.html'))
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(html)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，平台可能已经在运行。`)
    console.error(`如果浏览器没有自动打开，请手动访问：${url}`)
    openBrowser(url)
  } else {
    console.error(error)
  }
  process.exitCode = 1
})

server.listen(port, '127.0.0.1', () => {
  console.log('')
  console.log('奶蛙 Python 学习平台已启动')
  console.log(`访问地址：${url}`)
  console.log('按 Ctrl + C 可停止服务。')
  console.log('')
  openBrowser(url)
})
