import { supabase } from '../lib/supabaseClient'

// Lista completa de proveedores (para la página de Proveedores)
export async function getProveedores() {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

// Solo id + nombre (para dropdowns en Catálogo)
export async function getProveedoresSimple() {
  const { data, error } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function crearProveedor(form) {
  const { error } = await supabase.from('proveedores').insert(form)
  if (error) throw error
}

export async function actualizarProveedor(id, form) {
  const { error } = await supabase.from('proveedores').update(form).eq('id', id)
  if (error) throw error
}

export async function eliminarProveedor(id) {
  const { error } = await supabase.from('proveedores').delete().eq('id', id)
  if (error) throw error
}
