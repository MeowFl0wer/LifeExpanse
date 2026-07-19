import { useState, useEffect, useRef } from 'react'

interface RunningClockProps {
  launchedAt: string
}

function computeDuration(launchedAt: string): { days: number; hours: number; minutes: number; seconds: number } {
  const now = Date.now()
  const launched = new Date(launchedAt).getTime()
  let diff = Math.max(0, Math.floor((now - launched) / 1000))

  const days = Math.floor(diff / 86400)
  diff -= days * 86400
  const hours = Math.floor(diff / 3600)
  diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  const seconds = diff - minutes * 60

  return { days, hours, minutes, seconds }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export default function RunningClock({ launchedAt }: RunningClockProps) {
  const [dur, setDur] = useState(() => computeDuration(launchedAt))
  const rafRef = useRef<number>(0)
  const lastSecRef = useRef<number>(-1)

  useEffect(() => {
    function tick() {
      const now = Date.now()
      const sec = Math.floor(now / 1000)
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec
        setDur(computeDuration(launchedAt))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [launchedAt])

  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'inherit' }}>
      {dur.days} 天 {pad(dur.hours)} 小时 {pad(dur.minutes)} 分 {pad(dur.seconds)} 秒
    </span>
  )
}
