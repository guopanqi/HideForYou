// ==UserScript==
// @name         HideForYou
// @namespace    https://github.com/guopanqi
// @version      3.2.0
// @description  A cleaner X/Twitter experience on mobile and desktop browsers. Prioritize Following, hide For You and sidebar recommendations, and manage filters from the navigation menu.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @license      MIT
// @homepageURL  https://github.com/guopanqi/HideForYou
// @supportURL   https://github.com/guopanqi/HideForYou/issues
// @grant        none
// @inject-into  content
// @updateURL    https://raw.githubusercontent.com/guopanqi/HideForYou/main/hide-for-you.meta.js
// @downloadURL  https://raw.githubusercontent.com/guopanqi/HideForYou/main/hide-for-you.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  if (document.getElementById('xclean-root')) return;

  const KEY = 'hideforyou-settings-v3';
  const FOLLOWING_ONLY = Object.freeze({
    following: true, forYou: true, rightRecommendations: true,
    sidebarSearch: false, grok: false, premium: false,
    explore: false, metrics: false
  });
  const FOCUS = Object.freeze({
    ...FOLLOWING_ONLY, grok: true, premium: true, explore: true
  });
  const keys = Object.keys(FOLLOWING_ONLY);
  const labels = {
    following: 'Prefer Following', forYou: 'Hide For You',
    rightRecommendations: 'Hide recommendations',
    sidebarSearch: 'Hide search', grok: 'Hide Grok',
    premium: 'Hide Premium promotions', explore: 'Hide Explore',
    metrics: 'Hide engagement buttons'
  };
  let prefs = { ...FOLLOWING_ONLY, paused: false };
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || 'null');
    const legacy = JSON.parse(localStorage.getItem('xclean-v2-settings') || 'null');
    const stored = current && typeof current === 'object' ? current :
      legacy && typeof legacy === 'object' ? legacy : null;
    if (stored) for (const key of [...keys, 'paused']) {
      if (typeof stored[key] === 'boolean') prefs[key] = stored[key];
    }
  } catch (_) {}
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
  };
  const presetName = () => {
    if (keys.every(k => prefs[k] === FOLLOWING_ONLY[k])) return 'following';
    if (keys.every(k => prefs[k] === FOCUS[k])) return 'focus';
    return 'custom';
  };
  const normalize = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const onHome = () => location.pathname === '/home' || location.pathname === '/';
  const words = {
    forYou: ['for you', '为你推荐', '為你推薦', 'おすすめ'],
    following: ['following', '正在关注', '正在關注', 'フォロー中'],
  };
  const exact = (s, list) => list.includes(normalize(s));
  const has = (s, list) => list.some(v => normalize(s).includes(v));

  const css = document.createElement('style');
  css.textContent = '[data-xclean-hidden="true"]{display:none!important}';
  (document.head || document.documentElement).append(css);
  function toggle(el, hidden) {
    if (!el) return;
    if (hidden && el.getAttribute('data-xclean-hidden') !== 'true')
      el.setAttribute('data-xclean-hidden', 'true');
    if (!hidden && el.hasAttribute('data-xclean-hidden'))
      el.removeAttribute('data-xclean-hidden');
  }
  let lastSwitch = 0;
  function apply() {
    if (prefs.paused) {
      document.querySelectorAll('[data-xclean-hidden]').forEach(el => toggle(el, false));
      return;
    }
    // X uses different top-bar containers on desktop and mobile.
    // On iOS the tabs usually sit in [data-testid="TopNavBar"].
    if (onHome()) {
      const bars = document.querySelectorAll(
        '[data-testid="TopNavBar"] nav [role="tablist"],' +
        '[data-testid="primaryColumn"] nav [role="tablist"],' +
        'main nav [role="tablist"],' +
        'nav [role="tablist"]'
      );
      let matched = false;
      for (const bar of bars) {
        const cells = [...bar.children];
        if (cells.length < 2) continue;
        const forYou = cells[0].querySelector('[role="tab"]');
        const following = cells[1].querySelector('[role="tab"]');
        if (!forYou || !following) continue;
        // Confirm the pair by labels if present, so other navigation tabs
        // (e.g. notifications or profile) are never modified.
        const first = normalize(forYou.textContent);
        const second = normalize(following.textContent);
        const labelsMatch = exact(first, words.forYou) &&
          exact(second, words.following);
        if (!labelsMatch) continue;
        matched = true;
        const selected = forYou.getAttribute('aria-selected') === 'true';
        if (prefs.following && selected && Date.now() - lastSwitch > 1200) {
          lastSwitch = Date.now();
          following.click();
        }
        // Hide the tab itself rather than the whole home navigation.
        toggle(forYou, prefs.forYou);
        // The outer cell may reserve 50% width even when the tab is hidden.
        if (prefs.forYou) {
          cells[0].style.setProperty('flex-grow', '0');
          cells[0].style.setProperty('flex-shrink', '1');
        } else {
          cells[0].style.removeProperty('flex-grow');
          cells[0].style.removeProperty('flex-shrink');
        }
      }
      if (!matched) {
        // Conservative fallback for alternative mobile layouts.
        const selectors = [
          '[data-testid="TopNavBar"] [role="tab"]',
          'nav [role="tablist"] [role="tab"]',
          'main [role="tablist"] [role="tab"]'
        ].join(',');
        document.querySelectorAll(selectors).forEach(el => {
          const isForYou = exact(el.textContent, words.forYou);
          const container = el.closest('[role="tablist"]');
          const hasFollowing = container && [...container.querySelectorAll('[role="tab"]')]
            .some(x => exact(x.textContent, words.following));
          if (isForYou && hasFollowing) {
            const next = [...container.querySelectorAll('[role="tab"]')]
              .find(x => exact(x.textContent, words.following));
            if (prefs.following && el.getAttribute('aria-selected') === 'true' &&
                Date.now() - lastSwitch > 1200) {
              lastSwitch = Date.now();
              next.click();
            }
            toggle(el, prefs.forYou);
            matched = true;
          }
        });
      }
      root.dataset.homeTabs = matched ? 'found' : 'missing';
    }
    document.querySelectorAll('nav a[href],header a[href]').forEach(a => {
      let path = '';
      try { path = new URL(a.href).pathname; } catch (_) {}
      const hide = (prefs.grok && (/^\/i\/grok/.test(path) || path === '/grok')) ||
        (prefs.premium && (path === '/premium' || /^\/i\/premium/.test(path))) ||
        (prefs.explore && path === '/explore');
      toggle(a, hide);
    });
    // Manage the search and recommendations independently. Never hide
    // an ancestor of the search field as part of recommendations filtering.
    document.querySelectorAll('[data-testid="sidebarColumn"]').forEach(sidebar => {
      const search = sidebar.querySelector(
        '[data-testid="SearchBox_Search_Input"],' +
        'input[aria-label="Search query"],' +
        'input[aria-label="Search"],' +
        'form[role="search"] input, [role="search"] input'
      );
      const searchForm = search && (
        search.closest('form,[role="search"]') || search.parentElement
      );
      // Restore nodes the earlier version may have marked when necessary.
      if (search) {
        for (let n = search; n && n !== sidebar; n = n.parentElement) {
          toggle(n, false);
        }
      }
      // Hide only the search's own wrapper if explicitly requested.
      if (searchForm) {
        const searchWrapper = searchForm.parentElement &&
          searchForm.parentElement !== sidebar &&
          searchForm.parentElement.querySelectorAll('input').length === 1 &&
          searchForm.parentElement.textContent.trim().length < 100
            ? searchForm.parentElement : searchForm;
        toggle(searchWrapper, prefs.sidebarSearch);
      }
      if (search) {
        // At every level of the search's ancestor chain, remove the
        // *other* branches. This keeps the full search hierarchy intact.
        for (let current = search; current && current.parentElement &&
             current !== sidebar; current = current.parentElement) {
          const parent = current.parentElement;
          if (!sidebar.contains(parent)) break;
          for (const sibling of parent.children) {
            if (sibling === current || sibling.contains(search)) continue;
            // Never hide a navigation or extra input/control area.
            if (sibling.querySelector('input,form[role="search"]')) continue;
            const looksLikeContent = sibling.textContent.trim().length > 15 ||
              sibling.querySelector('section,[data-testid="trend"],[data-testid="UserCell"]');
            if (looksLikeContent) toggle(sibling, prefs.rightRecommendations);
          }
        }
      }
      // A missing search box must not cause the whole column to vanish.
      sidebar.querySelectorAll(
        '[data-testid="trend"],[data-testid="newsSidebar"],' +
        '[aria-label="Timeline: Trending now"]'
      ).forEach(el => {
        const section = el.closest('section,[data-testid="cellInnerDiv"]');
        if (section && (!search || !section.contains(search)) &&
            !section.querySelector('[data-testid="tweet"]')) {
          toggle(section, prefs.rightRecommendations);
        }
      });
    });
    document.querySelectorAll('[data-testid="like"],[data-testid="unlike"],[data-testid="retweet"],[data-testid="unretweet"]')
      .forEach(el => toggle(el, prefs.metrics));
  }

  // Settings are accessible from X navigation, not from a floating button.
  const root = document.createElement('div');
  root.id = 'xclean-root';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none';
  const shadow = root.attachShadow({ mode:'open' });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box}
      button{cursor:pointer;font:inherit}
      #backdrop{position:absolute;inset:0;background:#0008;pointer-events:auto}
      #panel{position:absolute;right:12px;top:50%;transform:translateY(-50%);
        width:min(350px,calc(100vw - 24px));max-height:85vh;overflow:auto;
        background:#17212e;color:white;border:1px solid #485a6e;
        border-radius:16px;padding:17px;pointer-events:auto;
        font:14px -apple-system,BlinkMacSystemFont,sans-serif;
        box-shadow:0 8px 32px #0008}
      h3{margin:0 0 4px;font-size:17px}
      .group-heading{margin:17px 0 3px;color:#aabdc9;font-size:11px;
        font-weight:700;text-transform:uppercase;letter-spacing:.09em}
      #options section:first-child .group-heading{margin-top:8px}
      p{margin:0 0 12px;color:#b3c2cd;font-size:12px}
      .top{display:flex;justify-content:space-between;align-items:center}
      #close{border:0;color:#fff;background:transparent;font-size:24px;padding:0 4px}
      label{display:flex;align-items:center;justify-content:space-between;
        border-bottom:1px solid #ffffff18;padding:9px 0;gap:10px}
      input{width:19px;height:19px;accent-color:#82b7e7}
      .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
      .actions button.active{border-color:#9acbf1;background:#355572}
      .mode-status{color:#aebeca;font-size:12px;margin:8px 0}
      .group-note{font-size:11px;color:#93a6b6;margin:0 0 6px}
      .actions button{background:#283b4e;border:1px solid #5c7286;color:white;
        border-radius:8px;padding:10px 4px;font-size:12px}
      #pause{grid-column:span 2}
    </style>
    <div id="backdrop"></div>
    <div id="panel" role="dialog" aria-modal="true" aria-label="HideForYou settings">
      <div class="top"><h3>HideForYou · Settings</h3><button id="close" aria-label="Close settings">×</button></div>
      <p>Mobile & desktop · Saved in this browser · v3.2</p>
      <div id="options"></div>
      <div class="actions">
        <button id="light" type="button">Following Only</button>
        <button id="focus" type="button">Focus</button>
      </div>
      <div id="mode-status" class="mode-status"></div>
      <div class="actions"><button id="pause" type="button">Pause filtering</button></div>
    </div>`;

  let open = false;
  const setOpen = value => {
    open = value;
    root.style.display = open ? 'block' : 'none';
    if (open) render();
  };
  shadow.getElementById('close').addEventListener('click', () => setOpen(false));
  shadow.getElementById('backdrop').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false);
  });

  // Keep HideForYou in the same vertical menu list, immediately below
  // the native Settings and privacy row. Never inject into the bottom tab bar.
  function insertSettingsLink() {
    document.querySelectorAll('[data-hideforyou-settings]').forEach(el => {
      if (el.getAttribute('data-hideforyou-version') !== '3.1') el.remove();
    });

    const isSettings = el => {
      if (el.closest('#xclean-root,[data-testid="AppTabBar"],[role="tablist"]')) return false;
      if (el.closest('[data-hideforyou-settings]')) return false;
      const label = normalize(el.textContent);
      let pathname = '';
      if (el.tagName === 'A') {
        try { pathname = new URL(el.href).pathname; } catch (_) {}
      }
      return pathname === '/settings' || pathname === '/settings/' ||
        /^(settings and privacy|settings & privacy|设置和隐私|設定和隱私|設定與隱私)$/.test(label);
    };

    for (const original of document.querySelectorAll(
      'a[href], [role="menuitem"], [role="button"], button'
    )) {
      if (!isSettings(original) || !original.parentElement) continue;
      const parent = original.parentElement;
      if (parent.querySelector(':scope > [data-hideforyou-settings]')) continue;
      const clone = original.cloneNode(true);
      clone.removeAttribute('href');
      clone.removeAttribute('aria-expanded');
      clone.removeAttribute('aria-controls');
      clone.removeAttribute('id');
      clone.removeAttribute('data-testid');
      clone.setAttribute('data-hideforyou-settings', 'true');
      clone.setAttribute('data-hideforyou-version', '3.1');
      clone.setAttribute('aria-label', 'HideForYou settings');
      clone.setAttribute('role', 'button');
      clone.setAttribute('tabindex', '0');
      clone.querySelectorAll('[id],[href],[data-testid]').forEach(child => {
        child.removeAttribute('id');
        child.removeAttribute('href');
        child.removeAttribute('data-testid');
      });
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let node, replaced = false;
      while ((node = walker.nextNode())) {
        const value = node.nodeValue.trim();
        if (value && /settings|设置|設定/i.test(value)) {
          node.nodeValue = node.nodeValue.replace(value, 'HideForYou settings');
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        const label = document.createElement('span');
        label.textContent = 'HideForYou settings';
        clone.append(label);
      }
      const openSettings = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        setOpen(true);
      };
      clone.addEventListener('click', openSettings, true);
      clone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') openSettings(event);
      }, true);

      // Keep native typography and icon, but enforce a vertical full-width
      // layout instead of placing the cloned entry into a second column.
      parent.setAttribute('data-hideforyou-menu-list', 'true');
      parent.style.setProperty('display', 'flex', 'important');
      parent.style.setProperty('flex-direction', 'column', 'important');
      parent.style.setProperty('align-items', 'stretch', 'important');
      parent.style.setProperty('flex-wrap', 'nowrap', 'important');
      for (const row of [original, clone]) {
        row.style.setProperty('width', '100%', 'important');
        row.style.setProperty('max-width', '100%', 'important');
        row.style.setProperty('flex', '0 0 auto', 'important');
        row.style.setProperty('box-sizing', 'border-box', 'important');
      }
      original.insertAdjacentElement('afterend', clone);
    }
  }
  function checkHash() {
    if (location.hash === '#xclean-settings') setOpen(true);
  }
  const groups = [
    { title: 'Timeline', note: 'Mobile & desktop', keys: ['following', 'forYou'] },
    { title: 'Right sidebar', note: 'Desktop browser', keys: ['rightRecommendations', 'sidebarSearch'] },
    { title: 'Navigation', note: 'Mobile & desktop', keys: ['grok', 'premium', 'explore'] },
    { title: 'Appearance', note: 'Mobile & desktop', keys: ['metrics'] }
  ];
  function render() {
    const container = shadow.getElementById('options');
    container.replaceChildren();
    for (const group of groups) {
      const section = document.createElement('section');
      const heading = document.createElement('h4');
      heading.textContent = group.title;
      heading.className = 'group-heading';
      section.append(heading);
      const note = document.createElement('p');
      note.className = 'group-note';
      note.textContent = group.note;
      section.append(note);
      for (const key of group.keys) {
        const row = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = labels[key];
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!prefs[key];
        checkbox.disabled = prefs.paused;
        checkbox.addEventListener('change', () => {
          prefs[key] = checkbox.checked;
          save(); render(); apply();
        });
        row.append(name, checkbox);
        section.append(row);
      }
      container.append(section);
    }
    const mode = presetName();
    for (const [id, value] of [['light','following'],['focus','focus']]) {
      const button = shadow.getElementById(id);
      button.classList.toggle('active', mode === value);
      button.setAttribute('aria-pressed', String(mode === value));
    }
    shadow.getElementById('mode-status').textContent =
      mode === 'custom' ? 'Custom settings' :
      mode === 'focus' ? 'Focus · Fewer distractions' :
      'Following Only · No algorithmic recommendations';
    shadow.getElementById('pause').textContent = prefs.paused ? 'Resume filtering' : 'Pause filtering';
  }
  shadow.getElementById('focus').addEventListener('click', () => {
    prefs = { ...FOCUS, paused: false };
    save(); render(); apply();
  });
  shadow.getElementById('light').addEventListener('click', () => {
    prefs = { ...FOLLOWING_ONLY, paused: false };
    save(); render(); apply();
  });
  shadow.getElementById('pause').addEventListener('click', () => {
    prefs.paused = !prefs.paused;
    save(); render(); apply();
  });
  function mount() {
    if (document.body && !root.isConnected) document.body.append(root);
    insertSettingsLink();
  }
  render();
  mount();
  let queued = false;
  const observer = new MutationObserver(() => {
    mount();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {queued = false; apply();});
  });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener('popstate', apply);
  window.addEventListener('pageshow', apply);
  window.addEventListener('hashchange', checkHash);
  checkHash();
  apply();
})();