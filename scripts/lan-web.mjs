import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const root=resolve('web')
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'}
createServer(async(req,res)=>{
 try {
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))
  if(path!==root && !path.startsWith(root+sep)){res.writeHead(403).end();return}
  let data, type=types[extname(path)]
  try {data=await readFile(path)} catch {data=await readFile(resolve(root,'index.html'));type='text/html'}
  res.writeHead(200,{'Content-Type':type??'application/octet-stream','Cache-Control':'no-store'}).end(data)
 }catch{res.writeHead(500).end()}
}).listen(5173,'127.0.0.1',()=>console.log('Open http://localhost:5173/r/lan-test in Chrome or Edge. Keep this window open.'))
