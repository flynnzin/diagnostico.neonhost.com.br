"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PortResultCard, type PortTestResult } from "@/components/port-result-card"
import { 
  Play, 
  RefreshCw, 
  Globe, 
  Clock, 
  Activity,
  Wifi,
  AlertCircle,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TestResponse {
  success: boolean
  clientIp: string
  serverIp: string
  completedAt: string
  avgJitter: number
  results: PortTestResult[]
}

const defaultPorts: Omit<PortTestResult, "success" | "latency" | "jitter" | "packetsReceived" | "packetsLost">[] = [
  { port: 80, name: "HTTP", description: "Web Server", packetsSent: 0 },
  { port: 443, name: "HTTPS", description: "Web Server Seguro", packetsSent: 0 },
  { port: 3306, name: "MySQL", description: "Banco de Dados MySQL", packetsSent: 0 },
  { port: 30120, name: "FiveM", description: "Servidor FiveM", packetsSent: 0 },
]

export function ConnectivityTestPanel() {
  const [isLoading, setIsLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [clientIp, setClientIp] = useState<string | null>(null)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [avgJitter, setAvgJitter] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<PortTestResult[]>(
    defaultPorts.map(p => ({
      ...p,
      success: false,
      latency: 0,
      jitter: 0,
      packetsReceived: 0,
      packetsLost: 0,
    }))
  )
  const [isLoadingIp, setIsLoadingIp] = useState(true)

  // Busca o IP do cliente na inicialização com múltiplos fallbacks
  useEffect(() => {
    const fetchClientIp = async () => {
      setIsLoadingIp(true)
      
      // Lista de APIs para tentar buscar o IP (em ordem)
      const ipApis = [
        { url: "/api/test-connectivity", method: "GET", extract: (data: { clientIp: string }) => data.clientIp },
        { url: "https://api.ipify.org?format=json", method: "GET", extract: (data: { ip: string }) => data.ip },
        { url: "https://ipapi.co/json/", method: "GET", extract: (data: { ip: string }) => data.ip },
        { url: "https://api.ip.sb/jsonip", method: "GET", extract: (data: { ip: string }) => data.ip },
        { url: "https://httpbin.org/ip", method: "GET", extract: (data: { origin: string }) => data.origin.split(",")[0].trim() },
        { url: "https://api64.ipify.org?format=json", method: "GET", extract: (data: { ip: string }) => data.ip },
        { url: "https://icanhazip.com", method: "GET", extract: (data: string) => data.trim() },
      ]
      
      for (const api of ipApis) {
        try {
          const response = await fetch(api.url, { 
            method: api.method,
            signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
          })
          
          if (response.ok) {
            const contentType = response.headers.get("content-type")
            let data
            
            if (contentType?.includes("application/json")) {
              data = await response.json()
            } else {
              data = await response.text()
            }
            
            const ip = api.extract(data)
            
            if (ip && ip !== "Não detectado" && ip.length > 0) {
              setClientIp(ip)
              setIsLoadingIp(false)
              return
            }
          }
        } catch {
          // Tenta próxima API silenciosamente
          continue
        }
      }
      
      // Se todas as APIs falharem
      setClientIp("Não foi possível detectar")
      setIsLoadingIp(false)
    }
    
    fetchClientIp()
  }, [])

  const runTest = async () => {
    setIsLoading(true)
    setHasRun(true)
    setError(null)
    
    try {
      const response = await fetch("/api/test-connectivity", {
        method: "POST",
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || "Falha ao executar teste")
        return
      }
      
      setClientIp(data.clientIp)
      setCompletedAt(data.completedAt)
      setAvgJitter(data.avgJitter)
      setResults(data.results)
    } catch (err) {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const successCount = results.filter(r => r.success).length
  const totalTests = results.length
  const overallSuccess = hasRun ? Math.round((successCount / totalTests) * 100) : 0
  const avgLatency = hasRun 
    ? Math.round((results.reduce((sum, r) => sum + r.latency, 0) / totalTests) * 10) / 10
    : 0

  // Classifica qualidade do jitter
  const getJitterStatus = (jitter: number) => {
    if (jitter < 5) return { label: "Excelente", color: "text-success" }
    if (jitter < 15) return { label: "Bom", color: "text-primary" }
    if (jitter < 30) return { label: "Regular", color: "text-yellow-500" }
    return { label: "Instável", color: "text-destructive" }
  }

  const jitterStatus = getJitterStatus(avgJitter)

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-xl mb-6">
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Diagnóstico de Rede</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Teste de Conectividade
              </h2>
              <p className="text-muted-foreground max-w-md">
                Verifique se sua conexão está acessível aos servidores da NeonHost.
              </p>
            </div>
            
            <Button
              onClick={runTest}
              disabled={isLoading}
              size="lg"
              className={cn(
                "relative overflow-hidden group h-14 px-8",
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                "shadow-lg shadow-primary/25"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Testando...
                </>
              ) : hasRun ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Testar Novamente
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Iniciar Teste
                </>
              )}
            </Button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Seu IP</span>
              </div>
              <p className="font-mono text-sm text-foreground truncate">
                {isLoadingIp ? "Detectando..." : (clientIp || "Não detectado")}
              </p>
            </div>
            
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Latência Média</span>
              </div>
              <p className="font-mono text-sm text-foreground">
                {hasRun ? `${avgLatency}ms` : "—"}
              </p>
            </div>
            
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Jitter</span>
              </div>
              <p className={cn("font-mono text-sm", hasRun ? jitterStatus.color : "text-foreground")}>
                {hasRun ? `${avgJitter}ms` : "—"}
              </p>
              {hasRun && (
                <p className={cn("text-[10px] mt-0.5", jitterStatus.color)}>
                  {jitterStatus.label}
                </p>
              )}
            </div>
            
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Sucesso</span>
              </div>
              <p className={cn(
                "font-mono text-sm",
                overallSuccess >= 80 ? "text-success" : 
                overallSuccess >= 50 ? "text-yellow-500" : 
                hasRun ? "text-destructive" : "text-foreground"
              )}>
                {hasRun ? `${overallSuccess}%` : "—"}
              </p>
            </div>
            
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Portas</span>
              </div>
              <p className="font-mono text-sm text-foreground">
                {hasRun ? `${successCount}/${totalTests}` : "—"}
              </p>
            </div>
            
            <div className="rounded-xl bg-secondary/50 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Horário</span>
              </div>
              <p className="font-mono text-[11px] text-foreground leading-tight">
                {completedAt || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      
      {/* Results Grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {results.map((result) => (
          <PortResultCard
            key={result.port}
            result={result}
            isLoading={isLoading}
          />
        ))}
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Este teste verifica a conectividade TCP entre seu dispositivo e os servidores da NeonHost.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Jitter baixo indica uma conexão mais estável e melhor para jogos e aplicações em tempo real.
        </p>
      </div>
    </div>
  )
}
