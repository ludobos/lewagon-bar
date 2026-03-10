import { NextResponse } from 'next/server'

// Nantes coordinates
const LAT = 47.2184
const LON = -1.5536

const WEATHER_CODES: Record<number, string> = {
  0: 'Soleil',
  1: 'Dégagé',
  2: 'Nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine',
  55: 'Bruine forte',
  61: 'Pluie légère',
  63: 'Pluie',
  65: 'Pluie forte',
  71: 'Neige légère',
  73: 'Neige',
  75: 'Neige forte',
  80: 'Averses',
  81: 'Averses modérées',
  82: 'Averses fortes',
  95: 'Orage',
  96: 'Orage grêle',
  99: 'Orage grêle forte',
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌧️', 55: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export async function GET() {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe/Paris&forecast_days=14`,
      { next: { revalidate: 3600 } } // cache 1h
    )
    const data = await res.json()

    const days = data.daily.time.map((date: string, i: number) => {
      const code = data.daily.weather_code[i]
      const d = new Date(date)
      return {
        date,
        day: DAYS_FR[d.getDay()],
        icon: WEATHER_ICONS[code] || '🌤️',
        label: WEATHER_CODES[code] || 'Variable',
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
      }
    })

    return NextResponse.json({
      city: 'Nantes',
      this_week: days.slice(0, 7),
      next_week: days.slice(7, 14),
    })
  } catch {
    return NextResponse.json({ error: 'Météo indisponible' }, { status: 500 })
  }
}
