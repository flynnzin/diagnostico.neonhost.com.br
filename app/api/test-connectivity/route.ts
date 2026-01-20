import { NextRequest, NextResponse } from "next/server"

// IP do servidor NeonHost para teste de conectividade (protegido via env)
const SERVER_IP = process.env.NEONHOST_SERVER_IP || "servidor.neonhost.com.br"

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
function maskServerIp(): string {
  return "*.*.81.*"
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
  { port: 1433, name: "MSSQL", description: "SQL Server" },
  { port: 7172, name: "Game", description: "Servidor de Jogos" },
  { port: 8282, name: "API", description: "Servidor de API" },
  { port: 30120, name: "FiveM", description: "Servidor FiveM" },
  { port: 25565, name: "Minecraft", description: "Servidor Minecraft" },
  { port: 55901, name: "Custom", description: "Porta Personalizada" },
]

// Função para simular teste de conectividade TCP com Jitter
async function simulatePortTest(port: number): Promise<{
  success: boolean
  latency: number
  jitter: number
  packetsSent: number
  packetsReceived: number
  packetsLost: number
}> {
  // Simula múltiplas medições de latência para calcular jitter
  const packetsSent = 5
  const latencies: number[] = []
  
  // Simula resultado baseado em algumas condições
  const isCommonPort = [80, 443].includes(port)
  const successRate = isCommonPort ? 0.95 : 0.7 + Math.random() * 0.25
  
  // Simula latências variáveis para cada pacote
  for (let i = 0; i < packetsSent; i++) {
    const baseLatency = 10 + Math.random() * 40
    const variation = Math.random() * 15 - 7.5 // -7.5 a +7.5 ms de variação
    latencies.push(Math.max(1, baseLatency + variation))
  }
  
  // Calcula latência média
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
  
  // Calcula Jitter (variação média entre latências consecutivas)
  let jitterSum = 0
  for (let i = 1; i < latencies.length; i++) {
    jitterSum += Math.abs(latencies[i] - latencies[i - 1])
  }
  const jitter = latencies.length > 1 ? jitterSum / (latencies.length - 1) : 0
  
  const packetsReceived = Math.floor(packetsSent * successRate)
  const packetsLost = packetsSent - packetsReceived
  
  // Adiciona delay simulando teste real
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
  
  return {
    success: packetsReceived > 0,
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
        const result = await simulatePortTest(portInfo.port)
        return {
          ...portInfo,
          ...result,
        }
      })
    )
    
    // Calcula jitter médio geral
    const avgJitter = testResults.reduce((sum, r) => sum + r.jitter, 0) / testResults.length
    
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
      serverIp: maskServerIp(),
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
    serverIp: maskServerIp(),
    ports: TEST_PORTS,
  })
}
