/* Renders a floating "Change brief" toggle + drawer.
   Reads HTML from <template id="brief"> on the page. */
(function () {
  const tpl = document.getElementById('brief');
  if (!tpl) return;

  const wrap = document.createElement('div');
  wrap.className = 'brief';
  wrap.innerHTML = `
    <button class="brief__toggle" aria-label="Show change brief">
      <span class="brief__dot"></span>
      Change brief
    </button>
    <aside class="brief__panel" aria-hidden="true">
      <header>
        <strong>Change brief</strong>
        <div style="display:flex; gap:6px; align-items:center">
          <button class="brief__copy" title="Copy as markdown">Copy</button>
          <button class="brief__close" aria-label="Close">✕</button>
        </div>
      </header>
      <div class="brief__body"></div>
    </aside>
  `;
  const body = wrap.querySelector('.brief__body');
  body.innerHTML = tpl.innerHTML;
  document.body.appendChild(wrap);

  const panel = wrap.querySelector('.brief__panel');
  const toggle = wrap.querySelector('.brief__toggle');
  const close = wrap.querySelector('.brief__close');
  const copy = wrap.querySelector('.brief__copy');

  const open = () => { panel.setAttribute('aria-hidden', 'false'); toggle.style.display = 'none'; };
  const shut = () => { panel.setAttribute('aria-hidden', 'true'); toggle.style.display = ''; };

  toggle.addEventListener('click', open);
  close.addEventListener('click', shut);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });

  copy.addEventListener('click', async () => {
    const txt = tpl.innerHTML
      .replace(/<\/?(strong|b)>/g, '**')
      .replace(/<\/?(em|i)>/g, '*')
      .replace(/<code>/g, '`').replace(/<\/code>/g, '`')
      .replace(/<li>/g, '- ').replace(/<\/li>/g, '\n')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    try { await navigator.clipboard.writeText(txt); copy.textContent = 'Copied'; setTimeout(() => copy.textContent = 'Copy', 1200); }
    catch { copy.textContent = '!'; }
  });
})();
