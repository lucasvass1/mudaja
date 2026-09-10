// Camada centralizada de Analytics (GA4).
// Nenhum componente da Landing Page deve chamar window.gtag diretamente —
// tudo passa por aqui, para que uma falha do GA4 nunca quebre a página.

function hasGtag() {
  return typeof window.gtag === 'function';
}

export function trackEvent(eventName, params = {}) {
  try {
    if (!hasGtag()) return;
    window.gtag('event', eventName, params);
  } catch (err) {
    // Analytics não pode quebrar a Landing Page.
  }
}

export function trackPageView(pagePath) {
  trackEvent('page_view', pagePath ? { page_path: pagePath } : {});
}

export function trackConversion(eventName, params = {}) {
  trackEvent(eventName, params);
}
