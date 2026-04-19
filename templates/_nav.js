/* Injects the shared left nav so we don't duplicate it in every template.
   Add <aside id="nav"></aside> to the page + set data-active on <body>. */
(function () {
  const NAV_HTML = `
    <div class="nav__head">
      <div class="nav__logo">AC</div>
      <div class="nav__ws">Acme · Core</div>
      <i class="iconbtn" data-i="chevUpDown" data-sz="14"></i>
    </div>

    <div class="nav__search">
      <i data-i="search" data-sz="14"></i>
      <span>Search or jump to</span>
      <kbd>⌘K</kbd>
    </div>

    <div class="nav__section">
      <a class="nav__item" data-nav="inbox" href="#">
        <i class="i" data-i="inbox" data-sz="15"></i><span>Inbox</span><span class="count">12</span>
      </a>
      <a class="nav__item" data-nav="home" href="#">
        <i class="i" data-i="home" data-sz="15"></i><span>My issues</span>
      </a>
      <a class="nav__item" data-nav="views" href="views.html">
        <i class="i" data-i="view" data-sz="15"></i><span>Views</span>
      </a>
      <a class="nav__item" data-nav="projects" href="projects.html">
        <i class="i" data-i="project" data-sz="15"></i><span>Projects</span>
      </a>
    </div>

    <div class="nav__group">
      <div class="nav__sub">
        <span>Workspace</span>
        <div class="actions"><i class="iconbtn" data-i="plus" data-sz="14"></i></div>
      </div>
      <a class="nav__item" data-nav="chat" href="chat.html"><i class="i" data-i="chat" data-sz="15"></i>Messages<span class="count">3</span></a>
      <a class="nav__item" data-nav="channel" href="channel.html"><i class="i" data-i="channel" data-sz="15"></i>Channels</a>
      <a class="nav__item" href="#"><i class="i" data-i="doc" data-sz="15"></i>Docs</a>
    </div>

    <div class="nav__group">
      <div class="nav__sub">
        <span>Team · Core</span>
        <div class="actions"><i class="iconbtn" data-i="plus" data-sz="14"></i></div>
      </div>
      <a class="nav__item" data-nav="table" href="table.html"><i class="i" data-i="rows" data-sz="15"></i>Work</a>
      <a class="nav__item" data-nav="board" href="board.html"><i class="i" data-i="board" data-sz="15"></i>Board</a>
      <a class="nav__item" href="#"><i class="i" data-i="timeline" data-sz="15"></i>Timeline</a>
      <a class="nav__item" href="#"><i class="i" data-i="doc" data-sz="15"></i>Docs</a>
    </div>

    <div class="nav__group">
      <div class="nav__sub"><span>Favourites</span></div>
      <a class="nav__item" href="#"><span class="dot" style="background:var(--lbl-4)"></span>Release 42</a>
      <a class="nav__item" href="#"><span class="dot" style="background:var(--lbl-2)"></span>Marketing launch</a>
    </div>

    <div class="nav__spacer"></div>

    <div class="nav__foot">
      <div class="avatar">DC</div>
      <div style="font-size:12.5px; line-height:1.25">
        <div style="font-weight:600">Declan</div>
        <div class="muted" style="font-size:11px">declan@cowen.co</div>
      </div>
      <i class="iconbtn" data-i="settings" data-sz="14" style="margin-left:auto"></i>
    </div>
  `;
  const el = document.getElementById('nav');
  if (el) {
    el.className = 'nav';
    el.innerHTML = NAV_HTML;
    const active = document.body.dataset.active;
    if (active) {
      const match = el.querySelector(`[data-nav="${active}"]`);
      if (match) match.classList.add('active');
    }
    window.__renderIcons && window.__renderIcons(el);
  }
})();
