/* ─── STATE ──────────────────────────────────────────────────── */
const state = {
  tools: [],
  activeFilters: {},
  searchQuery: '',
  sortBy: 'name-asc',
  expandedId: null,
  includeCrossDisciplinary: true,
  library: {},  // { toolId: { notes: '' } }
};

/* ─── CATEGORY CONFIG ────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'discipline',      label: 'Discipline / Field',  multi: true,  chipClass: 'chip-discipline' },
  { key: 'useCase',         label: 'Use Case / Task',     multi: true,  chipClass: 'chip-usecase'    },
  { key: 'easeOfUse',       label: 'Ease of Use',         multi: false, chipClass: null              },
  { key: 'cost',            label: 'Cost Model',          multi: false, chipClass: null              },
  { key: 'platform',        label: 'Platform / Access',   multi: true,  chipClass: 'chip-platform'   },
  { key: 'audience',        label: 'Faculty & Student Use', multi: false, chipClass: 'chip-audience'   },
  { key: 'aiCapability',    label: 'AI Capability',       multi: true,  chipClass: 'chip-aicap'      },
  { key: 'pedagogical',     label: 'Pedagogical Use',     multi: true,  chipClass: 'chip-pedagogy'   },
  { key: 'specialFeatures', label: 'Special Features',    multi: true,  chipClass: 'chip-special'    },
  { key: 'collaboration',   label: 'Collaboration',       multi: true,  chipClass: 'chip-collab'     },
  { key: 'outputType',      label: 'Output Type',         multi: true,  chipClass: 'chip-output'     },
];

/* ─── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadTools();
  loadLibraryFromStorage();
  initTheme();
  initSidebarToggle();
  initSearch();
  initSort();
  initCrossDiscToggle();
  initLibraryPanel();
  buildFilterUI();
  render();
});

async function loadTools() {
  try {
    const res = await fetch('tools.json');
    const data = await res.json();
    state.tools = data.tools || [];
  } catch (e) {
    console.error('Failed to load tools.json', e);
  }
}

/* ─── LOCAL STORAGE ──────────────────────────────────────────── */
function saveLibraryToStorage() {
  const serializable = {};
  Object.entries(state.library).forEach(([id, data]) => {
    serializable[id] = { notes: data.notes || '' };
  });
  localStorage.setItem('au-ai-library', JSON.stringify(serializable));
}

function loadLibraryFromStorage() {
  try {
    const saved = localStorage.getItem('au-ai-library');
    if (saved) state.library = JSON.parse(saved);
  } catch (e) { /* ignore */ }
}

/* ─── THEME ──────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('au-theme') || 'light';
  setTheme(saved);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('au-theme', next);
  });
}
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  document.getElementById('themeToggle').setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

/* ─── SIDEBAR TOGGLE (mobile) ────────────────────────────────── */
function initSidebarToggle() {
  const btn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('filterSidebar');
  btn.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
}

/* ─── SEARCH & SORT ──────────────────────────────────────────── */
function initSearch() {
  document.getElementById('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    render();
  });
}
function initSort() {
  document.getElementById('sortSelect').addEventListener('change', e => {
    state.sortBy = e.target.value;
    render();
  });
}

/* ─── CROSS-DISCIPLINARY TOGGLE ─────────────────────────────── */
function initCrossDiscToggle() {
  const cb = document.getElementById('crossDiscToggle');
  if (cb) cb.addEventListener('change', () => {
    state.includeCrossDisciplinary = cb.checked;
    render();
  });
}

/* ─── BUILD FILTER UI ────────────────────────────────────────── */
function buildFilterUI() {
  CATEGORIES.forEach(cat => {
    const groupEl = document.getElementById(`fg-${cat.key}`);
    if (groupEl) groupEl.dataset.cat = cat.key;

    const container = document.getElementById(`ff-${cat.key}`);
    if (!container) return;

    collectValues(cat.key).forEach(val => {
      const label = document.createElement('label');
      label.className = 'filter-option';
      // For cost and ease of use, set data-chip for per-value CSS color matching
      const chipClass = cat.key === 'cost' ? costChipClass(val)
                      : cat.key === 'easeOfUse' ? easeChipClass(val)
                      : '';
      if (chipClass) label.dataset.chip = chipClass;
      label.innerHTML = `
        <input type="checkbox" data-cat="${cat.key}" data-val="${escAttr(val)}" aria-label="${escAttr(val)}" />
        <span class="filter-option-label">${escHtml(val)}</span>
        <span class="filter-option-count" data-count-cat="${cat.key}" data-count-val="${escAttr(val)}"></span>
      `;
      label.querySelector('input').addEventListener('change', onFilterChange);
      container.appendChild(label);
    });

    const toggle = document.querySelector(`#fg-${cat.key} .filter-group-toggle`);
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExpanded));
        container.classList.toggle('collapsed', isExpanded);
      });
    }
  });

  document.getElementById('clearAllBtn').addEventListener('click', clearAllFilters);
  document.getElementById('clearFromEmpty').addEventListener('click', clearAllFilters);
}

function collectValues(key) {
  const set = new Set();
  state.tools.forEach(t => {
    const v = t.tags[key];
    if (Array.isArray(v)) v.forEach(x => set.add(x));
    else if (v) set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ─── FILTER LOGIC ───────────────────────────────────────────── */
function onFilterChange(e) {
  const { cat, val } = e.target.dataset;
  if (!state.activeFilters[cat]) state.activeFilters[cat] = new Set();
  if (e.target.checked) state.activeFilters[cat].add(val);
  else {
    state.activeFilters[cat].delete(val);
    if (!state.activeFilters[cat].size) delete state.activeFilters[cat];
  }
  render();
}

function addFilter(cat, val) {
  if (!state.activeFilters[cat]) state.activeFilters[cat] = new Set();
  state.activeFilters[cat].add(val);
  const cb = document.querySelector(`input[data-cat="${cat}"][data-val="${CSS.escape(val)}"]`);
  if (cb) {
    cb.checked = true;
    cb.closest('.filter-option')?.classList.add('checked');
    const container = document.getElementById(`ff-${cat}`);
    const toggle = document.querySelector(`#fg-${cat} .filter-group-toggle`);
    if (container?.classList.contains('collapsed')) {
      container.classList.remove('collapsed');
      toggle?.setAttribute('aria-expanded', 'true');
    }
  }
  render();
}

function removeFilter(cat, val) {
  state.activeFilters[cat]?.delete(val);
  if (!state.activeFilters[cat]?.size) delete state.activeFilters[cat];
  const cb = document.querySelector(`input[data-cat="${cat}"][data-val="${CSS.escape(val)}"]`);
  if (cb) { cb.checked = false; cb.closest('.filter-option')?.classList.remove('checked'); }
  render();
}

function clearAllFilters() {
  state.activeFilters = {};
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.filter-option')?.classList.remove('checked');
  });
  render();
}

function toolMatchesFilters(tool) {
  const isCross = (tool.tags.discipline || []).includes('Cross-disciplinary');
  const hasDisciFilter = !!state.activeFilters['discipline']?.size;

  if (isCross && hasDisciFilter && state.includeCrossDisciplinary) {
    for (const [cat, vals] of Object.entries(state.activeFilters)) {
      if (cat === 'discipline' || !vals.size) continue;
      const tv = tool.tags[cat];
      const toolSet = new Set(Array.isArray(tv) ? tv : tv ? [tv] : []);
      if (![...vals].some(v => toolSet.has(v))) return false;
    }
  } else {
    for (const [cat, vals] of Object.entries(state.activeFilters)) {
      if (!vals.size) continue;
      const tv = tool.tags[cat];
      const toolSet = new Set(Array.isArray(tv) ? tv : tv ? [tv] : []);
      if (![...vals].some(v => toolSet.has(v))) return false;
    }
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    if (!tool.name.toLowerCase().includes(q) &&
        !(tool.company || '').toLowerCase().includes(q) &&
        !(tool.description || '').toLowerCase().includes(q)) return false;
  }
  return true;
}

/* ─── RENDER ─────────────────────────────────────────────────── */
function render() {
  const filtered = state.tools.filter(toolMatchesFilters);
  filtered.sort((a, b) => {
    if (state.sortBy === 'name-asc')    return a.name.localeCompare(b.name);
    if (state.sortBy === 'name-desc')   return b.name.localeCompare(a.name);
    if (state.sortBy === 'company-asc') return (a.company || '').localeCompare(b.company || '');
    return 0;
  });

  const totalActive = Object.values(state.activeFilters).reduce((n, s) => n + s.size, 0);
  const hasDisciFilter = !!state.activeFilters['discipline']?.size;
  const libraryCount = Object.keys(state.library).length;

  // Results count
  document.getElementById('resultsCount').innerHTML = `<strong>${filtered.length}</strong> of ${state.tools.length} tools`;

  // Sidebar controls
  document.getElementById('clearAllBtn').hidden = totalActive === 0 && !state.searchQuery;
  const badge = document.getElementById('filterBadgeCount');
  badge.hidden = totalActive === 0;
  badge.textContent = totalActive || '';

  // Active chips
  const activeArea = document.getElementById('activeFilters');
  const chipsEl = document.getElementById('activeFilterChips');
  chipsEl.innerHTML = '';
  if (totalActive > 0) {
    activeArea.hidden = false;
    Object.entries(state.activeFilters).forEach(([cat, vals]) => {
      vals.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'active-chip';
        btn.innerHTML = `${escHtml(val)} <span class="active-chip-x" aria-hidden="true">×</span>`;
        btn.setAttribute('aria-label', `Remove filter: ${val}`);
        btn.addEventListener('click', () => removeFilter(cat, val));
        chipsEl.appendChild(btn);
      });
    });
  } else {
    activeArea.hidden = true;
  }

  // Cross-disc note
  document.getElementById('crossDisciplinaryNote').hidden = !hasDisciFilter;

  // Library header button
  const libBtn = document.getElementById('libraryBtn');
  const libCount = document.getElementById('libraryHeaderCount');
  libBtn.classList.toggle('has-items', libraryCount > 0);
  libCount.hidden = libraryCount === 0;
  libCount.textContent = libraryCount;

  // Sync checkbox styles
  document.querySelectorAll('.filter-option').forEach(el => {
    const cb = el.querySelector('input[type="checkbox"]');
    if (cb) el.classList.toggle('checked', cb.checked);
  });

  updateFilterCounts(filtered);

  // Render cards
  const grid = document.getElementById('toolGrid');
  const empty = document.getElementById('emptyState');
  if (filtered.length === 0) { grid.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  grid.innerHTML = '';
  filtered.forEach(tool => grid.appendChild(buildCard(tool)));
}

function updateFilterCounts(filtered) {
  CATEGORIES.forEach(cat => {
    collectValues(cat.key).forEach(val => {
      const el = document.querySelector(`[data-count-cat="${cat.key}"][data-count-val="${CSS.escape(val)}"]`);
      if (!el) return;
      const n = filtered.filter(t => {
        const tv = t.tags[cat.key];
        return new Set(Array.isArray(tv) ? tv : tv ? [tv] : []).has(val);
      }).length;
      el.textContent = n;
    });
  });
}

/* ─── BUILD CARD ─────────────────────────────────────────────── */
function buildCard(tool) {
  const isExpanded = state.expandedId === tool.id;
  const isBookmarked = !!state.library[tool.id];
  const userNote = state.library[tool.id]?.notes || '';

  const article = document.createElement('article');
  article.className = 'tool-card' + (isExpanded ? ' expanded' : '');
  article.setAttribute('role', 'listitem');
  article.dataset.id = tool.id;

  const noteHtml = isBookmarked && userNote
    ? `<div class="card-user-note">${escHtml(userNote)}</div>` : '';

  article.innerHTML = `
    <div class="card-body">
      <div class="card-header">
        <div class="card-name-block">
          <div class="card-name">${escHtml(tool.name)}</div>
          ${tool.company ? `<div class="card-company">${escHtml(tool.company)}</div>` : ''}
        </div>
        <div class="card-header-btns">
          <button class="card-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}"
            aria-label="${isBookmarked ? 'Remove from library' : 'Save to library'}"
            title="${isBookmarked ? 'Remove from My Library' : 'Add to My Library'}"
            data-id="${escAttr(tool.id)}">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M3 2h9a1 1 0 0 1 1 1v10l-4.5-2.5L4 13V3a1 1 0 0 1 1-1z"
                stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="card-expand-btn"
            aria-expanded="${isExpanded}"
            aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${escAttr(tool.name)} details">
            ${isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>
      <p class="card-description">${escHtml(tool.description || '')}</p>
      <div class="card-primary-tags">${buildPrimaryChips(tool)}</div>
      ${noteHtml}
      ${isExpanded ? buildExpandedContent(tool) : ''}
    </div>
  `;

  // Expand toggle
  article.addEventListener('click', e => {
    if (e.target.closest('.chip') || e.target.closest('.visit-btn') || e.target.closest('.card-bookmark-btn')) return;
    state.expandedId = isExpanded ? null : tool.id;
    render();
  });

  // Bookmark button
  article.querySelector('.card-bookmark-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleBookmark(tool.id);
  });

  // Clickable chips
  article.querySelectorAll('.chip.clickable').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const { cat, val } = chip.dataset;
      if (state.activeFilters[cat]?.has(val)) removeFilter(cat, val);
      else addFilter(cat, val);
    });
  });

  return article;
}

function buildPrimaryChips(tool) {
  let html = '';
  (tool.tags.discipline || []).slice(0, 2).forEach(d => html += chip(d, 'discipline', 'chip-discipline'));
  if (tool.tags.cost) html += chip(tool.tags.cost, 'cost', costChipClass(tool.tags.cost));
  if (tool.tags.easeOfUse) html += chip(tool.tags.easeOfUse, 'easeOfUse', easeChipClass(tool.tags.easeOfUse));
  (tool.tags.platform || []).slice(0, 2).forEach(p => html += chip(p, 'platform', 'chip-platform'));
  return html;
}

function buildExpandedContent(tool) {
  const groups = [
    { label: 'Use Case / Task',   key: 'useCase',         cls: 'chip-usecase'  },
    { label: 'AI Capabilities',   key: 'aiCapability',    cls: 'chip-aicap'    },
    { label: 'Audience',          key: 'audience',        cls: 'chip-audience', single: true },
    { label: 'Pedagogical Use',   key: 'pedagogical',     cls: 'chip-pedagogy' },
    { label: 'Platform / Access', key: 'platform',        cls: 'chip-platform' },
    { label: 'Special Features',  key: 'specialFeatures', cls: 'chip-special'  },
    { label: 'Collaboration',     key: 'collaboration',   cls: 'chip-collab'   },
    { label: 'Output Type',       key: 'outputType',      cls: 'chip-output'   },
  ];

  const secHtml = groups.map(g => {
    const vals = g.single
      ? (tool.tags[g.key] ? [tool.tags[g.key]] : [])
      : (tool.tags[g.key] || []);
    if (!vals.length) return '';
    return `<div class="card-tags-group">
      <div class="card-section-label">${escHtml(g.label)}</div>
      <div class="card-tags-row">${vals.map(v => chip(v, g.key, g.cls)).join('')}</div>
    </div>`;
  }).join('');

  return `<div class="card-expanded-content">
    ${secHtml}
    <div class="card-actions">
      ${tool.url ? `<a class="visit-btn" href="${escAttr(tool.url)}" target="_blank" rel="noopener noreferrer">
        Visit Tool
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 10L10 2M5 2h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>` : ''}
    </div>
  </div>`;
}

/* ─── LIBRARY ────────────────────────────────────────────────── */
function toggleBookmark(id) {
  if (state.library[id]) {
    delete state.library[id];
  } else {
    state.library[id] = { notes: '' };
  }
  saveLibraryToStorage();
  render();
  updateLibraryPanel();
}

function initLibraryPanel() {
  document.getElementById('libraryBtn').addEventListener('click', openLibrary);
  document.getElementById('libraryClose').addEventListener('click', closeLibrary);
  document.getElementById('libraryOverlay').addEventListener('click', closeLibrary);
  document.getElementById('saveLibraryBtn').addEventListener('click', saveLibraryJSON);
  document.getElementById('printLibraryBtn').addEventListener('click', printLibrary);
  document.getElementById('loadLibraryInput').addEventListener('change', loadLibraryJSON);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLibrary();
  });
}

function openLibrary() {
  updateLibraryPanel();
  document.getElementById('libraryPanel').hidden = false;
  document.getElementById('libraryOverlay').hidden = false;
  document.getElementById('libraryClose').focus();
}

function closeLibrary() {
  document.getElementById('libraryPanel').hidden = true;
  document.getElementById('libraryOverlay').hidden = true;
  document.getElementById('libraryBtn').focus();
}

function updateLibraryPanel() {
  const ids = Object.keys(state.library);
  const count = ids.length;

  document.getElementById('libraryPanelCount').textContent = `${count} tool${count !== 1 ? 's' : ''}`;
  document.getElementById('libraryEmptyState').hidden = count > 0;

  const list = document.getElementById('libraryToolsList');
  list.innerHTML = '';

  ids.forEach(id => {
    const tool = state.tools.find(t => t.id === id);
    if (!tool) return;
    const notes = state.library[id]?.notes || '';

    const item = document.createElement('div');
    item.className = 'library-tool-item';
    item.innerHTML = `
      <div class="library-tool-top">
        <div>
          <div class="library-tool-name">${escHtml(tool.name)}</div>
          ${tool.company ? `<div class="library-tool-company">${escHtml(tool.company)}</div>` : ''}
        </div>
        <button class="library-remove-btn" aria-label="Remove ${escAttr(tool.name)} from library" data-id="${escAttr(id)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <p class="library-tool-desc">${escHtml(tool.description || '')}</p>
      <div class="library-tool-chips">
        ${(tool.tags.discipline || []).slice(0, 1).map(d => `<span class="chip chip-discipline">${escHtml(d)}</span>`).join('')}
        ${tool.tags.cost ? `<span class="chip ${costChipClass(tool.tags.cost)}">${escHtml(tool.tags.cost)}</span>` : ''}
        ${tool.tags.easeOfUse ? `<span class="chip ${easeChipClass(tool.tags.easeOfUse)}">${escHtml(tool.tags.easeOfUse)}</span>` : ''}
      </div>
      <div class="library-note-label">My notes</div>
      <textarea class="library-note-input" placeholder="Add notes about this tool…" data-id="${escAttr(id)}" rows="2">${escHtml(notes)}</textarea>
      <div class="library-tool-actions">
        ${tool.url ? `<a class="library-visit-btn" href="${escAttr(tool.url)}" target="_blank" rel="noopener noreferrer">
          Visit Tool
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 10L10 2M5 2h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>` : ''}
      </div>
    `;

    item.querySelector('.library-remove-btn').addEventListener('click', () => {
      toggleBookmark(id);
      updateLibraryPanel();
    });

    item.querySelector('.library-note-input').addEventListener('input', e => {
      if (state.library[id]) {
        state.library[id].notes = e.target.value;
        saveLibraryToStorage();
        render(); // refresh card note previews
      }
    });

    list.appendChild(item);
  });
}

function saveLibraryJSON() {
  const ids = Object.keys(state.library);
  const exportData = {
    version: 1,
    savedAt: new Date().toISOString(),
    tools: ids.map(id => {
      const tool = state.tools.find(t => t.id === id);
      return { id, name: tool?.name || id, notes: state.library[id]?.notes || '' };
    }),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `au-ai-library-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadLibraryJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.tools && Array.isArray(data.tools)) {
        data.tools.forEach(entry => {
          state.library[entry.id] = { notes: entry.notes || '' };
        });
        saveLibraryToStorage();
        render();
        updateLibraryPanel();
      }
    } catch (err) {
      alert('Could not load file — please use a valid AU AI Library save file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function printLibrary() {
  const ids = Object.keys(state.library);
  if (!ids.length) { alert('Your library is empty — add some tools first.'); return; }

  // Build a hidden print-only div
  const existing = document.querySelector('.print-library');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'print-library';
  div.innerHTML = `
    <div class="print-library-header">
      <h1>My AI Tools Library</h1>
      <p>American University — AI Tools Finder · Saved ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
    </div>
    ${ids.map(id => {
      const tool = state.tools.find(t => t.id === id);
      if (!tool) return '';
      const notes = state.library[id]?.notes || '';
      return `<div class="print-tool">
        <div class="print-tool-name">${escHtml(tool.name)}</div>
        ${tool.company ? `<div class="print-tool-company">${escHtml(tool.company)}</div>` : ''}
        <div class="print-tool-desc">${escHtml(tool.description || '')}</div>
        ${tool.url ? `<div class="print-tool-url">${escHtml(tool.url)}</div>` : ''}
        ${notes ? `<div class="print-tool-note">My notes: ${escHtml(notes)}</div>` : ''}
      </div>`;
    }).join('')}
  `;
  document.body.appendChild(div);
  window.print();
}

/* ─── CHIP BUILDER ───────────────────────────────────────────── */
function chip(val, cat, colorClass) {
  return `<span class="chip clickable ${colorClass || ''}" data-cat="${cat}" data-val="${escAttr(val)}" role="button" tabindex="0" aria-label="Filter by ${escAttr(val)}">${escHtml(val)}</span>`;
}

function costChipClass(cost) {
  if (!cost) return '';
  const c = cost.toLowerCase();
  if (c.includes('completely free') || c === 'free') return 'chip-cost-free';
  if (c.includes('freemium')) return 'chip-cost-freemium';
  if (c.includes('paid')) return 'chip-cost-paid';
  return '';
}

function easeChipClass(ease) {
  if (!ease) return '';
  const e = ease.toLowerCase();
  if (e.includes('beginner')) return 'chip-ease-beginner';
  if (e.includes('some'))     return 'chip-ease-some';
  if (e.includes('advanced')) return 'chip-ease-advanced';
  return '';
}

/* ─── UTILS ──────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(str) { return escHtml(str); }
