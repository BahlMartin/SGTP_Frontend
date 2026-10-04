export function isValidHalfHourTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return Boolean(match && Number(match[2]) % 30 === 0)
}

export function adjustTime(value, offset) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  const minutes = match ? Number(match[1]) * 60 + Number(match[2]) : 0
  const adjustedMinutes = (minutes + offset + 1440) % 1440
  const hours = String(Math.floor(adjustedMinutes / 60)).padStart(2, '0')
  const adjustedMinute = String(adjustedMinutes % 60).padStart(2, '0')
  return `${hours}:${adjustedMinute}`
}

function parseTimeToSeconds(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value || '')
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)
}

function getArgentinaTimeInSeconds(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second)
}

export function isWithinShiftGrace(startTime, endTime, now = new Date()) {
  const startSeconds = parseTimeToSeconds(startTime)
  const endSeconds = parseTimeToSeconds(endTime)
  if (startSeconds === null || endSeconds === null) return true

  const currentSeconds = getArgentinaTimeInSeconds(now)
  const crossesMidnight = endSeconds < startSeconds
  for (const startDayOffset of [-86400, 0]) {
    const shiftStart = startSeconds + startDayOffset
    const shiftEnd = endSeconds + (crossesMidnight ? 86400 : 0) + 900 + startDayOffset
    if (currentSeconds >= shiftStart && currentSeconds <= shiftEnd) return true
  }

  return false
}
