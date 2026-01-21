import { NextRequest, NextResponse } from "next/server"
import net from "net"

// IP do servidor NeonHost para teste de conectividade (protegido via env)
// Fallback para um domínio real para garantir funcionamento se ENV não estiver definida
const SERVER_IP = "45.146.81.208"

// Rate limiting simples em memória (em produção, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // máximo de requisições
const RATE_WINDOW = 60 * 1000 // 1 minuto em ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT) {
    return false
  }
  
  record.count++
  return true
}

// Função para mascarar IP (mostra apenas parte dele)
function maskServerIp(ip: string): string {
  // Se for domínio, retorna como está
  if (/[a-zA-Z]/.test(ip)) return ip;
  
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `*.*.${parts[2]}.*`;
  }
  return "Servidor NeonHost";
}

// Função robusta para detectar IP do cliente com 10+ verificações
function getClientIp(request: NextRequest): string {
  // Lista de headers para verificar em ordem de prioridade
  const ipHeaders = [
    // 1. Cloudflare
    "cf-connecting-ip",
    // 2. AWS CloudFront / ELB
    "x-forwarded-for",
    // 3. Vercel
    "x-vercel-forwarded-for",
    // 4. Akamai / outros CDNs
    "true-client-ip",
    // 5. Nginx proxy
    "x-real-ip",
    // 6. Google Cloud / Azure
    "x-client-ip",
    // 7. Fastly CDN
    "fastly-client-ip",
    // 8. Fly.io
    "fly-client-ip",
    // 9. Header padrão alternativo
    "x-cluster-client-ip",
    // 10. Proxy genérico
    "x-forwarded",
    // 11. Forwarded padrão RFC 7239
    "forwarded",
    // 12. Outro proxy
    "proxy-client-ip",
    // 13. WebLogic
    "wl-proxy-client-ip",
    // 14. HTTP_X headers
    "http-x-forwarded-for",
    // 15. Via header pode conter IP
    "http-client-ip",
  ]
  
  for (const header of ipHeaders) {
    const value = request.headers.get(header)
    if (value) {
      // x-forwarded-for pode conter múltiplos IPs separados por vírgula
      // O primeiro é geralmente o IP real do cliente
      const ip = value.split(",")[0].trim()
      
      // Verifica se parece um IP válido (IPv4 ou IPv6)
      if (isValidIp(ip)) {
        return ip
      }
    }
  }
  
  // Fallback: tenta extrair do header Forwarded (RFC 7239)
  const forwarded = request.headers.get("forwarded")
  if (forwarded) {
    const match = forwarded.match(/for=["']?([^"',;\s]+)/)
    if (match && match[1]) {
      const ip = match[1].replace(/^\[/, "").replace(/\]$/, "") // Remove brackets de IPv6
      if (isValidIp(ip)) {
        return ip
      }
    }
  }
  
  return "Não detectado"
}

// Função para validar formato de IP
function isValidIp(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "undefined") {
    return false
  }
  
  // Regex para IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  
  // Regex simplificada para IPv6
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  
  // Verifica se é localhost/loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return true // Aceita para desenvolvimento local
  }
  
  if (ipv4Regex.test(ip)) {
    // Valida cada octeto do IPv4
    const octets = ip.split(".")
    return octets.every(octet => {
      const num = parseInt(octet, 10)
      return num >= 0 && num <= 255
    })
  }
  
  return ipv6Regex.test(ip)
}

// Portas comuns para teste de conectividade
const TEST_PORTS = [
  { port: 80, name: "HTTP", description: "Web Server" },
  { port: 443, name: "HTTPS", description: "Web Server Seguro" },
  { port: 3306, name: "MySQL", description: "Banco de Dados MySQL" },
  { port: 30120, name: "FiveM", description: "Servidor FiveM" },
]

// Função para medir latência TCP real
function measureTcpLatency(host: string, port: number, timeout = 2000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const socket = new net.Socket()
    
    // Define timeout para a conexão
    socket.setTimeout(timeout)
    
    socket.connect(port, host, () => {
      const duration = performance.now() - start
      socket.destroy()
      resolve(duration)
    })
    
    socket.on('error', (err) => {
      socket.destroy()
      reject(err)
    })
    
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Timeout'))
    })
  })
}

// Função para realizar teste real de conectividade TCP
async function performRealPortTest(host: string, port: number): Promise<{
  success: boolean
  latency: number
  jitter: number
  packetsSent: number
  packetsReceived: number
  packetsLost: number
}> {
  const packetsSent = 5
  const latencies: number[] = []
  let successCount = 0
  
  for (let i = 0; i < packetsSent; i++) {
    try {
      const latency = await measureTcpLatency(host, port)
      latencies.push(latency)
      successCount++
    } catch (error) {
      // Falha na conexão (timeout ou erro)
      // Não adicionamos latência para falhas
    }
    
    // Pequeno delay entre tentativas para não flodar
    if (i < packetsSent - 1) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  const packetsReceived = successCount
  const packetsLost = packetsSent - packetsReceived
  const success = packetsReceived > 0
  
  // Calcula latência média (apenas dos pacotes bem sucedidos)
  const avgLatency = latencies.length > 0 
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
    : 0
  
  // Calcula Jitter (variação média entre latências consecutivas)
  let jitterSum = 0
  let jitterCount = 0
  
  if (latencies.length > 1) {
    for (let i = 1; i < latencies.length; i++) {
      jitterSum += Math.abs(latencies[i] - latencies[i - 1])
      jitterCount++
    }
  }
  
  const jitter = jitterCount > 0 ? jitterSum / jitterCount : 0
  
  return {
    success,
    latency: Math.round(avgLatency * 10) / 10,
    jitter: Math.round(jitter * 10) / 10,
    packetsSent,
    packetsReceived,
    packetsLost,
  }
}

export async function POST(request: NextRequest) {
  try {
    // Obtém o IP do cliente usando verificação robusta com 15+ headers
    const ip = getClientIp(request)
    
    // Verifica rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Muitas requisições. Aguarde 1 minuto e tente novamente." },
        { status: 429 }
      )
    }
    
    // Executa testes em todas as portas em paralelo
    const testResults = await Promise.all(
      TEST_PORTS.map(async (portInfo) => {
        // Usa o IP definido na constante SERVER_IP
        const result = await performRealPortTest(SERVER_IP, portInfo.port)
        return {
          ...portInfo,
          ...result,
        }
      })
    )
    
    // Calcula jitter médio geral (apenas dos testes com sucesso)
    const validJitters = testResults.filter(r => r.success).map(r => r.jitter)
    const avgJitter = validJitters.length > 0
      ? validJitters.reduce((sum, j) => sum + j, 0) / validJitters.length
      : 0
    
    const completedAt = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    
    return NextResponse.json({
      success: true,
      clientIp: ip,
      serverIp: maskServerIp(SERVER_IP),
      completedAt,
      avgJitter: Math.round(avgJitter * 10) / 10,
      results: testResults,
    })
  } catch (error) {
    console.error("Erro ao testar conectividade:", error)
    return NextResponse.json(
      { success: false, error: "Erro interno ao processar teste" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Obtém o IP do cliente usando verificação robusta com 15+ headers
  const ip = getClientIp(request)
  
  return NextResponse.json({
    clientIp: ip,
    serverIp: maskServerIp(SERVER_IP),
    ports: TEST_PORTS,
  })
}
