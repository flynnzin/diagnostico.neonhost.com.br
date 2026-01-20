"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Loader2, Signal, Activity } from "lucide-react"

export interface PortTestResult {
  port: number
  name: string
  description: string
  success: boolean
  latency: number
  jitter: number
  packetsSent: number
  packetsReceived: number
  packetsLost: number
}

interface PortResultCardProps {
  result: PortTestResult
  isLoading?: boolean
}

export function PortResultCard({ result, isLoading }: PortResultCardProps) {
  const successRate = result.packetsSent > 0 
    ? Math.round((result.packetsReceived / result.packetsSent) * 100) 
    : 0

  // Classifica qualidade do jitter
  const getJitterQuality = (jitter: number) => {
    if (jitter < 5) return { label: "Excelente", color: "text-success" }
    if (jitter < 15) return { label: "Bom", color: "text-primary" }
    if (jitter < 30) return { label: "Regular", color: "text-yellow-500" }
    return { label: "Ruim", color: "text-destructive" }
  }

  const jitterQuality = getJitterQuality(result.jitter)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border transition-all duration-300",
        "bg-card/50 backdrop-blur-sm",
        isLoading && "animate-pulse",
        result.success
          ? "border-success/30 hover:border-success/50"
          : "border-destructive/30 hover:border-destructive/50"
      )}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "absolute inset-0 opacity-10",
          result.success ? "bg-success" : "bg-destructive"
        )}
      />
      
      <div className="relative p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                result.success
                  ? "bg-success/20 text-success"
                  : "bg-destructive/20 text-destructive"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : result.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-foreground">
                  Porta {result.port}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {result.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{result.description}</p>
            </div>
          </div>
          
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 text-sm justify-end">
              <Signal className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">
                {result.latency}ms
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs justify-end">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className={cn("font-mono", jitterQuality.color)}>
                {result.jitter}ms jitter
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              Enviados: <span className="font-mono text-foreground">{result.packetsSent}</span>
            </span>
            <span className="text-success">
              Sucesso: <span className="font-mono">{result.packetsReceived}</span>
            </span>
            <span className="text-destructive">
              Falhas: <span className="font-mono">{result.packetsLost}</span>
            </span>
          </div>
          <div
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              successRate >= 80
                ? "bg-success/20 text-success"
                : successRate >= 50
                ? "bg-yellow-500/20 text-yellow-500"
                : "bg-destructive/20 text-destructive"
            )}
          >
            {successRate}%
          </div>
        </div>
      </div>
    </div>
  )
}
