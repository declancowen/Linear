/* Tiny inline-SVG icon registry. Usage: <i data-i="search"></i> */
(function () {
  const paths = {
    // navigation / chrome
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    chevRight: '<path d="m9 6 6 6-6 6"/>',
    chevLeft: '<path d="m15 6-6 6 6 6"/>',
    chevUpDown: '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
    more: '<circle cx="5" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="19" cy="12" r="1.25"/>',
    moreV: '<circle cx="12" cy="5" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="12" cy="19" r="1.25"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    sort: '<path d="M7 5v14m0 0-3-3m3 3 3-3M17 19V5m0 0-3 3m3-3 3 3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',

    // layout
    rows: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>',
    board: '<rect x="3" y="3" width="6" height="18" rx="1.5"/><rect x="11" y="3" width="6" height="14" rx="1.5"/><rect x="19" y="3" width="2" height="10" rx="1"/>',
    timeline: '<path d="M4 7h16M4 12h10M4 17h13"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',

    // objects
    home: '<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7z"/>',
    project: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    view: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M14 20c.3-2 1.5-3.5 3-3.5s2.7 1.5 3 3.5"/>',
    chat: '<path d="M21 11a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z"/>',
    channel: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    flag: '<path d="M4 21V4h12l-2 4 2 4H4"/>',
    tag: '<path d="M20.6 12 12 20.6a1 1 0 0 1-1.4 0L3 13V4a1 1 0 0 1 1-1h9z"/><circle cx="8" cy="8" r="1.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    paperclip: '<path d="m21 12-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5L10 18a2 2 0 0 1-3-3l7-7"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1.5 1.5 2.8 2 4 2s2.5-.5 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
    bell: '<path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5c-.8.2-1.5.8-1.5 1.5V14"/><circle cx="12" cy="17.5" r=".8" fill="currentColor"/>',

    // status / task
    check: '<path d="m5 12 5 5 9-11"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    halfCircle: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    quarterCircle: '<circle cx="12" cy="12" r="8"/><path d="M12 12 12 4 A8 8 0 0 1 20 12 Z" fill="currentColor"/>',
    dashedCircle: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
    doubleCheck: '<path d="m2 12 5 5 6-7"/><path d="m11 12 5 5 7-9"/>',
    priority: '<path d="M4 20V4M4 20h4M4 13h7M4 6h10"/>',
    dueDate: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m10 16 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',

    // entities
    caretDown: '<path d="m6 9 6 6 6-6" fill="currentColor" stroke="none"/>',
    caretRight: '<path d="m9 6 6 6-6 6" fill="currentColor" stroke="none"/>',
    grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    subtask: '<path d="M5 5v8a3 3 0 0 0 3 3h10M14 12l4 4-4 4"/>',
    hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    star: '<path d="M12 3l2.7 6 6.3.5-4.8 4.2 1.5 6.3L12 17l-5.7 3 1.5-6.3L3 9.5 9.3 9z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M10 5h8M6 19h8M14 5 10 19"/>',
    listBullet: '<circle cx="5" cy="7" r="1.3" fill="currentColor"/><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="5" cy="17" r="1.3" fill="currentColor"/><path d="M10 7h11M10 12h11M10 17h11"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5"/>',
    flame: '<path d="M12 3s5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6s1-2 3-4zM9 17a3 3 0 0 0 6 0c0-2-3-3-3-5"/>',
  };

  function renderAll(root = document) {
    root.querySelectorAll('i[data-i]').forEach((el) => {
      const key = el.getAttribute('data-i');
      const body = paths[key];
      if (!body) return;
      const sz = el.getAttribute('data-sz') || 14;
      const sw = el.getAttribute('data-sw') || 1.6;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
      el.classList.add('i');
    });
  }
  window.__renderIcons = renderAll;
  if (document.readyState !== 'loading') renderAll();
  else document.addEventListener('DOMContentLoaded', () => renderAll());
})();
