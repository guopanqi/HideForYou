// ==UserScript==
// @name         HideForYou
// @namespace    https://github.com/guopanqi
// @version      2.9.0
// @description  A cleaner X/Twitter experience on mobile and desktop browsers. Prioritize Following, hide For You and sidebar recommendations, and manage filters from the navigation menu.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @inject-into  content
// @updateURL    https://raw.githubusercontent.com/guopanqi/HideForYou/main/hide-for-you.meta.js
// @downloadURL  https://raw.githubusercontent.com/guopanqi/HideForYou/main/hide-for-you.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  if (document.getElementById('xclean-root')) return;

  const KEY = 'xclean-v2-settings';
  const defaults = {
    following: true, forYou: true, suggestions: true,
    trends: true, grok: true, premium: true,
    explore: false, metrics: false, sports: true, rightRecommendations: true, sidebarSearch: false, paused: false
  };
  const labels = {
    following: 'Prefer Following', forYou: 'Hide For You',
    suggestions: 'Hide Who to Follow', trends: 'Hide Trends',
    grok: 'Hide Grok', premium: 'Hide Premium promos',
    explore: 'Hide Explore', metrics: 'Hide engagement buttons',
    sports: 'Hide sports scorecards', rightRecommendations: 'Hide right-side recommendations',
    sidebarSearch: 'Hide right-side search'
  };
  let prefs = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved && typeof saved === 'object') prefs = { ...prefs, ...saved };
  } catch (_) {}
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
  };
  const normalize = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const onHome = () => location.pathname === '/home' || location.pathname === '/';
  const words = {
    forYou: ['for you', '为你推荐', '為你推薦', 'おすすめ'],
    following: ['following', '正在关注', '正在關注', 'フォロー中'],
    suggestions: ['who to follow', '推荐关注', '推薦關注', '推薦追蹤'],
    trends: ["what's happening", 'what’s happening', 'trends for you',
      '有什么新鲜事', '正在发生', '热门趋势', '熱門趨勢'],
    premium: ['subscribe to premium', '订阅 premium', '訂閱 premium']
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
    document.querySelectorAll('aside h2,[data-testid="sidebarColumn"] h2,[data-testid="cellInnerDiv"] h2')
      .forEach(h => {
        const s = normalize(h.textContent);
        const category = has(s, words.suggestions) ? 'suggestions'
          : has(s, words.trends) ? 'trends'
          : has(s, words.premium) ? 'premium' : null;
        if (!category) return;
        const box = h.closest('section,[data-testid="cellInnerDiv"]');
        if (box && !box.querySelector('[data-testid="tweet"]'))
          toggle(box, prefs[category]);
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
    // Sports scorecards: match a contained NFL/NBA/etc. module,
    // not the user's own posts or search results.
    document.querySelectorAll(
      '[data-testid="sidebarColumn"] h2,' +
      '[data-testid="sidebarColumn"] [role="heading"],' +
      'aside h2, aside [role="heading"]'
    ).forEach(heading => {
      if (!/^(NFL|NBA|MLB|NHL|NCAA|WNBA|MLS|Premier League)$/i.test(
        heading.textContent.trim())) return;
      let node = heading.parentElement;
      let candidate = null;
      for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) {
        if (node.matches('aside,[data-testid="sidebarColumn"]') ||
            node.querySelector('[data-testid="tweet"]')) break;
        const t = node.textContent || '';
        // A full scorecard has some details, not just its title.
        if (t.length >= 35 && t.length < 1800 &&
            node.querySelector('button,[role="button"]')) candidate = node;
        if (t.length >= 1800) break;
      }
      if (candidate && !candidate.querySelector('input[aria-label="Search query"], [data-testid="SearchBox_Search_Input"]')) toggle(candidate, prefs.sports);
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
      p{margin:0 0 12px;color:#b3c2cd;font-size:12px}
      .top{display:flex;justify-content:space-between;align-items:center}
      #close{border:0;color:#fff;background:transparent;font-size:24px;padding:0 4px}
      label{display:flex;align-items:center;justify-content:space-between;
        border-bottom:1px solid #ffffff18;padding:9px 0;gap:10px}
      input{width:19px;height:19px;accent-color:#82b7e7}
      .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
      .actions button{background:#283b4e;border:1px solid #5c7286;color:white;
        border-radius:8px;padding:10px 4px;font-size:12px}
      #pause{grid-column:span 2}
    </style>
    <div id="backdrop"></div>
    <div id="panel" role="dialog" aria-modal="true" aria-label="HideForYou settings">
      <div class="top"><h3>HideForYou · Settings</h3><button id="close" aria-label="Close settings">×</button></div>
      <p>Mobile & desktop · Saved in this browser · v2.9</p>
      <div id="options"></div>
      <div class="actions">
        <button id="focus">Focus mode</button>
        <button id="light">Light mode</button>
        <button id="pause">Pause filtering</button>
      </div>
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

  // Keep the entry inside X's navigation surfaces. Mobile X opens a
  // separate account drawer; never add a floating on-page launcher.
  function insertSettingsLink() {
    const selectors = [
      'nav[aria-label="Primary"]',
      'nav[aria-label="Primary navigation"]',
      'nav[aria-label="主要"]',
      '[data-testid="SideNav"]',
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar"]',
      '[role="dialog"] nav',
      '[role="menu"]'
    ];
    const targets = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(el => {
        if (el.closest('#xclean-root')) return;
        // Avoid adding the entry to the bottom mobile tab bar.
        if (el.matches('[data-testid="AppTabBar"]')) return;
        if (el.matches('[data-testid="SideNav_AccountSwitcher_Button"]')) {
          const parent = el.closest('nav,[role="menu"],[role="dialog"]');
          if (parent) targets.add(parent);
          return;
        }
        targets.add(el);
      });
    }
    // The mobile account drawer often has no stable data-testid.
    // Look for a visible panel containing account navigation items.
    document.querySelectorAll('[role="dialog"],[data-testid="sheetDialog"],aside').forEach(panel => {
      const links = [...panel.querySelectorAll('a[href]')];
      const paths = links.map(a => {
        try { return new URL(a.href).pathname; } catch (_) { return ''; }
      });
      if (paths.some(p => /^\/(profile|lists|bookmarks|settings)(\/|$)/.test(p))) {
        const nav = panel.querySelector('nav') || panel;
        targets.add(nav);
      }
    });
    for (const target of targets) {
      if (!target.isConnected || target.querySelector('[data-hideforyou-settings]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-hideforyou-settings', 'true');
      button.setAttribute('aria-label', 'HideForYou settings');
      button.style.cssText = 'display:flex;align-items:center;gap:12px;' +
        'width:100%;min-height:44px;padding:10px 14px;border:0;' +
        'border-radius:8px;background:transparent;color:inherit;' +
        'font:inherit;font-size:15px;text-align:left;cursor:pointer';
      button.textContent = '⚙  HideForYou settings';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      });
      target.append(button);
    }
  }
  function checkHash() {
    if (location.hash === '#xclean-settings') setOpen(true);
  }
  function render() {
    const container = shadow.getElementById('options');
    container.replaceChildren();
    Object.entries(labels).forEach(([key,label]) => {
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = label;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!prefs[key];
      checkbox.disabled = prefs.paused;
      checkbox.addEventListener('change', () => {
        prefs[key] = checkbox.checked;
        save(); render(); apply();
      });
      row.append(name, checkbox);
      container.append(row);
    });
    shadow.getElementById('pause').textContent = prefs.paused ? 'Resume filtering' : 'Pause filtering';
  }
  shadow.getElementById('focus').addEventListener('click', () => {
    prefs = {...defaults, explore:true, metrics:false};
    save(); render(); apply();
  });
  shadow.getElementById('light').addEventListener('click', () => {
    prefs = {...defaults, suggestions:false, trends:false, grok:false, premium:false};
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