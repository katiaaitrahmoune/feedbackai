(() => {
  'use strict';

  const API = '/api/admin';
  const TOKEN_KEY = 'fa_admin_token';
  const state = {
    data: null,
    tab: 'overview',
    filters: { q: '', sentiment: '', category: '', priority: '' },
    riskLevel: '',
    openId: null,
  };

  // ---------- tiny DOM helpers (no innerHTML => no XSS from customer text) ----------
  const $ = (sel) => document.querySelector(sel);

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'width') node.style.width = v; // CSSOM is allowed by the CSP, style="" attributes are not
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const c of children) if (c) node.append(c.nodeType ? c : document.createTextNode(String(c)));
    return node;
  }

  const pretty = (code) => (code ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ') : '—');
  const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const fmtDay = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const sentimentBadge = (s) => el('span', { class: `badge ${s ? 'b-' + s.toLowerCase() : 'b-none'}` }, s ? pretty(s) : 'Pending');
  const priorityBadge = (p) => el('span', { class: `badge ${p ? 'b-' + p.toLowerCase() : 'b-none'}` }, p ? pretty(p) : '—');
  const levelBadge = (l) => el('span', { class: `badge ${l === 'HIGH' ? 'b-urgent' : 'b-medium'}` }, l === 'HIGH' ? 'High risk' : 'Medium risk');

  // ---------- API ----------
  async function api(path, opts = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const res = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') {
      showLogin('Your session expired, please sign in again.');
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(body.details ? body.details.join(', ') : body.error || `Error ${res.status}`);
    return body;
  }

  // ---------- views ----------
  function showLogin(message) {
    sessionStorage.removeItem(TOKEN_KEY);
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    const err = $('#login-error');
    err.hidden = !message;
    err.textContent = message || '';
  }

  function showApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
  }

  async function loadDashboard() {
    const content = $('#content');
    if (!state.data) content.replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
    try {
      state.data = await api('/dashboard');
    } catch (e) {
      if (e.message !== 'Unauthorized') content.replaceChildren(el('p', { class: 'error' }, 'Could not load data: ' + e.message));
      return;
    }
    $('#company').textContent = state.data.company ? '· ' + state.data.company.name : '';
    render();
    if (state.openId) openFeedback(state.openId, true);
  }

  function render() {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === state.tab);
    const view = { overview: renderOverview, feedbacks: renderFeedbacks, risk: renderRisk }[state.tab];
    $('#content').replaceChildren(...view());
  }

  // ---------- OVERVIEW ----------
  const kpi = (label, value, sub, alert) =>
    el('div', { class: `card kpi${alert ? ' alert' : ''}` },
      el('div', { class: 'label' }, label), el('div', { class: 'value' }, value), el('div', { class: 'sub' }, sub));

  function barRow(name, value, max, cls = '') {
    return el('div', { class: 'bar-row' },
      el('span', { class: 'name', title: name }, name),
      el('div', { class: 'track' }, el('div', { class: `fill ${cls}`, width: (max ? (value / max) * 100 : 0) + '%' })),
      el('span', { class: 'val' }, value));
  }

  function trendChart(trend) {
    const W = 600, H = 150, pad = 20;
    const max = Math.max(1, ...trend.map((d) => d.total));
    const step = W / trend.length;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H + pad}`, role: 'img', 'aria-label': 'Feedbacks per day, last 30 days' });
    trend.forEach((d, i) => {
      const h = (d.total / max) * (H - 6);
      const hn = (d.negative / max) * (H - 6);
      const x = i * step + 3;
      const w = step - 6;
      root.append(
        svg('g', {},
          svg('title', {}, `${fmtDay(d.date)}: ${d.total} feedback(s), ${d.negative} negative`),
          svg('rect', { class: 'bar-total', x, y: H - h, width: w, height: Math.max(h, d.total ? 2 : 0), rx: 2 }),
          svg('rect', { class: 'bar-neg', x, y: H - hn, width: w, height: hn, rx: 2 })));
    });
    [0, 14, 29].forEach((i) => {
      root.append(svg('text', { class: 'axis', x: i * step + step / 2, y: H + 14, 'text-anchor': i === 0 ? 'start' : i === 29 ? 'end' : 'middle' }, fmtDay(trend[i].date)));
    });
    return root;
  }

  function renderOverview() {
    const { stats: s, atRisk } = state.data;
    const delta = s.last7Days - s.previous7Days;
    const deltaText = s.previous7Days || s.last7Days
      ? `${s.last7Days} in the last 7 days (${delta >= 0 ? '+' : ''}${delta} vs previous week)`
      : 'No feedback in the last 14 days';
    const pct = (n) => (s.analyzed ? Math.round((n / s.analyzed) * 100) : 0);
    const highRisk = atRisk.filter((c) => c.level === 'HIGH').length;
    const maxCat = Math.max(1, ...s.byCategory.map((c) => c.count));
    const maxPri = Math.max(1, ...Object.values(s.byPriority));

    const sentimentRows = [
      ['POSITIVE', 'seg-pos'], ['NEUTRAL', 'seg-neu'], ['NEGATIVE', 'seg-neg'],
    ];

    return [
      el('div', { class: 'page-head' }, el('div', {}, el('h1', {}, 'Overview'), el('p', { class: 'muted' }, 'Customer feedback insights, sentiment, categories and priorities.'))),
      el('div', { class: 'kpis' },
        kpi('Total feedbacks', s.total, deltaText),
        kpi('Negative rate', s.negativeRate + '%', `${s.bySentiment.NEGATIVE} of ${s.analyzed} analyzed`, s.negativeRate >= 50),
        kpi('High + urgent', s.highOrUrgent, 'Need quick attention', s.highOrUrgent > 0),
        kpi('Customers at risk', atRisk.length, `${highRisk} high risk · ${s.uniqueCustomers} customers total`, highRisk > 0),
        kpi('Needs human', s.needsHuman, `${s.pending} pending analysis · ${s.emailsSent} emails sent`)),
      el('div', { class: 'grid-2' },
        el('section', { class: 'card panel' }, el('h2', {}, 'Sentiment'),
          el('div', { class: 'stack' }, sentimentRows.map(([k, cls]) => el('div', { class: cls, width: pct(s.bySentiment[k]) + '%' }))),
          el('div', { class: 'legend' }, sentimentRows.map(([k, cls]) =>
            el('div', { class: 'item' }, el('span', { class: `dot ${cls}` }), pretty(k), el('span', { class: 'count' }, `${s.bySentiment[k]} · ${pct(s.bySentiment[k])}%`))))),
        el('section', { class: 'card panel' }, el('h2', {}, 'Priority'),
          ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => barRow(pretty(p), s.byPriority[p], maxPri, p.toLowerCase())))),
      el('div', { class: 'grid-2' },
        el('section', { class: 'card panel' }, el('h2', {}, 'Categories'),
          s.byCategory.length ? s.byCategory.slice(0, 12).map((c) => barRow(pretty(c.key), c.count, maxCat)) : el('p', { class: 'muted' }, 'No analyzed feedback yet.')),
        el('section', { class: 'card panel chart' }, el('h2', {}, 'Last 30 days'),
          trendChart(s.trend),
          el('p', { class: 'muted small' }, 'Light bars: all feedbacks · red: negative'))),
      el('section', { class: 'card' },
        el('div', { class: 'panel', }, el('div', { class: 'page-head' }, el('h2', {}, 'Most at-risk customers'),
          el('button', { class: 'btn', type: 'button', onclick: () => { state.tab = 'risk'; render(); } }, 'View all'))),
        riskTable(atRisk.slice(0, 5))),
    ];
  }

  // ---------- FEEDBACKS ----------
  function filteredFeedbacks() {
    const { q, sentiment, category, priority } = state.filters;
    const needle = q.trim().toLowerCase();
    return state.data.feedbacks.filter((f) =>
      (!sentiment || f.sentiment === sentiment) &&
      (!category || f.category === category) &&
      (!priority || f.priority === priority) &&
      (!needle || [f.customerName, f.customerEmail, f.reason, f.mainIssue].some((v) => (v || '').toLowerCase().includes(needle))));
  }

  function select(name, options, value, onChange) {
    const node = el('select', { 'aria-label': name, onchange: (e) => onChange(e.target.value) },
      el('option', { value: '' }, `All ${name.toLowerCase()}`),
      options.map(([v, label]) => el('option', { value: v }, label)));
    node.value = value;
    return node;
  }

  function renderFeedbacks() {
    const cats = state.data.stats.byCategory.map((c) => [c.key, pretty(c.key)]);
    const tableHost = el('div', { class: 'table-wrap' });
    const countHost = el('div', { class: 'count-label' });

    const draw = () => {
      const rows = filteredFeedbacks();
      countHost.textContent = `${rows.length} of ${state.data.feedbacks.length} feedbacks`;
      tableHost.replaceChildren(rows.length
        ? el('table', {},
          el('thead', {}, el('tr', {}, ['Date', 'Customer', 'Main issue', 'Category', 'Sentiment', 'Priority', 'Status'].map((h) => el('th', {}, h)))),
          el('tbody', {}, rows.map((f) =>
            el('tr', { class: 'clickable', tabindex: '0', onclick: () => openFeedback(f.id), onkeydown: (e) => { if (e.key === 'Enter') openFeedback(f.id); } },
              el('td', { class: 'small muted' }, fmtDate(f.createdAt)),
              el('td', {}, el('div', { class: 'name' }, f.customerName), el('div', { class: 'small muted' }, f.customerEmail)),
              el('td', { class: 'issue' }, f.mainIssue || el('span', { class: 'muted' }, 'Not analyzed yet')),
              el('td', {}, f.category ? el('span', { class: 'badge b-cat' }, pretty(f.category)) : '—'),
              el('td', {}, sentimentBadge(f.sentiment)),
              el('td', {}, priorityBadge(f.priority)),
              el('td', {}, f.needsHuman ? el('span', { class: 'badge b-high' }, 'Needs human') : el('span', { class: 'small muted' }, pretty(f.status)))))))
        : el('div', { class: 'empty' }, 'No feedback matches these filters.'));
    };

    const search = el('input', { type: 'search', placeholder: 'Search name, email, message…', 'aria-label': 'Search', value: state.filters.q,
      oninput: (e) => { state.filters.q = e.target.value; draw(); } });

    draw();
    return [
      el('div', { class: 'page-head' }, el('div', {}, el('h1', {}, 'Feedbacks'), el('p', { class: 'muted' }, 'Every customer feedback with its AI analysis. Click a row for details.'))),
      el('section', { class: 'card' },
        el('div', { class: 'filters' }, search,
          select('Sentiments', ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].map((v) => [v, pretty(v)]), state.filters.sentiment, (v) => { state.filters.sentiment = v; draw(); }),
          select('Categories', cats, state.filters.category, (v) => { state.filters.category = v; draw(); }),
          select('Priorities', ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((v) => [v, pretty(v)]), state.filters.priority, (v) => { state.filters.priority = v; draw(); })),
        tableHost, countHost),
    ];
  }

  // ---------- AT-RISK CUSTOMERS ----------
  function riskTable(list) {
    if (!list.length) return el('div', { class: 'empty' }, 'No at-risk customers detected.');
    return el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Customer', 'Risk', 'Why', 'Feedbacks', 'Last issue', 'Last contact', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, list.map((c) =>
        el('tr', {},
          el('td', {}, el('div', { class: 'name' }, c.name), el('div', { class: 'small muted' }, c.email)),
          el('td', {}, levelBadge(c.level), el('span', { class: 'score', title: 'Risk score' }, c.score)),
          el('td', {}, el('div', { class: 'chips' }, c.reasons.map((r) => el('span', { class: 'chip' }, r)))),
          el('td', {}, `${c.feedbackCount}`, el('div', { class: 'small muted' }, `${c.negativeCount} negative`)),
          el('td', { class: 'issue' }, c.lastFeedback.mainIssue || '—', el('div', { class: 'small muted' }, pretty(c.lastFeedback.category))),
          el('td', { class: 'small muted' }, fmtDate(c.lastFeedback.createdAt)),
          el('td', {}, el('div', { class: 'chips' },
            el('button', { class: 'btn', type: 'button', onclick: () => openFeedback(c.lastFeedback.id) }, 'View'),
            el('a', { class: 'btn', href: `mailto:${c.email}?subject=${encodeURIComponent('Following up on your feedback')}` }, 'Email'))))))));
  }

  const csvCell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralize spreadsheet formulas
    return `"${s.replace(/"/g, '""')}"`;
  };

  function exportRiskCsv(list) {
    const header = ['Name', 'Email', 'Risk level', 'Score', 'Feedbacks', 'Negative', 'Reasons', 'Last issue', 'Last contact'];
    const rows = list.map((c) => [c.name, c.email, c.level, c.score, c.feedbackCount, c.negativeCount, c.reasons.join('; '), c.lastFeedback.mainIssue, c.lastFeedback.createdAt]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = el('a', { href: url, download: `at-risk-customers-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderRisk() {
    const all = state.data.atRisk;
    const list = state.riskLevel ? all.filter((c) => c.level === state.riskLevel) : all;
    const levelSel = el('select', { 'aria-label': 'Risk level', onchange: (e) => { state.riskLevel = e.target.value; render(); } },
      el('option', { value: '' }, 'All risk levels'), el('option', { value: 'HIGH' }, 'High risk'), el('option', { value: 'MEDIUM' }, 'Medium risk'));
    levelSel.value = state.riskLevel;
    return [
      el('div', { class: 'page-head' },
        el('div', {}, el('h1', {}, 'At-risk customers'),
          el('p', { class: 'muted' }, 'Customers likely to leave, scored from sentiment, priority, repeated complaints and cancel / switch-operator wording.'))),
      el('section', { class: 'card' },
        el('div', { class: 'filters' }, levelSel, el('span', { class: 'muted' }, `${list.length} customer(s)`),
          el('span', { class: 'spacer' }), el('button', { class: 'btn', type: 'button', disabled: !list.length, onclick: () => exportRiskCsv(list) }, 'Export CSV')),
        riskTable(list)),
    ];
  }

  // ---------- DETAIL MODAL ----------
  const field = (k, v, box) => el('div', { class: 'field' }, el('div', { class: 'k' }, k), el('div', { class: box ? 'v box' : 'v' }, v));

  function openFeedback(id, silent) {
    const f = state.data.feedbacks.find((x) => x.id === id);
    const modal = $('#modal');
    if (!f) { state.openId = null; if (modal.open) modal.close(); return; }
    state.openId = id;

    const analyzeBtn = el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
      e.target.disabled = true; e.target.textContent = 'Analyzing…';
      try { await api(`/feedbacks/${id}/analyze`, { method: 'POST' }); await loadDashboard(); }
      catch (err) { e.target.disabled = false; e.target.textContent = 'Retry analysis'; alert('Analysis failed: ' + err.message); }
    } }, f.sentiment ? 'Re-analyze' : 'Analyze now');

    modal.replaceChildren(
      el('div', { class: 'head' },
        el('div', {}, el('h2', {}, f.customerName), el('div', { class: 'small muted' }, f.customerEmail, ' · ', fmtDate(f.createdAt))),
        el('div', { class: 'chips' }, sentimentBadge(f.sentiment), priorityBadge(f.priority))),
      el('div', { class: 'body' },
        field('Main issue', f.mainIssue || 'Not analyzed yet'),
        field('Category', f.category ? pretty(f.category) : '—'),
        field('Customer message', f.reason, true),
        field('AI response', f.aiResponse || 'No AI response saved yet.', true),
        field('Workflow', `Status: ${pretty(f.status)} · Human needed: ${f.needsHuman ? 'yes' : 'no'} · Email sent: ${f.emailSent ? 'yes' : 'no'}`)),
      el('div', { class: 'foot' },
        el('a', { class: 'btn', href: `mailto:${f.customerEmail}` }, 'Email customer'), analyzeBtn,
        el('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Close')));
    if (!modal.open) modal.showModal();
  }

  // ---------- init ----------
  function init() {
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#login-btn');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const { token } = await api('/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
        sessionStorage.setItem(TOKEN_KEY, token);
        $('#password').value = '';
        $('#login-error').hidden = true;
        showApp();
        await loadDashboard();
      } catch (err) {
        showLogin(err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    });

    $('#tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab || !state.data) return;
      state.tab = tab.dataset.tab;
      render();
    });
    $('#refresh').addEventListener('click', loadDashboard);
    $('#logout').addEventListener('click', () => { state.data = null; state.openId = null; showLogin(); });
    $('#modal').addEventListener('close', () => { state.openId = null; });
    $('#modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

    if (sessionStorage.getItem(TOKEN_KEY)) { showApp(); loadDashboard(); } else showLogin();
  }

  init();
})();
