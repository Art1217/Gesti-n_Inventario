import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [status, setStatus] = useState('Verificando conexion...')
  const [color, setColor] = useState('text-yellow-400')

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('roles').select('id').limit(1)
        if (error) {
          setStatus('Supabase conectado, pero error: ' + error.message)
          setColor('text-orange-400')
        } else {
          setStatus('Supabase conectado correctamente')
          setColor('text-green-400')
        }
      } catch (e) {
        setStatus('Error de conexion: ' + e.message)
        setColor('text-red-400')
      }
    }
    checkConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 font-sans">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-10 shadow-xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Sistema de Inventario</h1>
        <p className="text-gray-400 mb-8 text-sm">Verificacion de Setup Inicial</p>
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-4">
            <span className="text-green-400 text-xl">OK</span>
            <div>
              <p className="text-white font-medium text-sm">Vite + React</p>
              <p className="text-gray-500 text-xs">Funcionando</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-4">
            <span className="text-green-400 text-xl">OK</span>
            <div>
              <p className="text-white font-medium text-sm">Tailwind CSS v4</p>
              <p className="text-gray-500 text-xs">Si ves estilos oscuros, esta activo</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-4">
            <span className="text-yellow-400 text-xl">DB</span>
            <div>
              <p className="text-white font-medium text-sm">Supabase</p>
              <p id="supabase-status" className={color + " text-xs font-mono"}>{status}</p>
            </div>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-6">
          Llena .env.local con tus credenciales reales de Supabase
        </p>
      </div>
    </div>
  )
}

export default App
