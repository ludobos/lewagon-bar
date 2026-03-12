'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError(false)
    const res = await signIn('credentials', {
      password,
      redirect: false,
    })
    if (res?.ok) {
      router.push('/admin/gestion')
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-amber-400 mb-1">Le Wagon</h1>
          <p className="text-stone-500 text-sm">22 quai de la Fosse, Nantes</p>
        </div>

        <div className="bg-stone-900 rounded-2xl p-6 border border-stone-800">
          <label className="block text-stone-400 text-sm mb-2">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 text-lg focus:border-amber-400 outline-none mb-4"
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-3 text-center">Mot de passe incorrect</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold py-3 rounded-xl text-lg transition-colors"
          >
            {loading ? 'Connexion...' : 'Entrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
