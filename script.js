/* ==========================================================================
   MURAL DE IMÓVEIS — Residencial Flora Park Aroeira
   --------------------------------------------------------------------------
   COMO CONECTAR SUA PLANILHA DO GOOGLE
   1. Crie uma planilha com a primeira linha: status | unidade | contato
   2. Arquivo > Compartilhar > Publicar na web > escolha a aba > formato CSV
   3. Cole o link gerado em CONFIG.csvUrl (abaixo) e salve.
   Alternativa: informe apenas CONFIG.sheetId e CONFIG.sheetName.
   ========================================================================== */

'use strict';

const CONFIG = {
  /**
   * Link CSV publicado da planilha. Também aceita o link normal de edição
   * (a função resolveSheetUrl converte automaticamente para CSV).
   * Ex.: 'https://docs.google.com/spreadsheets/d/e/2PACX.../pub?output=csv'
   */
  csvUrl: '',

  /** Alternativa ao csvUrl: ID da planilha + aba (a planilha deve ser pública).
   *  Deixe sheetName vazio para usar a primeira aba. */
  sheetId: '',
  sheetName: '',
  sheetGid: '',

  /** Se a planilha falhar, exibe anúncios de exemplo em vez de uma tela vazia. */
  demoFallback: true,

  /** Atualização automática em minutos (0 desativa). */
  refreshMinutes: 5,

  /** Tempo máximo de espera pela planilha, em milissegundos. */
  timeoutMs: 12000,
};

/** Dados de exemplo — 12 anúncios em 3 linhas × 4 colunas, como na referência. */
const DEMO_ITEMS = [
  { status: 'VENDE-SE', unidade: 'Quadra 4, Lote 12', contato: '(62) 99999-1010' },
  { status: 'ALUGA-SE', unidade: 'Quadra 2, Lote 8', contato: '(62) 98888-2020' },
  { status: 'VENDE-SE', unidade: 'Quadra 7, Lote 3', contato: '(62) 99777-3030' },
  { status: 'ALUGA-SE', unidade: 'Quadra 1, Lote 21', contato: '(62) 98666-4040' },
  { status: 'ALUGA-SE', unidade: 'Quadra 5, Lote 16', contato: '(62) 99555-5050' },
  { status: 'VENDE-SE', unidade: 'Quadra 3, Lote 9', contato: '(62) 98444-6060' },
  { status: 'ALUGA-SE', unidade: 'Quadra 8, Lote 2', contato: '(62) 99333-7070' },
  { status: 'VENDE-SE', unidade: 'Quadra 6, Lote 18', contato: '(62) 98222-8080' },
  { status: 'VENDE-SE', unidade: 'Quadra 9, Lote 5', contato: '(62) 99111-9090' },
  { status: 'ALUGA-SE', unidade: 'Quadra 10, Lote 14', contato: '(62) 98111-8181' },
  { status: 'VENDE-SE', unidade: 'Quadra 11, Lote 7', contato: '(62) 99222-7272' },
  { status: 'ALUGA-SE', unidade: 'Quadra 12, Lote 22', contato: '(62) 98333-6363' },
];

/** Nomes aceitos para as colunas (sem acentos e sem diferenciar maiúsculas). */
const COLUMN_ALIASES = {
  status: ['status', 'situacao', 'tipo', 'categoria', 'anuncio'],
  unidade: ['unidade', 'imovel', 'localizacao', 'endereco', 'quadra_lote', 'quadra_e_lote', 'loteamento'],
  contato: ['contato', 'telefone', 'celular', 'whatsapp', 'fone', 'tel', 'email', 'e_mail'],
  quadra: ['quadra', 'qd'],
  lote: ['lote', 'lt'],
};

const els = {
  grid: document.getElementById('grid'),
  count: document.getElementById('count'),
  empty: document.getElementById('empty'),
  filters: document.querySelector('.filters'),
  updated: document.getElementById('updated'),
  updatedText: document.getElementById('updatedText'),
  notice: document.getElementById('notice'),
  noticeText: document.getElementById('noticeText'),
  noticeClose: document.getElementById('noticeClose'),
};

const state = {
  items: [],
  filter: 'todos',
  loading: false,
  lastUpdate: null,
  demo: false,
};

/* ------------------------------- Inicialização -------------------------- */

function init() {
  bindEvents();

  if (!resolveSheetUrl()) {
    if (CONFIG.demoFallback) {
      useDemo('Modo demonstração: conecte sua planilha do Google em script.js para exibir os anúncios reais.');
    } else {
      renderError(new Error('Nenhuma planilha configurada. Informe CONFIG.csvUrl ou CONFIG.sheetId em script.js.'));
      setStatus('error', 'Planilha não configurada');
    }
    return;
  }

  loadData();
  scheduleAutoRefresh();
}

function bindEvents() {
  els.filters.addEventListener('click', (event) => {
    const button = event.target.closest('.filter');
    if (!button) return;

    state.filter = button.dataset.filter;
    els.filters.querySelectorAll('.filter').forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle('is-active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    applyFilter();
  });

  els.noticeClose.addEventListener('click', () => {
    els.notice.hidden = true;
  });

  els.grid.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) loadData();
  });
}

/* ----------------------------- Carga dos dados -------------------------- */

async function loadData({ silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  els.grid.setAttribute('aria-busy', 'true');

  if (!silent) {
    setStatus('loading', 'Buscando anúncios…');
    els.count.textContent = 'Buscando anúncios…';
    if (!state.items.length) renderSkeletons();
  }

  try {
    const url = resolveSheetUrl();
    if (!url) throw new Error('Nenhuma planilha configurada. Informe CONFIG.csvUrl ou CONFIG.sheetId em script.js.');

    const rows = await fetchSheet(url);
    const items = rowsToItems(rows);

    if (!items.length) {
      throw new Error('A planilha não retornou anúncios válidos. Verifique se as linhas têm a coluna "unidade" preenchida.');
    }

    state.items = items;
    state.demo = false;
    state.lastUpdate = new Date();

    hideNotice();
    renderItems();
    setStatus('ok', formatUpdated(state.lastUpdate));
  } catch (error) {
    console.error('[Mural de Imóveis]', error);

    // Já existem anúncios na tela: preserva os dados e apenas avisa sobre a falha.
    if (state.items.length) {
      showNotice(
        `Não foi possível atualizar a planilha. Os anúncios exibidos podem estar desatualizados. ${error.message}`,
        'error'
      );
      setStatus('error', 'Falha na atualização');
      updateCount();
      return;
    }

    if (CONFIG.demoFallback) {
      state.items = buildDemoItems();
      state.demo = true;
      state.lastUpdate = new Date();

      renderItems();
      showNotice(`Não foi possível carregar a planilha. Exibindo anúncios de demonstração. ${error.message}`, 'error');
      setStatus('demo', 'Dados de demonstração');
    } else {
      state.items = [];
      renderError(error);
      setStatus('error', 'Falha ao carregar a planilha');
    }
  } finally {
    state.loading = false;
    els.grid.setAttribute('aria-busy', 'false');
  }
}

async function fetchSheet(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONFIG.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`A planilha respondeu com status ${response.status}. Confira se ela está publicada na web.`);
    }

    const text = await response.text();

    if (/^\s*</.test(text)) {
      throw new Error('O link retornou uma página HTML em vez de CSV. Use o link "Publicar na web" no formato CSV.');
    }

    return parseCSV(text);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A planilha demorou demais para responder. Tente novamente.');
    }
    if (error instanceof TypeError) {
      throw new Error('Não foi possível acessar a planilha. Verifique sua conexão e se ela está pública.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Monta a URL de exportação CSV a partir das opções de CONFIG. */
function resolveSheetUrl() {
  const raw = String(CONFIG.csvUrl || '').trim();

  if (raw) {
    // Link já publicado em CSV
    if (/(?:output=csv|tqx=out:csv|format=csv)/i.test(raw)) return raw;

    // Link "Publicar na web" em HTML: converte para CSV
    if (/\/spreadsheets\/d\/e\//i.test(raw)) {
      try {
        const published = new URL(raw);
        published.pathname = published.pathname.replace(/\/pubhtml$/i, '/pub');
        published.searchParams.set('output', 'csv');
        return published.toString();
      } catch {
        return raw;
      }
    }

    // Link normal de edição: converte para o endpoint gviz
    const sheet = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheet) {
      const gid = (raw.match(/[#&?]gid=([0-9]+)/) || [])[1] || '';
      return buildGvizUrl(sheet[1], gid);
    }

    return raw;
  }

  if (String(CONFIG.sheetId || '').trim()) {
    return buildGvizUrl(String(CONFIG.sheetId).trim(), String(CONFIG.sheetGid || '').trim());
  }

  return '';
}

function buildGvizUrl(id, gid) {
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  if (gid) return `${base}&gid=${encodeURIComponent(gid)}`;

  const sheetName = String(CONFIG.sheetName || '').trim();
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

/* ------------------------------- CSV parser ----------------------------- */

function parseCSV(text) {
  const input = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(input);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/** Detecta vírgula, ponto e vírgula ou tabulação como separador. */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;

  for (const delimiter of candidates) {
    let count = 0;
    let inQuotes = false;

    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') {
        if (inQuotes && firstLine[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && char === delimiter) {
        count++;
      }
    }

    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }

  return best;
}

/** Converte as linhas da planilha em objetos usados pelos cards. */
function rowsToItems(rows) {
  if (!rows.length) return [];

  const headerMap = {};
  rows[0].forEach((header, index) => {
    const key = normalizeKey(header);
    if (key && !(key in headerMap)) headerMap[key] = index;
  });

  const index = {
    status: findColumn(headerMap, COLUMN_ALIASES.status),
    unidade: findColumn(headerMap, COLUMN_ALIASES.unidade),
    contato: findColumn(headerMap, COLUMN_ALIASES.contato),
    quadra: findColumn(headerMap, COLUMN_ALIASES.quadra),
    lote: findColumn(headerMap, COLUMN_ALIASES.lote),
  };

  const hasUnitSource = index.unidade !== -1 || index.quadra !== -1 || index.lote !== -1;

  if (index.status === -1 && !hasUnitSource && index.contato === -1) {
    throw new Error('A planilha precisa ter as colunas "status", "unidade" e "contato" na primeira linha.');
  }

  const read = (row, key) => (index[key] >= 0 ? String(row[index[key]] ?? '').trim() : '');
  const items = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    let unidade = read(row, 'unidade');
    if (!unidade) {
      const quadra = read(row, 'quadra');
      const lote = read(row, 'lote');
      if (quadra || lote) {
        unidade = [
          quadra ? `Quadra ${quadra}` : '',
          lote ? `Lote ${lote}` : '',
        ].filter(Boolean).join(', ');
      }
    }

    if (!unidade) continue;

    const status = read(row, 'status') || 'IMÓVEL';
    const kind = classifyStatus(status);
    const contato = read(row, 'contato') || 'Não informado';

    items.push({
      status,
      label: statusLabel(kind, status),
      kind,
      unidade,
      contato,
      link: contactLink(contato),
    });
  }

  return items;
}

function findColumn(map, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(map, alias)) return map[alias];
  }
  return -1;
}

/* ------------------------------- Renderização --------------------------- */

function renderItems() {
  const fragment = document.createDocumentFragment();
  state.items.forEach((item, index) => fragment.appendChild(createCard(item, index)));

  els.grid.replaceChildren(fragment);
  els.empty.hidden = true;
  applyFilter();
}

function createCard(item, index) {
  const card = document.createElement('article');
  card.className = `card card--${item.kind}`;
  card.dataset.kind = item.kind;
  card.style.setProperty('--i', String(Math.min(index, 12)));
  card.setAttribute('aria-label', `${item.label}: ${item.unidade}`);

  const pin = document.createElement('span');
  pin.className = 'pin';
  pin.setAttribute('aria-hidden', 'true');

  const header = document.createElement('header');
  header.className = 'card__header';

  const status = document.createElement('span');
  status.className = 'card__status';
  status.textContent = item.label;
  header.appendChild(status);

  const body = document.createElement('div');
  body.className = 'card__body';
  body.appendChild(createField('Unidade', item.unidade));
  body.appendChild(createField('Contato', item.contato, item.link));

  card.append(pin, header, body);
  return card;
}

function createField(label, value, href) {
  const field = document.createElement('div');
  field.className = 'card__field';

  const labelEl = document.createElement('span');
  labelEl.className = 'card__label';
  labelEl.textContent = label;
  field.appendChild(labelEl);

  if (href) {
    const link = document.createElement('a');
    link.className = 'card__value card__value--link';
    link.href = href;
    link.textContent = value;

    const isEmail = href.startsWith('mailto:');
    if (!isEmail) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    link.setAttribute(
      'aria-label',
      `${label}: ${value} — ${isEmail ? 'enviar e-mail' : 'abrir conversa no WhatsApp'}`
    );
    field.appendChild(link);
  } else {
    const text = document.createElement('p');
    text.className = 'card__value';
    text.textContent = value;
    field.appendChild(text);
  }

  return field;
}

function renderSkeletons(count = 6) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'card card--skeleton';
    card.style.setProperty('--i', String(i));
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <span class="pin"></span>
      <div class="skeleton__header"></div>
      <div class="skeleton__body">
        <span class="skeleton__line skeleton__line--sm"></span>
        <span class="skeleton__line skeleton__line--md"></span>
        <span class="skeleton__line skeleton__line--sm"></span>
        <span class="skeleton__line skeleton__line--lg"></span>
      </div>`;
    fragment.appendChild(card);
  }

  els.grid.replaceChildren(fragment);
  els.empty.hidden = true;
}

function renderError(error) {
  const card = document.createElement('article');
  card.className = 'status-card';
  card.innerHTML = `
    <span class="pin" aria-hidden="true"></span>
    <h2>Não foi possível carregar o mural</h2>
    <p class="status-card__message"></p>
    <p class="status-card__hint">Confira se a planilha está publicada na web e se o link em <code>script.js</code> está correto.</p>
    <button type="button" class="btn" data-action="retry">Tentar novamente</button>`;

  card.querySelector('.status-card__message').textContent = error.message;

  els.grid.replaceChildren(card);
  els.empty.hidden = true;
  updateCount();
}

/* -------------------------------- Filtros ------------------------------- */

function applyFilter() {
  const cards = els.grid.querySelectorAll('.card[data-kind]');
  let visible = 0;

  cards.forEach((card) => {
    const matches = state.filter === 'todos' || card.dataset.kind === state.filter;
    card.hidden = !matches;
    if (matches) visible++;
  });

  els.empty.hidden = visible > 0 || state.items.length === 0;

  if (!els.empty.hidden) {
    els.empty.textContent = state.filter === 'vende-se'
      ? 'Nenhum imóvel à venda no momento.'
      : state.filter === 'aluga-se'
        ? 'Nenhum imóvel para locação no momento.'
        : 'Nenhum anúncio encontrado.';
  }

  updateCount();
}

function updateCount() {
  if (!state.items.length) {
    els.count.textContent = state.loading ? 'Buscando anúncios…' : 'Nenhum anúncio disponível';
    return;
  }

  const total = state.items.length;
  const visible = state.items.filter(
    (item) => state.filter === 'todos' || item.kind === state.filter
  ).length;

  if (state.filter === 'todos') {
    els.count.textContent = `${total} ${total === 1 ? 'anúncio no mural' : 'anúncios no mural'}`;
  } else {
    const label = state.filter === 'vende-se' ? 'Vende-se' : 'Aluga-se';
    els.count.textContent = `${visible} de ${total} ${total === 1 ? 'anúncio' : 'anúncios'} • ${label}`;
  }
}

/* ----------------------------- Estados e avisos ------------------------- */

function useDemo(message) {
  state.items = buildDemoItems();
  state.demo = true;
  state.lastUpdate = new Date();

  renderItems();
  setStatus('demo', 'Dados de demonstração');
  showNotice(message, 'info');
  els.grid.setAttribute('aria-busy', 'false');
}

function buildDemoItems() {
  return DEMO_ITEMS.map((raw) => {
    const kind = classifyStatus(raw.status);
    return {
      status: raw.status,
      label: statusLabel(kind, raw.status),
      kind,
      unidade: raw.unidade,
      contato: raw.contato || 'Não informado',
      link: contactLink(raw.contato),
    };
  });
}

function showNotice(message, tone = 'info') {
  els.noticeText.textContent = message;
  els.notice.dataset.tone = tone;
  els.notice.hidden = false;
}

function hideNotice() {
  els.notice.hidden = true;
}

function setStatus(mode, text) {
  els.updated.dataset.state = mode;
  els.updatedText.textContent = text;
}

function formatUpdated(date) {
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return sameDay
    ? `Atualizado hoje às ${time}`
    : `Atualizado em ${date.toLocaleDateString('pt-BR')} às ${time}`;
}

function scheduleAutoRefresh() {
  const minutes = Number(CONFIG.refreshMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  window.setInterval(() => {
    if (document.visibilityState === 'visible' && !state.loading) {
      loadData({ silent: true });
    }
  }, Math.max(1, minutes) * 60 * 1000);
}

/* -------------------------------- Utilidades ---------------------------- */

function classifyStatus(raw) {
  const value = normalizeText(raw);
  if (/(vende|venda)/.test(value)) return 'vende-se';
  if (/(aluga|aluguel|loca)/.test(value)) return 'aluga-se';
  return 'outro';
}

function statusLabel(kind, raw) {
  if (kind === 'vende-se') return 'VENDE-SE';
  if (kind === 'aluga-se') return 'ALUGA-SE';
  const value = String(raw || '').trim();
  return value ? value.toUpperCase() : 'IMÓVEL';
}

/** Gera link de WhatsApp (ou e-mail) a partir do contato informado. */
function contactLink(value) {
  const contact = String(value || '').trim();
  if (!contact) return '';

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return `mailto:${contact}`;
  }

  const digits = contact.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return '';

  const number = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  const message = encodeURIComponent(
    'Olá! Vi seu anúncio no Mural de Imóveis do Residencial Flora Park Aroeira.'
  );

  return `https://wa.me/${number}?text=${message}`;
}

function normalizeKey(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/* -------------------------------- Start --------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
