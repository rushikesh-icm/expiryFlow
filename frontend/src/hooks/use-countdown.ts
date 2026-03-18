import { useState, useEffect } from "react"

interface CountdownResult {
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
  totalSeconds: number
}

function calculateTimeLeft(targetTime: string | null): CountdownResult {
  if (!targetTime) return { hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 }

  try {
    const diff = new Date(targetTime).getTime() - Date.now()
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 }

    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { hours, minutes, seconds, isExpired: false, totalSeconds }
  } catch {
    return { hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 }
  }
}

export function useCountdown(targetTime: string | null): CountdownResult {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetTime))

  useEffect(() => {
    if (!targetTime) return

    setTimeLeft(calculateTimeLeft(targetTime))
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetTime))
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTime])

  return timeLeft
}
