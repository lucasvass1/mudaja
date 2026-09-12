// Devolve só a CONTAGEM total de leads (sem nome, e-mail, telefone ou
// qualquer outro dado pessoal) para alimentar o contador social da LP.
// Usa a service role key só no servidor — nunca é exposta ao navegador.

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('leads-count: variáveis de ambiente ausentes');
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase respondeu ${response.status}`);
    }

    const range = response.headers.get('content-range') || '';
    const count = Number(range.split('/')[1]) || 0;

    // Cache curto na CDN da Vercel: não precisa bater no Supabase a cada visita.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ count });
  } catch (err) {
    console.error('leads-count: erro ao contar leads', err);
    res.status(502).json({ error: 'Failed to count leads' });
  }
};
