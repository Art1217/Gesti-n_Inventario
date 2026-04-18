// Supabase Edge Function: consulta-ruc
// Secreto requerido: APIS_NET_PE_TOKEN (en Supabase Dashboard → Settings → Edge Functions → Secrets)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { ruc } = await req.json()

    if (!ruc || !/^\d{11}$/.test(String(ruc))) {
      return new Response(
        JSON.stringify({ ok: false, error: 'RUC inválido. Debe tener exactamente 11 dígitos.' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const token = Deno.env.get('APIS_NET_PE_TOKEN')
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Token de API no configurado en Supabase Secrets.' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const resp = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${ruc}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await resp.json()

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: data?.message ?? `RUC no encontrado (${resp.status})` }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ ok: true, ...data }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Error interno' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
