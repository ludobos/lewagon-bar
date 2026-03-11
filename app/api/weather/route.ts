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

function computeTerrasseScore(tempMax: number, precipProb: number, windSpeed: number, uvIndex: number): number {
  let score = 5

  // Température : idéal 18-28°C
  if (tempMax >= 18 && tempMax <= 28) score += 3
  else if (tempMax >= 15 && tempMax < 18) score += 1
  else if (tempMax >= 28 && tempMax <= 33) score += 1
  else if (tempMax < 12 || tempMax > 35) score -= 3
  else score -= 1

  // Pluie : pénalité forte
  if (precipProb <= 10) score += 2
  else if (precipProb <= 30) score += 0
  else if (precipProb <= 60) score -= 2
  else score -= 4

  // Vent : pénalité si fort
  if (windSpeed < 15) score += 0
  else if (windSpeed < 25) score -= 1
  else score -= 2

  return Math.max(0, Math.min(10, score))
}

function getTerrasseTip(score: number, precipProb: number, tempMax: number, windSpeed: number): string {
  if (score >= 8) return 'Journée terrasse idéale'
  if (score >= 6) return 'Bonne journée pour la terrasse'
  if (precipProb > 60) return 'Risque de pluie — privilégier l\'intérieur'
  if (tempMax < 12) return 'Trop frais pour la terrasse'
  if (windSpeed > 25) return 'Vent fort — terrasse difficile'
  if (score >= 4) return 'Terrasse possible en journée'
  return 'Journée intérieur'
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,apparent_temperature_max,uv_index_max,wind_speed_10m_max&timezone=Europe/Paris&forecast_days=14`,
      { next: { revalidate: 3600 } } // cache 1h
    )
    const data = await res.json()

    const days = data.daily.time.map((date: string, i: number) => {
      const code = data.daily.weather_code[i]
      const d = new Date(date)
      const tempMax = data.daily.temperature_2m_max[i]
      const tempMin = data.daily.temperature_2m_min[i]
      const precipProb = data.daily.precipitation_probability_max?.[i] ?? 0
      const apparentTempMax = data.daily.apparent_temperature_max?.[i] ?? tempMax
      const uvIndex = data.daily.uv_index_max?.[i] ?? 0
      const windSpeed = data.daily.wind_speed_10m_max?.[i] ?? 0

      const terrasse_score = computeTerrasseScore(tempMax, precipProb, windSpeed, uvIndex)
      const tip = getTerrasseTip(terrasse_score, precipProb, tempMax, windSpeed)

      return {
        date,
        day: DAYS_FR[d.getDay()],
        icon: WEATHER_ICONS[code] || '🌤️',
        label: WEATHER_CODES[code] || 'Variable',
        max: Math.round(tempMax),
        min: Math.round(tempMin),
        precipitation_probability: Math.round(precipProb),
        apparent_temperature_max: Math.round(apparentTempMax),
        uv_index: Math.round(uvIndex),
        wind_speed_max: Math.round(windSpeed),
        terrasse_score,
        tip,
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
