// ─── Shared Cryptor Module ──────────────────────────────────────────────────
// Single source of truth for all cipher logic, used by both popup.js and background.js

// ─── Constants ──────────────────────────────────────────────────────────────
const MODES = ['binary', 'hex', 'base64', 'decimal', 'rot13', 'morse', 'vigenere', 'xor'];

const MODE_LABELS = {
  binary: 'Binary', hex: 'Hex', base64: 'Base64', decimal: 'Decimal',
  rot13: 'ROT13', morse: 'Morse', vigenere: 'Vigen\u00e8re', xor: 'XOR'
};

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

// ─── Latin transliteration map ──────────────────────────────────────────────
const LATIN_MAP = {
  '\u00e0':'a','\u00e1':'a','\u00e2':'a','\u00e3':'a','\u00e4':'a','\u00e5':'a','\u0101':'a','\u0103':'a','\u0105':'a',
  '\u00c0':'A','\u00c1':'A','\u00c2':'A','\u00c3':'A','\u00c4':'A','\u00c5':'A','\u0100':'A','\u0102':'A','\u0104':'A',
  '\u00e6':'ae','\u00c6':'AE',
  '\u00e7':'c','\u0107':'c','\u010d':'c','\u00c7':'C','\u0106':'C','\u010c':'C',
  '\u00f0':'d','\u00d0':'D','\u0111':'d','\u0110':'D',
  '\u00e8':'e','\u00e9':'e','\u00ea':'e','\u00eb':'e','\u0113':'e','\u0115':'e','\u0119':'e','\u011b':'e',
  '\u00c8':'E','\u00c9':'E','\u00ca':'E','\u00cb':'E','\u0112':'E','\u0118':'E','\u011a':'E',
  '\u011f':'g','\u0121':'g','\u0123':'g','\u011e':'G','\u0120':'G','\u0122':'G',
  '\u00ec':'i','\u00ed':'i','\u00ee':'i','\u00ef':'i','\u012b':'i','\u012d':'i','\u012f':'i','\u0131':'i',
  '\u00cc':'I','\u00cd':'I','\u00ce':'I','\u00cf':'I','\u012a':'I','\u0130':'I',
  '\u0135':'j','\u0134':'J','\u0137':'k','\u0136':'K',
  '\u013a':'l','\u013c':'l','\u013e':'l','\u0142':'l','\u0139':'L','\u013b':'L','\u013d':'L','\u0141':'L',
  '\u00f1':'n','\u0144':'n','\u0146':'n','\u0148':'n','\u00d1':'N','\u0143':'N','\u0145':'N','\u0147':'N',
  '\u00f2':'o','\u00f3':'o','\u00f4':'o','\u00f5':'o','\u00f6':'o','\u00f8':'o','\u014d':'o','\u0151':'o',
  '\u00d2':'O','\u00d3':'O','\u00d4':'O','\u00d5':'O','\u00d6':'O','\u00d8':'O','\u014c':'O','\u0150':'O',
  '\u0153':'oe','\u0152':'OE',
  '\u0155':'r','\u0157':'r','\u0159':'r','\u0154':'R','\u0156':'R','\u0158':'R',
  '\u015b':'s','\u015d':'s','\u015f':'s','\u0161':'s','\u015a':'S','\u015c':'S','\u015e':'S','\u0160':'S',
  '\u00df':'ss','\u1e9e':'SS',
  '\u0163':'t','\u0165':'t','\u0167':'t','\u0162':'T','\u0164':'T','\u0166':'T',
  '\u00f9':'u','\u00fa':'u','\u00fb':'u','\u00fc':'u','\u016b':'u','\u016d':'u','\u016f':'u','\u0171':'u','\u0173':'u',
  '\u00d9':'U','\u00da':'U','\u00db':'U','\u00dc':'U','\u016a':'U','\u0170':'U','\u0172':'U',
  '\u0175':'w','\u0174':'W',
  '\u00fd':'y','\u00ff':'y','\u0177':'y','\u00dd':'Y','\u0178':'Y','\u0176':'Y',
  '\u017a':'z','\u017c':'z','\u017e':'z','\u0179':'Z','\u017b':'Z','\u017d':'Z',
  '\u00fe':'th','\u00de':'TH',
};

function applyLatinMap(text) {
  return [...text].map(ch => LATIN_MAP[ch] ?? ch).join('');
}

// ─── Morse tables ───────────────────────────────────────────────────────────
const MORSE_ENCODE = {
  'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---',
  'K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-',
  'U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...',
  '8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-',
  '&':'.-...',':':'---...',';':'-.-.-.','=':'-...-','+':'.-.-.','-':'-....-',
  '"':'.-..-.','@':'.--.-.','\'':'.----.',
};

const MORSE_DECODE = Object.fromEntries(
  Object.entries(MORSE_ENCODE).map(([k, v]) => [v, k])
);

// ─── XOR helpers ────────────────────────────────────────────────────────────
function detectDataType(str) {
  const s = str.trim();
  if (/^([01]{8}\s)*[01]{8}$/.test(s)) return 'bin';
  if (/^([0-9a-fA-F]{2}\s)*[0-9a-fA-F]{2}$/.test(s)) return 'hex';
  if (/^(0x)?[0-9a-fA-F]{2}$/i.test(s)) return 'hex';
  return 'text';
}

function parseToBytes(str, type) {
  const resolved = type === 'auto' ? detectDataType(str) : type;
  const s = str.trim();
  if (resolved === 'bin') {
    const chunks = s.split(/\s+/);
    for (const c of chunks) {
      if (!/^[01]{1,8}$/.test(c)) throw new Error('Invalid binary: "' + c + '"');
    }
    return new Uint8Array(chunks.map(b => parseInt(b, 2)));
  }
  if (resolved === 'hex') {
    const clean = s.replace(/^0x/i, '').replace(/\s+/g, '');
    if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) throw new Error('Invalid hex');
    const pairs = clean.match(/.{2}/g);
    return new Uint8Array(pairs.map(h => parseInt(h, 16)));
  }
  return new TextEncoder().encode(s);
}

function formatBytes(bytes, type, action) {
  const resolved = type === 'auto' ? (action === 'encrypt' ? 'hex' : 'text') : type;
  if (resolved === 'bin') return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
  if (resolved === 'hex') return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  return new TextDecoder().decode(bytes);
}

// ─── Case helper ────────────────────────────────────────────────────────────
function applyCase(text, caseMode) {
  if (caseMode === 'lower') return text.toLowerCase();
  if (caseMode === 'upper') return text.toUpperCase();
  return text;
}

// ─── Cipher implementations ────────────────────────────────────────────────
// All ciphers use an options parameter for consistency.
// opts: { useSimilarChars, morseIgnore, customAlphabet, rotShift, caseMode,
//         vigenereKey, xorKey/keyRaw, xorInputType/inputType, xorKeyType/keyType, xorOutputType/outputType }

const Ciphers = {
  binary: {
    encrypt(text, opts) {
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const bytes = new TextEncoder().encode(input);
      return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
    },
    decrypt(text) {
      const clean = text.trim();
      const chunks = clean.includes(' ') ? clean.split(/\s+/) : clean.match(/.{8}/g);
      if (!chunks) throw new Error('Invalid binary');
      for (const c of chunks) {
        if (!/^[01]{8}$/.test(c)) throw new Error('Invalid binary byte: "' + c + '"');
      }
      return new TextDecoder().decode(new Uint8Array(chunks.map(b => parseInt(b, 2))));
    }
  },

  hex: {
    encrypt(text, opts) {
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const bytes = new TextEncoder().encode(input);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    },
    decrypt(text) {
      const clean = text.trim();
      const chunks = clean.includes(' ') ? clean.split(/\s+/) : clean.match(/.{2}/g);
      if (!chunks) throw new Error('Invalid hex');
      for (const c of chunks) {
        if (!/^[0-9a-fA-F]{2}$/.test(c)) throw new Error('Invalid hex byte: "' + c + '"');
      }
      return new TextDecoder().decode(new Uint8Array(chunks.map(h => parseInt(h, 16))));
    }
  },

  base64: {
    encrypt(text, opts) {
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const bytes = new TextEncoder().encode(input);
      let bin = '';
      bytes.forEach(b => bin += String.fromCharCode(b));
      return btoa(bin);
    },
    decrypt(text) {
      try {
        const bin = atob(text.trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      } catch (e) {
        throw new Error('Invalid Base64 string');
      }
    }
  },

  decimal: {
    encrypt(text, opts) {
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const bytes = new TextEncoder().encode(input);
      return Array.from(bytes).map(b => b.toString(10)).join(' ');
    },
    decrypt(text) {
      const chunks = text.trim().split(/\s+/);
      for (const c of chunks) {
        if (!/^\d+$/.test(c)) throw new Error('Invalid decimal: "' + c + '"');
        if (parseInt(c, 10) > 255) throw new Error('Byte out of range: ' + c);
      }
      return new TextDecoder().decode(new Uint8Array(chunks.map(n => parseInt(n, 10))));
    }
  },

  rot13: {
    encrypt(text, opts) {
      const alpha = (opts?.customAlphabet || DEFAULT_ALPHABET).toLowerCase();
      const ALPHA = alpha.toUpperCase();
      const len = alpha.length;
      const shift = Math.min(opts?.rotShift || 13, len - 1);
      const cm = opts?.caseMode || 'keep';
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const r = [...input].map(c => {
        const li = alpha.indexOf(c);
        if (li !== -1) return alpha[(li + shift) % len];
        const ui = ALPHA.indexOf(c);
        if (ui !== -1) return ALPHA[(ui + shift) % len];
        return c;
      }).join('');
      return applyCase(r, cm);
    },
    decrypt(text, opts) {
      const alpha = (opts?.customAlphabet || DEFAULT_ALPHABET).toLowerCase();
      const ALPHA = alpha.toUpperCase();
      const len = alpha.length;
      const shift = Math.min(opts?.rotShift || 13, len - 1);
      const cm = opts?.caseMode || 'keep';
      const r = [...text].map(c => {
        const li = alpha.indexOf(c);
        if (li !== -1) return alpha[(li - shift + len) % len];
        const ui = ALPHA.indexOf(c);
        if (ui !== -1) return ALPHA[(ui - shift + len) % len];
        return c;
      }).join('');
      return applyCase(r, cm);
    }
  },

  morse: {
    encrypt(text, opts) {
      const ignore = opts?.morseIgnore !== false;
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const result = [];
      for (const ch of input.toUpperCase()) {
        if (ch === ' ') { result.push('/'); continue; }
        const code = MORSE_ENCODE[ch];
        if (!code) {
          if (!ignore) result.push('[?]');
          continue;
        }
        result.push(code);
      }
      return result.join(' ');
    },
    decrypt(text) {
      return text.trim().split(' / ').map(word =>
        word.trim().split(' ').map(code => {
          if (!code) return '';
          const ch = MORSE_DECODE[code];
          if (!ch) throw new Error('Unknown Morse code: "' + code + '"');
          return ch;
        }).join('')
      ).join(' ');
    }
  },

  vigenere: {
    encrypt(text, opts) {
      const alpha = (opts?.customAlphabet || DEFAULT_ALPHABET).toLowerCase();
      const ALPHA = alpha.toUpperCase();
      const len = alpha.length;
      const keyRaw = (opts?.vigenereKey || '').trim().toLowerCase();
      if (!keyRaw) throw new Error('Enter a Vigen\u00e8re key first');
      for (const kc of keyRaw) {
        if (alpha.indexOf(kc) === -1) throw new Error('Key must only contain alphabet characters');
      }
      const cm = opts?.caseMode || 'keep';
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      let ki = 0;
      const r = [...input].map(c => {
        const li = alpha.indexOf(c);
        if (li !== -1) { const shift = alpha.indexOf(keyRaw[ki % keyRaw.length]); ki++; return alpha[(li + shift) % len]; }
        const ui = ALPHA.indexOf(c);
        if (ui !== -1) { const shift = alpha.indexOf(keyRaw[ki % keyRaw.length]); ki++; return ALPHA[(ui + shift) % len]; }
        return c;
      }).join('');
      return applyCase(r, cm);
    },
    decrypt(text, opts) {
      const alpha = (opts?.customAlphabet || DEFAULT_ALPHABET).toLowerCase();
      const ALPHA = alpha.toUpperCase();
      const len = alpha.length;
      const keyRaw = (opts?.vigenereKey || '').trim().toLowerCase();
      if (!keyRaw) throw new Error('Enter a Vigen\u00e8re key first');
      for (const kc of keyRaw) {
        if (alpha.indexOf(kc) === -1) throw new Error('Key must only contain alphabet characters');
      }
      const cm = opts?.caseMode || 'keep';
      let ki = 0;
      const r = [...text].map(c => {
        const li = alpha.indexOf(c);
        if (li !== -1) { const shift = alpha.indexOf(keyRaw[ki % keyRaw.length]); ki++; return alpha[(li - shift + len) % len]; }
        const ui = ALPHA.indexOf(c);
        if (ui !== -1) { const shift = alpha.indexOf(keyRaw[ki % keyRaw.length]); ki++; return ALPHA[(ui - shift + len) % len]; }
        return c;
      }).join('');
      return applyCase(r, cm);
    }
  },

  xor: {
    encrypt(text, opts) {
      const keyRaw = (opts?.keyRaw || opts?.xorKey || '').trim();
      if (!keyRaw) throw new Error('Enter an XOR key first');
      const keyBytes = parseToBytes(keyRaw, opts?.keyType || opts?.xorKeyType || 'auto');
      if (!keyBytes.length) throw new Error('Enter an XOR key first');
      const input = (opts?.useSimilarChars) ? applyLatinMap(text) : text;
      const inputBytes = parseToBytes(input, opts?.inputType || opts?.xorInputType || 'auto');
      const out = new Uint8Array(inputBytes.length);
      for (let i = 0; i < inputBytes.length; i++) out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
      return formatBytes(out, opts?.outputType || opts?.xorOutputType || 'hex', 'encrypt');
    },
    decrypt(text, opts) {
      const keyRaw = (opts?.keyRaw || opts?.xorKey || '').trim();
      if (!keyRaw) throw new Error('Enter an XOR key first');
      const keyBytes = parseToBytes(keyRaw, opts?.keyType || opts?.xorKeyType || 'auto');
      if (!keyBytes.length) throw new Error('Enter an XOR key first');
      const inputBytes = parseToBytes(text, opts?.inputType || opts?.xorInputType || 'auto');
      const out = new Uint8Array(inputBytes.length);
      for (let i = 0; i < inputBytes.length; i++) out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
      return formatBytes(out, opts?.outputType || opts?.xorOutputType || 'text', 'decrypt');
    }
  }
};

// ─── Page scripting functions (injected into web pages) ─────────────────────
function getSelectedTextFromPage() {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const s = active.selectionStart, e = active.selectionEnd;
    if (s !== e) return active.value.substring(s, e);
  }
  const sel = window.getSelection();
  return sel ? sel.toString() : '';
}

function replaceSelectedTextOnPage(newText) {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart, end = active.selectionEnd;
    if (start !== end) {
      active.value = active.value.substring(0, start) + newText + active.value.substring(end);
      active.setSelectionRange(start, start + newText.length);
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    }
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) return { success: false };
  const range = sel.getRangeAt(0);
  try {
    if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      const node = range.startContainer;
      const full = node.textContent;
      node.textContent = full.substring(0, range.startOffset) + newText + full.substring(range.endOffset);
      return { success: true };
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
