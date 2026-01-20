import Image from "next/image"
import { cn } from "@/lib/utils"

interface NeonHostLogoProps {
  className?: string
}

export function NeonHostLogo({ className }: NeonHostLogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/images/neonhost-logo.png"
        alt="NeonHost"
        width={180}
        height={50}
        className="h-10 w-auto object-contain"
        priority
      />
    </div>
  )
}
