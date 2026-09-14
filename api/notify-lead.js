// Notifica a equipe por e-mail (Resend) a cada novo lead salvo no Supabase,
// e envia uma confirmação simples pra pessoa que se cadastrou (quando ela informa e-mail).
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

// "classificacao" vem do front-end só como estimativa pra dar destaque
// imediato no e-mail. O valor que fica gravado de verdade é recalculado
// pelo trigger do Supabase (supabase/schema.sql), que não depende do cliente.
const CLASSIFICACAO_LABELS = {
  prioritario: '\u{1F3AF} Lead PRIORITÁRIO — Grande João Pessoa',
  expansao: '\u{1F30E} Lead de expansão — fora da área inicial',
};

// Limite simples por IP (best-effort: reseta a cada cold start da função,
// não é compartilhado entre instâncias). Ainda assim barra abuso básico —
// alguém tentando disparar dezenas de e-mails em sequência pela mesma rota.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateLimitHits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const hit = rateLimitHits.get(ip);

  if (!hit || now - hit.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(ip, { count: 1, windowStart: now });
    return false;
  }

  hit.count += 1;
  if (hit.count > RATE_LIMIT_MAX) return true;

  return false;
}

const CONFIRMATION_COPY = {
  cliente: {
    subject: 'Recebemos seu interesse no MudaJá!',
    body: 'Vamos avisar você por aqui assim que o MudaJá estiver disponível na Grande João Pessoa.',
  },
  motorista: {
    subject: 'Recebemos seu cadastro de Motorista Fundador!',
    body: 'Em breve entraremos em contato com mais detalhes sobre os próximos passos do programa de Motoristas Fundadores.',
  },
  imprensa: {
    subject: 'Recebemos seu convite/contato!',
    body: 'Vamos analisar sua mensagem e retornar em breve para combinarmos a conversa.',
  },
};

async function sendEmail({ RESEND_API_KEY, from, to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Resend respondeu ${response.status}: ${await response.text()}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { RESEND_API_KEY, RESEND_FROM_EMAIL, TEAM_NOTIFY_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !TEAM_NOTIFY_EMAIL) {
    console.error('notify-lead: variáveis de ambiente ausentes');
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const { tipo, nome, email, telefone, cidade, extra, classificacao } = req.body || {};
  if (!tipo || !nome || (!email && !telefone)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const extraItems = extra && typeof extra === 'object'
    ? Object.entries(extra)
        .filter(([, value]) => value)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`)
        .join('')
    : '';

  const classificacaoLabel = CLASSIFICACAO_LABELS[classificacao];

  const teamHtml = `
    <h2>Novo lead — ${escapeHtml(TIPO_LABELS[tipo] || tipo)}</h2>
    ${classificacaoLabel ? `<p><strong>${classificacaoLabel}</strong></p>` : ''}
    <ul>
      <li><strong>Nome:</strong> ${escapeHtml(nome)}</li>
      ${email ? `<li><strong>E-mail:</strong> ${escapeHtml(email)}</li>` : ''}
      ${telefone ? `<li><strong>Telefone:</strong> ${escapeHtml(telefone)}</li>` : ''}
      ${cidade ? `<li><strong>Cidade:</strong> ${escapeHtml(cidade)}</li>` : ''}
      ${extraItems}
    </ul>
  `;

  try {
    await sendEmail({
      RESEND_API_KEY,
      from: RESEND_FROM_EMAIL,
      to: TEAM_NOTIFY_EMAIL,
      subject: `${classificacao === 'prioritario' ? '\u{1F3AF} ' : ''}Novo lead MudaJá — ${TIPO_LABELS[tipo] || tipo}: ${nome}`,
      html: teamHtml,
    });
  } catch (err) {
    console.error('notify-lead: erro ao notificar a equipe', err);
    res.status(502).json({ error: 'Failed to send notification' });
    return;
  }

  // Confirmação pra pessoa que se cadastrou — best-effort, não falha a resposta
  // se der errado (a equipe já foi notificada, que é o que importa de verdade).
  if (email) {
    const copy = CONFIRMATION_COPY[tipo] || CONFIRMATION_COPY.cliente;
    const confirmationHtml = `
      <p>Oi, ${escapeHtml(nome)}!</p>
      <p>${copy.body}</p>
      <p>Enquanto isso, acompanhe as novidades no Instagram <a href="https://www.instagram.com/mudaja.br">@mudaja.br</a>.</p>
      <p>— Equipe MudaJá</p>
    `;
    try {
      await sendEmail({
        RESEND_API_KEY,
        from: RESEND_FROM_EMAIL,
        to: email,
        subject: copy.subject,
        html: confirmationHtml,
      });
    } catch (err) {
      console.error('notify-lead: erro ao enviar confirmação para o lead', err);
    }
  }

  res.status(200).json({ ok: true });
};
