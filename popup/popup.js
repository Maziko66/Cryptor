// ─── State ───────────────────────────────────────────────────────────────────
let selectedMode = 'binary';
let lastResult = '';
let useSimilarChars = true;
let autoApply = false;
let largeText = false;
let readableFont = false;
let contextMenuInPage = false;
let morseIgnore = true;
let historyOpen = false;
let xorKey = '';
let xorInputType = 'text';
let xorKeyType = 'text';
let xorOutputType = 'hex';
let vigenereKey = '';
let customAlphabet = DEFAULT_ALPHABET;
let rotShift = 13;
let caseMode = 'keep';
let pinned = false;
let sidebarMode = false;
let sidebarSide = 'right';
let autoImport = false;
let autoImportInterval = null;

// ─── Status labels (popup-specific) ──────────────────────────────────────────
const ModeStatusLabels = {
  binary:'BINARY', hex:'HEX', base64:'BASE64',
  decimal:'DECIMAL', rot13:'ROT13', morse:'MORSE', vigenere:'VIGENÈRE', xor:'XOR'
};

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setStatus(state, text) {
  const el = document.getElementById('statusText');
  el.className = 'status-text' + (state !== 'ready' ? ` ${state}` : '');
  el.textContent = text || ModeStatusLabels[selectedMode] || selectedMode.toUpperCase();
}

function showResult(text) {
  document.getElementById('resultSection').style.display = 'flex';
  document.getElementById('resultBox').textContent = text;
  lastResult = text;
  hideError();
}

function hideResult() { document.getElementById('resultSection').style.display = 'none'; }

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.style.display = 'block';
  box.textContent = '⚠ ' + msg;
  hideResult();
  setStatus('error', 'ERROR');
}

function hideError() { document.getElementById('errorBox').style.display = 'none'; }

function updatePreview(text) {
  const box = document.getElementById('previewBox');
  if (text && text.trim().length > 0) {
    box.value = text;
  } else {
    box.value = '';
  }
}

function updateXorVisibility() {
  const isXor = selectedMode === 'xor';
  const el = document.getElementById('xorOptions');
  if (el) el.style.display = isXor ? 'flex' : 'none';
}

function updateVigenereVisibility() {
  const el = document.getElementById('vigenereOptions');
  if (el) el.style.display = selectedMode === 'vigenere' ? 'flex' : 'none';
}

function updateActionButtons() {
  const isSymmetric = selectedMode === 'xor';
  const actionRow = document.getElementById('actionRow');
  const convertRow = document.getElementById('xorActionRow');
  if (actionRow) actionRow.style.display = isSymmetric ? 'none' : 'grid';
  if (convertRow) convertRow.style.display = isSymmetric ? 'grid' : 'none';
}

function updateMorseVisibility() {
  const row = document.getElementById('morseOptionRow');
  if (row) row.style.display = selectedMode === 'morse' ? 'flex' : 'none';
}

function updateRotVisibility() {
  const el = document.getElementById('rotOptions');
  if (el) el.style.display = selectedMode === 'rot13' ? 'flex' : 'none';
}

function buildRotShiftDropdown() {
  const sel = document.getElementById('rotShiftSelect');
  if (!sel) return;
  const len = customAlphabet.length;
  sel.innerHTML = '';
  for (let i = 1; i < len; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    if (i === rotShift) opt.selected = true;
    sel.appendChild(opt);
  }
  if (rotShift >= len) {
    rotShift = Math.floor(len / 2);
    sel.value = rotShift;
    saveSettings();
  }
}

function syncAlphabetInputs() {
  const ids = ['alphabetInput', 'rotAlphabetInput', 'vigAlphabetInput'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = customAlphabet;
  });
}


// ─── Page scripting ───────────────────────────────────────────────────────────
// getSelectedTextFromPage and replaceSelectedTextOnPage are loaded from shared/ciphers.js

async function getActiveTab() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('pinned') || urlParams.has('sidebar')) {
    // In pinned/detached window or sidebar iframe — find the active tab from a normal browser window
    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    // Prefer the focused normal window first
    const sorted = allWindows.sort((a, b) => (b.focused ? 1 : 0) - (a.focused ? 1 : 0));
    for (const win of sorted) {
      const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
      if (tabs.length > 0) return tabs[0];
    }
    return null;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getSelectedText() {
  try {
    const tab = await getActiveTab();
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getSelectedTextFromPage });
    return results?.[0]?.result ?? '';
  } catch(e) { return ''; }
}

async function replaceSelectedText(newText) {
  try {
    const tab = await getActiveTab();
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: replaceSelectedTextOnPage, args: [newText] });
    const result = results?.[0]?.result;
    if (result?.success) { setStatus('ready', 'REPLACED'); setTimeout(() => setStatus('ready'), 2000); }
    else showError(result?.error || 'Could not replace — nothing selected on page.');
  } catch(e) { showError('Could not replace text.'); }
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────
function getCipherOpts() {
  return {
    useSimilarChars,
    morseIgnore,
    customAlphabet,
    rotShift,
    caseMode,
    vigenereKey,
    keyRaw: xorKey,
    inputType: xorInputType,
    keyType: xorKeyType,
    outputType: xorOutputType,
  };
}

async function runEncrypt() {
  const isSymmetric = selectedMode === 'xor';
  setStatus('processing', isSymmetric ? 'CONVERTING' : 'ENCRYPTING');
  hideError();
  const previewBox = document.getElementById('previewBox');
  const previewText = previewBox.value.trim();
  let text;
  if (previewText) {
    text = previewText;
  } else {
    text = await getSelectedText();
    updatePreview(text);
  }
  if (!text || !text.trim()) { showError('No text selected.'); return; }
  try {
    const opts = getCipherOpts();
    const result = Ciphers[selectedMode].encrypt(text, opts);
    showResult(result);
    setStatus('ready', isSymmetric ? 'CONVERTED' : 'ENCRYPTED');
    setTimeout(() => setStatus('ready'), 3000);
    await saveHistoryEntry(isSymmetric ? 'convert' : 'encrypt', selectedMode, text, result);
    if (autoApply) await replaceSelectedText(result);
  } catch(e) { showError(e.message); }
}

async function runDecrypt() {
  setStatus('processing', 'DECRYPTING');
  hideError();
  const previewBox = document.getElementById('previewBox');
  const previewText = previewBox.value.trim();
  let text;
  if (previewText) {
    text = previewText;
  } else {
    text = await getSelectedText();
    updatePreview(text);
  }
  if (!text || !text.trim()) { showError('No text selected.'); return; }
  try {
    const opts = getCipherOpts();
    const result = Ciphers[selectedMode].decrypt(text, opts);
    showResult(result);
    setStatus('ready', 'DECRYPTED');
    setTimeout(() => setStatus('ready'), 3000);
    await saveHistoryEntry('decrypt', selectedMode, text, result);
    if (autoApply) await replaceSelectedText(result);
  } catch(e) { showError(e.message); }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function applySettings(settings) {
  selectedMode     = settings.selectedMode    || 'binary';
  largeText        = settings.largeText       || false;
  readableFont     = settings.readableFont    || false;
  autoApply        = settings.autoApply       || false;
  useSimilarChars  = settings.useSimilarChars !== false;
  contextMenuInPage = settings.contextMenuInPage || false;
  morseIgnore      = settings.morseIgnore !== false;
  xorKey           = settings.xorKey          || '';
  xorInputType     = settings.xorInputType    || 'text';
  xorKeyType       = settings.xorKeyType      || 'text';
  xorOutputType    = settings.xorOutputType   || 'hex';
  vigenereKey       = settings.vigenereKey     || '';
  customAlphabet    = settings.customAlphabet  || DEFAULT_ALPHABET;
  rotShift          = settings.rotShift        || 13;
  caseMode          = settings.caseMode        || 'keep';
  pinned            = settings.pinned || false;
  sidebarMode       = settings.sidebarMode || false;
  sidebarSide       = settings.sidebarSide || 'right';
  autoImport        = settings.autoImport     || false;

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const ab = document.querySelector(`.mode-btn[data-mode="${selectedMode}"]`);
  if (ab) ab.classList.add('active');

  setStatus('ready');

  document.body.classList.toggle('large-text', largeText);
  document.body.classList.toggle('readable-font', readableFont);
  document.getElementById('largeTextToggle').checked        = largeText;
  document.getElementById('readableFontToggle').checked     = readableFont;
  document.getElementById('autoApplyToggle').checked        = autoApply;
  document.getElementById('autoApplyToggleMain').checked     = autoApply;
  document.getElementById('similarCharsToggle').checked     = useSimilarChars;
  document.getElementById('contextMenuPopupToggle').checked = contextMenuInPage;
  document.getElementById('morseIgnoreToggle').checked      = morseIgnore;
  document.getElementById('autoImportToggle').checked       = autoImport;
  document.getElementById('pinBtn').classList.toggle('active', pinned);
  document.getElementById('pinBtnSettings').classList.toggle('active', pinned);
  document.getElementById('sidebarBtn').classList.toggle('active', sidebarMode);
  document.getElementById('sidebarBtnSettings').classList.toggle('active', sidebarMode);
  const sidebarSideToggle = document.getElementById('sidebarSideToggle');
  if (sidebarSideToggle) sidebarSideToggle.checked = sidebarSide === 'right';
  document.getElementById('xorInputType').value  = xorInputType;
  document.getElementById('xorKeyType').value    = xorKeyType;
  document.getElementById('xorOutputType').value = xorOutputType;

  const xorInput = document.getElementById('xorKeyInput');
  if (xorInput) xorInput.value = xorKey;
  const vigKeyInput = document.getElementById('vigenereKeyInput');
  if (vigKeyInput) vigKeyInput.value = vigenereKey;
  syncAlphabetInputs();
  buildRotShiftDropdown();
  const rotCaseSel = document.getElementById('rotCaseSelect');
  if (rotCaseSel) rotCaseSel.value = caseMode;
  const vigCaseSel = document.getElementById('vigCaseSelect');
  if (vigCaseSel) vigCaseSel.value = caseMode;
  updateXorVisibility();
  updateMorseVisibility();
  updateVigenereVisibility();
  updateRotVisibility();
  updateActionButtons();
}

function saveSettings() {
  chrome.storage.sync.set({ selectedMode, largeText, readableFont, autoApply, useSimilarChars, contextMenuInPage, morseIgnore, xorKey, xorInputType, xorKeyType, xorOutputType, vigenereKey, customAlphabet, rotShift, caseMode, pinned, sidebarMode, sidebarSide, autoImport });
}

// ─── History ──────────────────────────────────────────────────────────────────
async function saveHistoryEntry(action, mode, input, output) {
  try {
    const { cryptorHistory = [] } = await chrome.storage.sync.get(['cryptorHistory']);
    const entry = {
      id: Date.now(), action, mode,
      input:  input.length  > 300 ? input.slice(0,300)  + '…' : input,
      output: output.length > 300 ? output.slice(0,300) + '…' : output,
      ts: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
    };
    await chrome.storage.sync.set({ cryptorHistory: [entry, ...cryptorHistory].slice(0,10) });
  } catch(e) { console.warn('Cryptor: failed to save history', e); }
}

function renderHistory(entries) {
  const list = document.getElementById('historyList');
  list.textContent = '';
  if (!entries || entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No history yet. Encrypt or decrypt something first.';
    list.appendChild(empty);
    return;
  }
  entries.forEach(entry => {
    const el = document.createElement('div');
    el.className = 'history-entry';

    const header = document.createElement('div');
    header.className = 'history-entry-header';
    const badge = document.createElement('span');
    badge.className = 'history-entry-badge ' + entry.action;
    badge.textContent = entry.action.toUpperCase() + ' · ' + entry.mode.toUpperCase();
    const meta = document.createElement('span');
    meta.className = 'history-entry-meta';
    meta.textContent = entry.ts;
    header.appendChild(badge);
    header.appendChild(meta);

    const inputDiv = document.createElement('div');
    inputDiv.className = 'history-entry-text';
    inputDiv.textContent = entry.input;
    const arrow = document.createElement('div');
    arrow.className = 'history-entry-arrow';
    arrow.textContent = '↓';
    const outputDiv = document.createElement('div');
    outputDiv.className = 'history-entry-output';
    outputDiv.textContent = entry.output;

    el.appendChild(header);
    el.appendChild(inputDiv);
    el.appendChild(arrow);
    el.appendChild(outputDiv);

    el.addEventListener('click', () => {
      document.getElementById('resultBox').textContent = entry.output;
      document.getElementById('resultSection').style.display = 'flex';
      lastResult = entry.output;
      historyOpen = false;
      document.getElementById('historyPanel').classList.remove('open');
      document.getElementById('historyBtn').classList.remove('active');
    });
    list.appendChild(el);
  });
}

async function loadHistory() {
  const { cryptorHistory = [] } = await chrome.storage.sync.get(['cryptorHistory']);
  renderHistory(cryptorHistory);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  
    updateXorVisibility();
    updateVigenereVisibility();
    updateRotVisibility();
    updateMorseVisibility();
    updateActionButtons();
    setStatus('ready');
    hideResult();
    hideError();
    saveSettings();
  });
});

document.getElementById('historyBtn').addEventListener('click', async () => {
  historyOpen = !historyOpen;
  document.getElementById('historyPanel').classList.toggle('open', historyOpen);
  document.getElementById('historyBtn').classList.toggle('active', historyOpen);
  if (historyOpen) {
    await loadHistory();
  }
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  const main = document.getElementById('mainView');
  const settings = document.getElementById('settingsView');
  main.style.display = 'none';
  settings.style.display = 'flex';
  settings.style.animation = 'none';
  settings.offsetHeight;
  settings.style.animation = 'viewSlideIn 0.22s ease forwards';
  document.getElementById('settingsBtn').classList.add('active');
});

const aboutBtn = document.getElementById('aboutBtn');
const aboutPanel = document.getElementById('aboutPanel');
if (aboutBtn && aboutPanel) {
  aboutBtn.addEventListener('click', () => {
    const isVisible = aboutPanel.style.display !== 'none';
    aboutPanel.style.display = isVisible ? 'none' : 'block';
    aboutBtn.classList.toggle('active', !isVisible);
  });
}

document.getElementById('settingsBackBtn').addEventListener('click', () => {
  const main = document.getElementById('mainView');
  const settings = document.getElementById('settingsView');
  settings.style.display = 'none';
  main.style.display = 'flex';
  main.style.animation = 'none';
  main.offsetHeight;
  main.style.animation = 'viewFadeIn 0.2s ease forwards';
  document.getElementById('settingsBtn').classList.remove('active');
});

document.getElementById('largeTextToggle').addEventListener('change', e => { largeText = e.target.checked; document.body.classList.toggle('large-text', largeText); saveSettings(); });
document.getElementById('readableFontToggle').addEventListener('change', e => { readableFont = e.target.checked; document.body.classList.toggle('readable-font', readableFont); saveSettings(); });
document.getElementById('autoApplyToggle').addEventListener('change', e => { autoApply = e.target.checked; document.getElementById('autoApplyToggleMain').checked = autoApply; saveSettings(); });
document.getElementById('autoApplyToggleMain').addEventListener('change', e => { autoApply = e.target.checked; document.getElementById('autoApplyToggle').checked = autoApply; saveSettings(); });
document.getElementById('contextMenuPopupToggle').addEventListener('change', e => {
  contextMenuInPage = e.target.checked;
  saveSettings();
  // Rebuild context menu to sync the checkbox state
  chrome.runtime.sendMessage({ type: 'rebuildContextMenus' });
});
document.getElementById('similarCharsToggle').addEventListener('change', e => { useSimilarChars = e.target.checked; saveSettings(); });
document.getElementById('morseIgnoreToggle').addEventListener('change', e => { morseIgnore = e.target.checked; saveSettings(); });
document.getElementById('autoImportToggle').addEventListener('change', e => {
  autoImport = e.target.checked;
  saveSettings();
  if (autoImport) {
    startAutoImport();
  } else {
    stopAutoImport();
  }
});

// ─── Pin functionality ───────────────────────────────────────────────────────
function syncPinButtons() {
  document.getElementById('pinBtn').classList.toggle('active', pinned);
  document.getElementById('pinBtnSettings').classList.toggle('active', pinned);
}

async function getCursorPosition() {
  try {
    const tab = await getActiveTab();
    if (!tab) return null;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise(resolve => {
          // Try to get position from last mouse event
          const handler = e => {
            document.removeEventListener('mousemove', handler);
            resolve({ x: e.screenX, y: e.screenY });
          };
          // Use existing position if we tracked it
          if (window.__cryptorMouseX !== undefined) {
            resolve({ x: window.__cryptorMouseX, y: window.__cryptorMouseY });
            return;
          }
          // Fallback: listen briefly then give up
          document.addEventListener('mousemove', handler);
          setTimeout(() => {
            document.removeEventListener('mousemove', handler);
            resolve(null);
          }, 50);
        });
      }
    });
    return results?.[0]?.result ?? null;
  } catch(e) { return null; }
}

function getMouseTracker() {
  // Inject a persistent mouse tracker into the page
  document.addEventListener('mousemove', e => {
    window.__cryptorMouseX = e.screenX;
    window.__cryptorMouseY = e.screenY;
  });
}

async function injectMouseTracker() {
  try {
    const tab = await getActiveTab();
    if (!tab) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getMouseTracker
    });
  } catch(e) { /* Expected on restricted pages */ }
}

async function createPinnedWindow() {
  // Check if a pinned window already exists — focus it instead of creating another
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getCryptorWindowId' });
    if (resp && resp.windowId) {
      try {
        await chrome.windows.update(resp.windowId, { focused: true });
        window.close();
        return;
      } catch(e) {
        // Window was closed but not unregistered — proceed to create
      }
    }
  } catch(e) {}

  const width = 356;
  const height = 700;

  // Try to get cursor position for window placement
  const cursor = await getCursorPosition();
  let left, top;

  if (cursor && cursor.x != null && cursor.y != null) {
    // Position window at cursor location
    left = Math.max(0, Math.round(cursor.x - width / 2));
    top = Math.max(0, Math.round(cursor.y - 40));
  } else {
    // Fallback: right side of screen
    left = Math.max(0, Math.round(screen.availWidth - width - 20));
    top = Math.round((screen.availHeight - height) / 2);
  }

  chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html?pinned=1'),
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top,
    focused: true
  });
}

async function handlePin() {
  pinned = !pinned;

  // Mutually exclusive: disable sidebar mode if enabling popup
  if (pinned && sidebarMode) {
    sidebarMode = false;
    syncSidebarButtons();
    // Close sidebar on active tab
    const tab = await getActiveTab();
    if (tab) {
      chrome.runtime.sendMessage({ type: 'closeSidebar', tabId: tab.id });
    }
  }

  syncPinButtons();
  saveSettings();
  if (pinned) {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('pinned')) {
      await createPinnedWindow();
      window.close();
    }
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('pinned')) {
      window.close();
    }
  }
}

document.getElementById('pinBtn').addEventListener('click', handlePin);
document.getElementById('pinBtnSettings').addEventListener('click', handlePin);

// ─── Sidebar functionality ──────────────────────────────────────────────────
function syncSidebarButtons() {
  document.getElementById('sidebarBtn').classList.toggle('active', sidebarMode);
  document.getElementById('sidebarBtnSettings').classList.toggle('active', sidebarMode);
}

async function handleSidebar() {
  const wantSidebar = !sidebarMode;

  if (wantSidebar) {
    // Check if we can inject into the active tab
    const tab = await getActiveTab();
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
      showError('Cannot open sidebar on this page. Navigate to a regular website first.');
      return;
    }

    // Mutually exclusive: disable popup mode if enabling sidebar
    if (pinned) {
      pinned = false;
      syncPinButtons();
    }

    sidebarMode = true;
    syncSidebarButtons();
    saveSettings();

    // Inject sidebar iframe into the page
    chrome.runtime.sendMessage({ type: 'openSidebar', tabId: tab.id, side: sidebarSide });
    window.close();
  } else {
    sidebarMode = false;
    syncSidebarButtons();
    saveSettings();

    // Remove sidebar from the active tab
    const tab = await getActiveTab();
    if (tab) {
      chrome.runtime.sendMessage({ type: 'closeSidebar', tabId: tab.id });
    }
  }
}

document.getElementById('sidebarBtn').addEventListener('click', handleSidebar);
document.getElementById('sidebarBtnSettings').addEventListener('click', handleSidebar);

// Sidebar close button (visible only in sidebar iframe)
document.getElementById('sidebarCloseBtn').addEventListener('click', async () => {
  sidebarMode = false;
  syncSidebarButtons();
  saveSettings();
  // Ask the parent page to remove the sidebar container
  const tab = await getActiveTab();
  if (tab) {
    chrome.runtime.sendMessage({ type: 'closeSidebar', tabId: tab.id });
  }
});

const sidebarSideToggleEl = document.getElementById('sidebarSideToggle');
if (sidebarSideToggleEl) {
  sidebarSideToggleEl.addEventListener('change', async e => {
    sidebarSide = e.target.checked ? 'right' : 'left';
    saveSettings();

    // If sidebar is currently active, move it to the new side via background
    if (sidebarMode) {
      const tab = await getActiveTab();
      if (tab) {
        chrome.runtime.sendMessage({ type: 'moveSidebar', tabId: tab.id, side: sidebarSide });
      }
    }
  });
}

document.getElementById('historyClearBtn').addEventListener('click', async () => {
  await chrome.storage.sync.remove('cryptorHistory');
  renderHistory([]);
});

document.getElementById('encryptBtn').addEventListener('click', runEncrypt);
document.getElementById('decryptBtn').addEventListener('click', runDecrypt);
document.getElementById('convertBtn').addEventListener('click', runEncrypt);

document.getElementById('copyBtn').addEventListener('click', () => {
  if (!lastResult) return;
  navigator.clipboard.writeText(lastResult).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ COPIED';
    setTimeout(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="4" y="1" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="1" y="3" width="7" height="8" rx="1" fill="#0d1117" stroke="currentColor" stroke-width="1.2"/>
      </svg> COPY`;
    }, 2000);
  }).catch(e => console.warn('Cryptor: clipboard write failed', e));
});

document.getElementById('replaceBtn').addEventListener('click', () => {
  if (!lastResult) return;
  replaceSelectedText(lastResult);
});

const xorInput = document.getElementById('xorKeyInput');
if (xorInput) {
  xorInput.addEventListener('input', e => { xorKey = e.target.value; saveSettings(); });
}

const vigInput = document.getElementById('vigenereKeyInput');
if (vigInput) {
  vigInput.addEventListener('input', e => { vigenereKey = e.target.value; saveSettings(); });
}

function handleAlphabetInput(e) {
  const val = e.target.value.toLowerCase();
  const unique = [...new Set(val)].join('');
  if (unique.length >= 2) {
    customAlphabet = unique;
    syncAlphabetInputs();
    e.target.value = customAlphabet;
    buildRotShiftDropdown();
    saveSettings();
  }
}

function handleAlphabetDefault() {
  customAlphabet = DEFAULT_ALPHABET;
  rotShift = 13;
  syncAlphabetInputs();
  buildRotShiftDropdown();
  saveSettings();
}

['alphabetInput', 'rotAlphabetInput', 'vigAlphabetInput'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', handleAlphabetInput);
});

['alphabetDefaultBtn', 'rotAlphabetDefaultBtn', 'vigAlphabetDefaultBtn'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handleAlphabetDefault);
});

const rotShiftSel = document.getElementById('rotShiftSelect');
if (rotShiftSel) {
  rotShiftSel.addEventListener('change', e => {
    rotShift = parseInt(e.target.value, 10);
    saveSettings();
  });
}

function syncCaseSelects() {
  const ids = ['rotCaseSelect', 'vigCaseSelect'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = caseMode;
  });
}

['rotCaseSelect', 'vigCaseSelect'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', e => {
      caseMode = e.target.value;
      syncCaseSelects();
      saveSettings();
    });
  }
});
document.getElementById('xorInputType').addEventListener('change', e => { xorInputType = e.target.value; saveSettings(); });
document.getElementById('xorKeyType').addEventListener('change', e => { xorKeyType = e.target.value; saveSettings(); });
document.getElementById('xorOutputType').addEventListener('change', e => { xorOutputType = e.target.value; saveSettings(); });

// ─── Auto-import polling ─────────────────────────────────────────────────────
let lastSelectedText = '';

async function startAutoImport() {
  stopAutoImport();
  const text = await getSelectedText();
  if (text && text.trim()) {
    updatePreview(text);
    lastSelectedText = text;
  }
  autoImportInterval = setInterval(async () => {
    try {
      const newText = await getSelectedText();
      if (newText && newText.trim() && newText !== lastSelectedText) {
        lastSelectedText = newText;
        updatePreview(newText);
      }
    } catch(e) { /* Expected on restricted pages */ }
  }, 800);
}

function stopAutoImport() {
  if (autoImportInterval) {
    clearInterval(autoImportInterval);
    autoImportInterval = null;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  const stored = await chrome.storage.sync.get(['selectedMode','largeText','readableFont','autoApply','useSimilarChars','contextMenuInPage','morseIgnore','xorKey','xorInputType','xorKeyType','xorOutputType','vigenereKey','customAlphabet','rotShift','caseMode','pinned','sidebarMode','sidebarSide','autoImport']);
  applySettings(stored);

  // Check if we're in a pinned window
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('pinned')) {
    document.body.classList.add('pinned-window');
    // Register this window with background for tracking
    const currentWindow = await chrome.windows.getCurrent();
    chrome.runtime.sendMessage({ type: 'registerPinnedWindow', windowId: currentWindow.id });
    // Unregister on close
    window.addEventListener('beforeunload', () => {
      chrome.runtime.sendMessage({ type: 'unregisterPinnedWindow' });
    });
  }

  // Check if we're in a sidebar iframe
  if (urlParams.has('sidebar')) {
    document.body.classList.add('sidebar-window');
    // When sidebar iframe is closed/removed, reset sidebarMode in storage
    window.addEventListener('beforeunload', () => {
      chrome.storage.sync.set({ sidebarMode: false });
    });
  }

  // Auto-open as pinned window if pinned setting is on and we're in regular popup
  if (pinned && !urlParams.has('pinned') && !urlParams.has('sidebar')) {
    await createPinnedWindow();
    window.close();
    return;
  }

  // Auto-open sidebar if sidebar mode is on and we're in regular popup
  if (sidebarMode && !urlParams.has('pinned') && !urlParams.has('sidebar')) {
    const tab = await getActiveTab();
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('about:') && !tab.url.startsWith('edge://')) {
      chrome.runtime.sendMessage({ type: 'openSidebar', tabId: tab.id, side: sidebarSide });
      window.close();
      return;
    }
    // Can't inject on this page — fall through to normal popup view
  }

  // Inject mouse tracker for future popup positioning
  injectMouseTracker();

  // Start auto-import polling if the setting is enabled
  if (autoImport) {
    startAutoImport();
  }

  // Clean up polling when popup/sidebar is closed
  window.addEventListener('beforeunload', () => stopAutoImport());
})();
