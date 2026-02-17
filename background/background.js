importScripts('../shared/ciphers.js');

function showToastOnPage(message, isError) {
  const existing = document.getElementById('__cryptor_toast__');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = '__cryptor_toast__';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    background: isError ? '#1a0a0a' : '#0a1a12',
    color: isError ? '#ff4757' : '#00ff9d',
    border: '1px solid ' + (isError ? '#ff4757' : '#00ff9d'),
    borderRadius: '8px', padding: '10px 16px',
    fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px',
    boxShadow: '0 0 20px ' + (isError ? 'rgba(255,71,87,0.3)' : 'rgba(0,255,157,0.3)'),
    transition: 'opacity 0.4s ease', opacity: '1',
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
}

function showResultPopupOnPage(result, label) {
  const existing = document.getElementById('__cryptor_result_popup__');
  if (existing) existing.remove();
  const existingStyle = document.getElementById('__cryptor_styles__');
  if (existingStyle) existingStyle.remove();
  const style = document.createElement('style');
  style.id = '__cryptor_styles__';
  style.textContent = [
    '#__cryptor_result_popup__ * { box-sizing:border-box; font-family:"Share Tech Mono","Courier New",monospace; }',
    '#__cryptor_result_popup__ .cr-overlay { position:fixed; inset:0; z-index:2147483647; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(5px); }',
    '#__cryptor_result_popup__ .cr-box { background:#0d1117; border:1px solid #00ff9d; border-radius:12px; padding:0; min-width:460px; max-width:680px; width:90vw; box-shadow:0 0 50px rgba(0,255,157,0.2),0 20px 60px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden; }',
    '#__cryptor_result_popup__ .cr-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(0,255,157,0.15); background:rgba(0,255,157,0.04); }',
    '#__cryptor_result_popup__ .cr-title { color:#00ff9d; font-size:11px; letter-spacing:2px; font-weight:bold; }',
    '#__cryptor_result_popup__ .cr-close { background:none; border:none; color:#5a6a7a; font-size:16px; cursor:pointer; padding:2px 4px; line-height:1; border-radius:4px; }',
    '#__cryptor_result_popup__ .cr-close:hover { color:#ff4757; background:rgba(255,71,87,0.1); }',
    '#__cryptor_result_popup__ .cr-body { padding:16px 18px; display:flex; flex-direction:column; gap:12px; }',
    '#__cryptor_result_popup__ .cr-textarea { background:#111820; border:1px solid rgba(0,200,255,0.25); border-radius:8px; padding:12px 14px; color:#00c8ff; font-size:13px; line-height:1.65; resize:vertical; min-height:140px; max-height:340px; width:100%; outline:none; }',
    '#__cryptor_result_popup__ .cr-copy { background:rgba(0,255,157,0.07); border:1px solid #00ff9d; border-radius:7px; color:#00ff9d; font-size:11px; letter-spacing:1.5px; padding:10px; cursor:pointer; width:100%; }',
    '#__cryptor_result_popup__ .cr-copy:hover { background:rgba(0,255,157,0.16); }',
  ].join('\n');
  document.head.appendChild(style);
  const overlay = document.createElement('div');
  overlay.id = '__cryptor_result_popup__';
  const inner = document.createElement('div'); inner.className = 'cr-overlay';
  const box = document.createElement('div'); box.className = 'cr-box';
  const header = document.createElement('div'); header.className = 'cr-header';
  const titleEl = document.createElement('span'); titleEl.className = 'cr-title'; titleEl.textContent = label;
  const closeBtn = document.createElement('button'); closeBtn.className = 'cr-close'; closeBtn.textContent = '\u2715';
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(titleEl); header.appendChild(closeBtn);
  const body = document.createElement('div'); body.className = 'cr-body';
  const textarea = document.createElement('textarea'); textarea.className = 'cr-textarea';
  textarea.value = result; textarea.readOnly = true; textarea.onclick = () => textarea.select();
  const copyBtn = document.createElement('button'); copyBtn.className = 'cr-copy';
  copyBtn.textContent = '\u2398  COPY TO CLIPBOARD';
  copyBtn.onclick = () => { navigator.clipboard.writeText(result).then(() => { copyBtn.textContent = '\u2713  COPIED'; setTimeout(() => { copyBtn.textContent = '\u2398  COPY TO CLIPBOARD'; }, 2000); }); };
  body.appendChild(textarea); body.appendChild(copyBtn);
  box.appendChild(header); box.appendChild(body);
  inner.appendChild(box); overlay.appendChild(inner); document.body.appendChild(overlay);
  inner.onclick = (e) => { if (e.target === inner) overlay.remove(); };
  setTimeout(() => textarea.select(), 50);
}

async function executeCipher(tab, action, mode, usePopup) {
  const settings = await chrome.storage.sync.get(['useSimilarChars', 'morseIgnore', 'xorKey', 'xorInputType', 'xorKeyType', 'xorOutputType', 'vigenereKey', 'customAlphabet', 'rotShift', 'caseMode']);
  const [{ result: selectedText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, func: getSelectedTextFromPage
  });
  if (!selectedText || !selectedText.trim()) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToastOnPage, args: ['\u26a0 Cryptor: No text selected', true] });
    return;
  }
  const opts = {
    useSimilarChars: settings.useSimilarChars !== false,
    morseIgnore: settings.morseIgnore !== false,
    customAlphabet: settings.customAlphabet || DEFAULT_ALPHABET,
    rotShift: settings.rotShift || 13,
    caseMode: settings.caseMode || 'keep',
    vigenereKey: settings.vigenereKey || '',
    keyRaw: settings.xorKey || '',
    inputType: settings.xorInputType || 'text',
    keyType: settings.xorKeyType || 'text',
    outputType: settings.xorOutputType || (action === 'encrypt' ? 'hex' : 'text'),
  };
  let result;
  try {
    result = Ciphers[mode][action](selectedText, opts);
  } catch(e) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToastOnPage, args: ['\u26a0 Cryptor: ' + e.message, true] });
    return;
  }
  const label = (action === 'encrypt' ? '\uD83D\uDD12 ENCRYPTED' : '\uD83D\uDD13 DECRYPTED') + ' \u00b7 ' + MODE_LABELS[mode].toUpperCase();
  try {
    const { cryptorHistory = [] } = await chrome.storage.sync.get(['cryptorHistory']);
    const entry = { id: Date.now(), action, mode,
      input:  selectedText.length > 300 ? selectedText.slice(0,300) + '\u2026' : selectedText,
      output: result.length      > 300 ? result.slice(0,300)      + '\u2026' : result,
      ts: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) };
    await chrome.storage.sync.set({ cryptorHistory: [entry, ...cryptorHistory].slice(0,10) });
  } catch(e) { console.warn('Cryptor: failed to save history', e); }
  if (usePopup) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showResultPopupOnPage, args: [result, label] });
  } else {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: replaceSelectedTextOnPage, args: [result] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToastOnPage, args: [label, false] });
  }
}

async function buildContextMenus() {
  const settings = await chrome.storage.sync.get(['contextMenuInPage']);
  const inPage = settings.contextMenuInPage || false;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'cryptor-root', title: 'Cryptor', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'cryptor-quick-encrypt', parentId: 'cryptor-root', title: '\u26a1 Quick Encrypt', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'cryptor-quick-decrypt', parentId: 'cryptor-root', title: '\u26a1 Quick Decrypt', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'cryptor-separator', parentId: 'cryptor-root', type: 'separator', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'cryptor-encrypt-parent', parentId: 'cryptor-root', title: 'Encrypt \u203a', contexts: ['selection'] });
    for (const mode of MODES) {
      chrome.contextMenus.create({ id: 'encrypt-' + mode, parentId: 'cryptor-encrypt-parent', title: MODE_LABELS[mode], contexts: ['selection'] });
    }
    chrome.contextMenus.create({ id: 'cryptor-decrypt-parent', parentId: 'cryptor-root', title: 'Decrypt \u203a', contexts: ['selection'] });
    for (const mode of MODES) {
      chrome.contextMenus.create({ id: 'decrypt-' + mode, parentId: 'cryptor-decrypt-parent', title: MODE_LABELS[mode], contexts: ['selection'] });
    }
    chrome.contextMenus.create({ id: 'cryptor-separator2', parentId: 'cryptor-root', type: 'separator', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'cryptor-in-page-toggle', parentId: 'cryptor-root', title: 'Encrypt/Decrypt in page', type: 'checkbox', checked: inPage, contexts: ['selection'] });
  });
}

chrome.runtime.onInstalled.addListener(buildContextMenus);
chrome.runtime.onStartup.addListener(buildContextMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = info.menuItemId;
  // Handle the in-page toggle checkbox
  if (id === 'cryptor-in-page-toggle') {
    const inPage = info.checked;
    await chrome.storage.sync.set({ contextMenuInPage: inPage });
    return;
  }
  const settings = await chrome.storage.sync.get(['selectedMode', 'contextMenuInPage']);
  const savedMode = settings.selectedMode || 'binary';
  const inPage = settings.contextMenuInPage || false;
  // When inPage is on, don't use popup (replace in page directly). When off, show popup.
  const usePopup = !inPage;
  if (id === 'cryptor-quick-encrypt') { await executeCipher(tab, 'encrypt', savedMode, usePopup); return; }
  if (id === 'cryptor-quick-decrypt') { await executeCipher(tab, 'decrypt', savedMode, usePopup); return; }
  for (const mode of MODES) {
    if (id === 'encrypt-' + mode) { await executeCipher(tab, 'encrypt', mode, usePopup); return; }
    if (id === 'decrypt-' + mode) { await executeCipher(tab, 'decrypt', mode, usePopup); return; }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const settings = await chrome.storage.sync.get(['selectedMode']);
  const mode = settings.selectedMode || 'binary';
  await executeCipher(tab, command, mode, false);
});

// ─── Pinned window tracking ─────────────────────────────────────────────────
let cryptorWindowId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'registerPinnedWindow':
      cryptorWindowId = msg.windowId;
      sendResponse({ ok: true });
      break;
    case 'unregisterPinnedWindow':
      cryptorWindowId = null;
      sendResponse({ ok: true });
      break;
    case 'focusCryptor':
      if (cryptorWindowId) {
        chrome.windows.update(cryptorWindowId, { focused: true }).catch(() => {
          cryptorWindowId = null;
        });
      }
      sendResponse({ ok: true });
      break;
    case 'getCryptorWindowId':
      sendResponse({ windowId: cryptorWindowId });
      break;
    case 'rebuildContextMenus':
      buildContextMenus();
      sendResponse({ ok: true });
      break;
    case 'openSidebar': {
      const tabId = msg.tabId;
      const side = msg.side || 'right';
      const iframeUrl = chrome.runtime.getURL('popup/popup.html?sidebar=1');
      if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: injectCryptorSidebar,
          args: [iframeUrl, side]
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      break;
    }
    case 'closeSidebar': {
      const tabId = msg.tabId;
      if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: removeCryptorSidebar
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      break;
    }
    case 'moveSidebar': {
      const tabId = msg.tabId;
      const side = msg.side || 'right';
      const iframeUrl = chrome.runtime.getURL('popup/popup.html?sidebar=1');
      if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: removeCryptorSidebar
        }).catch(() => {});
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: injectCryptorSidebar,
            args: [iframeUrl, side]
          }).catch(() => {});
        }, 300);
      }
      sendResponse({ ok: true });
      break;
    }
  }
});

// ─── Sidebar injection (runs in page context) ──────────────────────────────
function injectCryptorSidebar(iframeUrl, side) {
  // Remove existing sidebar if any
  const existing = document.getElementById('__cryptor_sidebar__');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = '__cryptor_sidebar__';
  container.dataset.side = side;
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    [side]: '0',
    width: '356px',
    height: '100vh',
    zIndex: '2147483646',
    boxShadow: side === 'left' ? '4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(0,0,0,0.5)',
    transition: 'transform 0.25s ease',
    transform: side === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
    background: '#0d1117',
  });

  const iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.allow = 'clipboard-write';
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#0d1117',
  });
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.style.transform = 'translateX(0)';
    });
  });
}

function removeCryptorSidebar() {
  const existing = document.getElementById('__cryptor_sidebar__');
  if (existing) {
    const side = existing.dataset.side || 'right';
    existing.style.transform = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    setTimeout(() => existing.remove(), 250);
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === cryptorWindowId) {
    cryptorWindowId = null;
  }
});
