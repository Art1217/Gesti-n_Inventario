import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [userRole, setUserRole] = useState(null)
  const [loadingRole, setLoadingRole] = useState(false)
  // Guarda el userId para el que ya cargamos el rol — evita re-fetch en cada foco de ventana
  const roleLoadedForRef = useRef(null)

  const fetchUserRole = async (userId) => {
    // Si ya tenemos el rol para este usuario, no volver a buscar (evita spinner al cambiar ventana)
    if (roleLoadedForRef.current === userId) return

    setLoadingRole(true)
    try {
      const { data, error } = await supabase
        .from('usuarios_roles')
        .select('roles(nombre)')
        .eq('id_usuario', userId)
        .limit(1)

      if (error) throw error
      const nombre = data?.[0]?.roles?.nombre ?? null
      setUserRole(nombre)
      roleLoadedForRef.current = userId
    } catch (err) {
      console.error('Error al obtener rol:', err.message)
      setUserRole(null)
    } finally {
      setLoadingRole(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchUserRole(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION ya fue manejado por getSession() arriba — evita doble query
      if (event === 'INITIAL_SESSION') return

      setSession(session)

      if (event === 'SIGNED_IN') {
        if (session?.user) fetchUserRole(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUserRole(null)
        roleLoadedForRef.current = null
      }
      // TOKEN_REFRESHED, USER_UPDATED: solo actualiza la sesión, sin tocar el rol
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserRole(null)
  }

  const value = {
    session,
    userRole,
    loadingRole,
    isLoading: session === undefined,
    user: session?.user ?? null,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
