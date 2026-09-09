// Notifica a equipe por e-mail (Resend) a cada novo lead salvo no Supabase.
// Chamada best-effort pelo front-end logo após o insert (dist/assets/script.js).

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

const TIPO_LABELS = { cliente: 'Cliente', motorista: 'Motorista', imprensa: 'Imprensa' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { RESEND_API_KEY, RESEND_FROM_EMAIL, TEAM_NOTIFY_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !TEAM_NOTIFY_EMAIL) {
    console.error('notify-lead: variáveis de ambiente ausentes');
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const { tipo, nome, contato, cidade, extra } = req.body || {};
  if (!tipo || !nome || !contato) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const extraItems = extra && typeof extra === 'object'
    ? Object.entries(extra)
        .filter(([, value]) => value)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`)
        .join('')
    : '';

  const html = `
    <h2>Novo lead — ${escapeHtml(TIPO_LABELS[tipo] || tipo)}</h2>
    <ul>
      <li><strong>Nome:</strong> ${escapeHtml(nome)}</li>
      <li><strong>Contato:</strong> ${escapeHtml(contato)}</li>
      ${cidade ? `<li><strong>Cidade:</strong> ${escapeHtml(cidade)}</li>` : ''}
      ${extraItems}
    </ul>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: TEAM_NOTIFY_EMAIL,
        subject: `Novo lead MudaJá — ${TIPO_LABELS[tipo] || tipo}: ${nome}`,
        html,
      }),
    });

    if (!response.ok) {
      console.error('notify-lead: erro do Resend', response.status, await response.text());
      res.status(502).json({ error: 'Failed to send notification' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-lead: erro inesperado', err);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
