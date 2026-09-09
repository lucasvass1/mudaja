// Disparo único e protegido: busca todos os leads com contato em formato de
// e-mail no Supabase e envia a campanha "estamos no ar" via Resend.
//
// Uso (no dia do lançamento):
//   curl -X POST https://SEU-DOMINIO/api/send-launch-campaign \
//     -H "Authorization: Bearer $CAMPAIGN_SECRET"
//
// Adicione ?dryRun=true para só contar quantos e-mails seriam enviados,
// sem disparar nada.

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 1000;
const BATCH_SIZE = 100; // limite do endpoint de batch do Resend

async function fetchAllEmailLeads(supabaseUrl, serviceRoleKey) {
  const leads = [];
  let from = 0;

  while (true) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/leads?select=nome,contato&order=created_at.asc`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Range: `${from}-${from + PAGE_SIZE - 1}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Falha ao buscar leads (${response.status}): ${await response.text()}`);
    }

    const page = await response.json();
    for (const lead of page) {
      if (EMAIL_PATTERN.test(lead.contato)) leads.push(lead);
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return leads;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    CAMPAIGN_SECRET,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
  } = process.env;

  if (!CAMPAIGN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('send-launch-campaign: variáveis de ambiente ausentes');
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token !== CAMPAIGN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let emailLeads;
  try {
    emailLeads = await fetchAllEmailLeads(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    console.error('send-launch-campaign: erro ao buscar leads', err);
    res.status(502).json({ error: 'Failed to fetch leads' });
    return;
  }

  if (req.query?.dryRun === 'true') {
    res.status(200).json({ ok: true, dryRun: true, totalEmails: emailLeads.length });
    return;
  }

  let sent = 0;
  const errors = [];

  for (let i = 0; i < emailLeads.length; i += BATCH_SIZE) {
    const chunk = emailLeads.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((lead) => ({
      from: RESEND_FROM_EMAIL,
      to: lead.contato,
      subject: 'O MudaJá está no ar! 🚀',
      html: `<p>Olá, ${escapeHtml(lead.nome.split(' ')[0])}!</p>
        <p>O MudaJá acabou de entrar no ar. Você foi uma das primeiras pessoas a se interessar — obrigado por acompanhar desde o começo.</p>`,
    }));

    try {
      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        errors.push({ batch: i / BATCH_SIZE, detail: await response.text() });
        continue;
      }

      sent += chunk.length;
    } catch (err) {
      errors.push({ batch: i / BATCH_SIZE, error: String(err) });
    }
  }

  res.status(errors.length ? 207 : 200).json({
    ok: errors.length === 0,
    sent,
    totalEmails: emailLeads.length,
    errors,
  });
};
