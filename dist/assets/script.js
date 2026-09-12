import { trackEvent, trackConversion } from './analytics.js';

const config = window.MUDAJA_CONFIG || {};

const AUDIENCE_BY_TYPE = { cliente: 'client', motorista: 'driver', imprensa: 'press' };

// Carregado sob demanda (só quando um formulário é aberto/enviado) pra não
// travar o menu, os modais e as animações de entrada atrás de ~15 requests
// da CDN do Supabase logo no carregamento da página.
let supabasePromise;
function getSupabase() {
  if (!supabasePromise) {
    supabasePromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY));
  }
  return supabasePromise;
}

const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const mobileNav = document.querySelector('[data-mobile-nav]');
const dialog = document.querySelector('[data-dialog]');
const dialogContent = document.querySelector('[data-dialog-content]');

let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  header.classList.toggle('scrolled', scrollY > 24);

  const menuOpen = menuButton.getAttribute('aria-expanded') === 'true';
  if (!menuOpen) {
    const scrollingDown = scrollY > lastScrollY;
    header.classList.toggle('header-hidden', scrollingDown && scrollY > 120);
  }

  lastScrollY = scrollY;
}, { passive: true });

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  mobileNav.classList.toggle('open', !open);
});

mobileNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('open');
  });
});

const templates = {
  cliente: document.querySelector('#form-cliente'),
  motorista: document.querySelector('#form-motorista'),
  imprensa: document.querySelector('#form-imprensa'),
};

// Normaliza os campos de cada formulário para o formato da tabela "leads"
// (nome, email, telefone, cidade + o resto guardado em "extra").
function mapPayload(type, formData) {
  const data = Object.fromEntries(formData.entries());
  const email = data.email?.trim() || null;
  const telefone = data.telefone?.trim() || null;

  if (type === 'motorista') {
    return {
      tipo: 'motorista',
      nome: data.nome,
      email,
      telefone,
      cidade: data.cidade,
      extra: { veiculo: data.veiculo },
    };
  }

  if (type === 'imprensa') {
    return {
      tipo: 'imprensa',
      nome: data.nome,
      email,
      telefone,
      cidade: null,
      extra: { projeto: data.projeto, mensagem: data.mensagem },
    };
  }

  return {
    tipo: 'cliente',
    nome: data.nome,
    email,
    telefone,
    cidade: data.cidade,
    extra: null,
  };
}

function renderSuccess(type) {
  const audience = AUDIENCE_BY_TYPE[type] || type;
  const shareText = encodeURIComponent(
    'Acabei de entrar na lista do MudaJá \u{1F69A} — uma forma mais simples de organizar mudanças e fretes em João Pessoa. Também dá pra acompanhar: https://mudaja.vercel.app'
  );
  dialogContent.innerHTML = `
    <div class="success-state">
      <div>
        <span aria-hidden="true">✓</span>
        <h2>Interesse registrado!</h2>
        <p>Recebemos seus dados. Avisaremos por aqui assim que o MudaJá estiver no ar.</p>
        <div class="success-actions">
          <a class="button button-primary" href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" data-share-whatsapp>Compartilhar no WhatsApp <span aria-hidden="true">↗</span></a>
          <button class="button button-dark" type="button" data-success-close>Voltar para a página</button>
        </div>
      </div>
    </div>`;
  dialogContent.querySelector('[data-share-whatsapp]').addEventListener('click', () => {
    trackEvent('share_click', { audience, channel: 'whatsapp', location: 'success_modal' });
  });
  dialogContent.querySelector('[data-success-close]').addEventListener('click', closeLeadDialog);
}

function renderError(type) {
  dialogContent.innerHTML = `
    <div class="success-state is-error">
      <div>
        <span aria-hidden="true">!</span>
        <h2>Não deu para enviar agora.</h2>
        <p>Verifique sua conexão e tente novamente em instantes.</p>
        <button class="button button-dark" type="button" data-retry>Tentar de novo</button>
      </div>
    </div>`;
  dialogContent.querySelector('[data-retry]').addEventListener('click', () => openLeadDialog(type));
}

function openLeadDialog(type) {
  const template = templates[type];
  if (!template) return;
  const audience = AUDIENCE_BY_TYPE[type] || type;
  trackEvent('signup_started', { audience });
  getSupabase(); // começa a carregar em paralelo enquanto a pessoa preenche o formulário
  dialogContent.replaceChildren(template.content.cloneNode(true));
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  const firstInput = dialogContent.querySelector('input');
  window.setTimeout(() => firstInput?.focus(), 50);

  const form = dialogContent.querySelector('[data-lead-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const honeypot = form.querySelector('[name="website"]');
    if (honeypot && honeypot.value.trim()) {
      // Provável bot: finge sucesso, sem gravar lead nem enviar e-mails.
      renderSuccess(type);
      return;
    }

    const emailInput = form.querySelector('[name="email"]');
    const telefoneInput = form.querySelector('[name="telefone"]');
    if (emailInput && telefoneInput && !emailInput.value.trim() && !telefoneInput.value.trim()) {
      emailInput.setCustomValidity('Informe seu e-mail ou telefone.');
      emailInput.reportValidity();
      emailInput.addEventListener('input', () => emailInput.setCustomValidity(''), { once: true });
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const lead = mapPayload(type, new FormData(form));
    const supabase = await getSupabase();
    const { error } = await supabase.from('leads').insert(lead);

    if (error) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalLabel;
      trackEvent('signup_error', { audience });
      renderError(type);
      return;
    }

    // Notificação interna best-effort — não bloqueia a confirmação pro usuário.
    fetch('/api/notify-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    }).catch(() => {});

    trackConversion('signup_completed', { audience });
    renderSuccess(type);
  });
}

function closeLeadDialog() {
  dialog.close();
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-open-dialog]').forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset.openDialog;
    trackEvent('cta_click', {
      cta_name: button.dataset.ctaName || type,
      audience: AUDIENCE_BY_TYPE[type] || type,
      section: button.dataset.section || null,
    });
    openLeadDialog(type);
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    trackEvent('menu_click', {
      link_text: link.textContent.trim(),
      destination: link.getAttribute('href'),
    });
  });
});

document.querySelectorAll('[data-social]').forEach((link) => {
  link.addEventListener('click', () => {
    trackEvent(`${link.dataset.social}_click`, { location: link.dataset.location || null });
  });
});

document.querySelector('[data-close-dialog]').addEventListener('click', closeLeadDialog);
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeLeadDialog();
});
dialog.addEventListener('close', () => { document.body.style.overflow = ''; });

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

document.querySelectorAll('.faq-list details').forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    document.querySelectorAll('.faq-list details').forEach((other) => {
      if (other !== item) other.removeAttribute('open');
    });
  });
});

// Contador social — só aparece a partir de um número que faz o produto parecer
// tração real, não um número pequeno e desanimador.
const LEAD_COUNTER_MIN = 15;
const leadCounter = document.querySelector('[data-lead-counter]');
if (leadCounter) {
  fetch('/api/leads-count')
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || typeof data.count !== 'number' || data.count < LEAD_COUNTER_MIN) return;
      leadCounter.querySelector('[data-lead-count]').textContent = data.count.toLocaleString('pt-BR');
      leadCounter.hidden = false;
    })
    .catch(() => {});
}
