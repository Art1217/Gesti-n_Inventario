import { useState } from 'react'
import { Menu, X, Package2 } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-950 flex-col lg:flex-row overflow-hidden relative">
      
      {/* ── Mobile Header (solo < lg) ── */}
      <div className="lg:hidden flex items-center justify-between bg-gray-900 border-b border-gray-800 px-4 py-3 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Package2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold leading-none">Inventario</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-1 -mr-1 text-gray-400 hover:text-white focus:outline-none transition-colors"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* ── Sidebar Desktop / Mobile Overlay ── */}
      <Sidebar 
        onCloseMobile={() => setSidebarOpen(false)}
        className={`
          absolute lg:relative z-40 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      />

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto bg-gray-950 relative w-full">
        {children}
      </main>
    </div>
  )
}
