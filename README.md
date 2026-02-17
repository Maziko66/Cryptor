# Cryptor — Chrome Extension

A cyberpunk-themed Chrome extension that encrypts and decrypts selected text on any webpage using 8 encoding modes: Binary, Hex, Base64, Decimal, ROT, Morse, Vigenère, and XOR. Works via popup, sidebar, pinned window, keyboard shortcuts, and right-click context menu.

---

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual / Developer Load
1. Download and unzip `cryptor-addon-chrome.zip`
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **"Load unpacked"**
5. Select the `cryptor-addon-chrome` folder
6. The Cryptor icon will appear in your toolbar (pin it if needed)

---

## Features

### Encoding Modes
| Mode | Description |
|------|-------------|
| **Binary** | Converts text to 8-bit binary groups (`01001000 01101001`) |
| **Hex** | Converts text to uppercase hex pairs (`48 65 6C 6C 6F`) |
| **Base64** | Standard Base64 encoding/decoding |
| **Decimal** | Converts text to space-separated decimal byte values |
| **ROT** | Rotates letters by a configurable shift amount (default 13). Supports custom alphabets and case control |
| **Morse** | International Morse code encoding. Words separated by `/`, letters by spaces |
| **Vigenère** | Polyalphabetic substitution cipher using a keyword. Supports custom alphabets and case control |
| **XOR** | Bitwise XOR cipher with configurable input, key, and output data types (auto-detect, binary, hex, or text) |

### How to Use
1. **Select text** on any webpage or input field
2. Open the **Cryptor popup** by clicking the toolbar icon
3. Type or paste text into the preview box, or enable **Auto-import selected text** in settings to have it filled automatically
4. Choose an **encoding mode**
5. Click **ENCRYPT** or **DECRYPT** (XOR shows **CONVERT** since it's symmetric)
6. Use **COPY** to copy the result, or **REPLACE IN PAGE** to swap the selected text in place

### Display Modes

Cryptor can run in three different display modes:

- **Popup** (default) — Opens as a standard browser extension popup when you click the toolbar icon
- **Pinned Window** — Click the pin icon to open Cryptor as a detached floating window that stays open while you work. Positioned near your cursor
- **Sidebar** — Click the sidebar icon to dock Cryptor to the side of the current webpage. Configurable to left or right side via settings. Slides in/out with animation

Pinned Window and Sidebar are mutually exclusive — activating one will deactivate the other. Both persist across interactions (the popup normally closes when you click away). Sidebar cannot be opened on restricted pages (`chrome://`, `about:`, etc.).

### Keyboard Shortcuts
| Action | Windows / Linux | Mac |
|--------|----------------|-----|
| Open Cryptor | `Alt + Shift + C` | `Cmd + Shift + C` |
| Encrypt selected text | `Alt + Shift + E` | `Cmd + Shift + E` |
| Decrypt selected text | `Alt + Shift + D` | `Cmd + Shift + D` |

> Encrypt/Decrypt shortcuts work without opening the popup — they replace the selected text in place and show a toast notification with the result.

### Right-Click Context Menu
Right-click any selected text to access:
```
Cryptor
  ├─ ⚡ Quick Encrypt        (uses your saved mode)
  ├─ ⚡ Quick Decrypt        (uses your saved mode)
  ├─ ─────────────────────
  ├─ Encrypt ›  →  Binary / Hex / Base64 / Decimal / ROT13 / Morse / Vigenère / XOR
  ├─ Decrypt ›  →  Binary / Hex / Base64 / Decimal / ROT13 / Morse / Vigenère / XOR
  ├─ ─────────────────────
  └─ ☑ Encrypt/Decrypt in page   (checkbox toggle)
```

When **"Encrypt/Decrypt in page"** is checked, context menu actions replace the selected text directly on the page. When unchecked (default), a floating result popup appears with the output and a copy button.

### History Panel
Click the **clock icon** in the header to view your last 10 encrypt/decrypt operations. Each entry shows the action, mode, timestamp, input, and output. Click any entry to reload its output. Use **CLEAR ALL** to wipe history.

### Settings
Click the **gear icon** in the header to access:

| Setting | Description |
|---------|-------------|
| **Use larger UI text** | Increases font size throughout the popup |
| **Use readable font** | Switches to a clean sans-serif (Inter) instead of the monospace theme font |
| **Always replace in page** | Automatically replaces selected text after every encrypt/decrypt |
| **Right-click → encrypt/decrypt in page** | When ON, context menu actions replace text directly. When OFF (default), shows a copy-paste popup |
| **Auto-import selected text** | Automatically fills the preview box with the currently selected text on the page, and polls for changes |
| **Sidebar on the right** | Controls which side the sidebar appears on (left or right) |
| **Use similar chars for non-Latin** | Transliterates extended Latin characters before encoding (e.g. `ç→c`, `ü→u`, `æ→ae`, `ß→ss`) |
| **Custom alphabet** | Define a custom alphabet for ROT and Vigenère ciphers (shared between both) |
| **Ignore unconvertible characters** | (Morse only) When ON, silently skips unknown characters. When OFF, shows `[?]` for each |

---

## File Structure

```
cipher-addon-chrome/
├── manifest.json              # Chrome MV3 extension manifest
├── icons/
│   ├── icon16.png             # Toolbar icon (16px)
│   ├── icon32.png             # Toolbar icon HiDPI (32px)
│   ├── icon48.png             # Extension management icon (48px)
│   └── icon96.png             # Chrome Web Store icon (96px)
├── shared/
│   └── ciphers.js             # Shared cipher engine (used by both popup and background)
├── popup/
│   ├── popup.html             # Popup UI
│   ├── popup.css              # Cyberpunk terminal theme styles
│   └── popup.js               # Popup logic, settings, history, display modes
└── background/
    └── background.js          # Service worker: shortcuts, context menu, sidebar injection
```

---

## Permissions

| Permission | Why it's needed |
|-----------|----------------|
| `activeTab` | Read selected text and inject results into the current tab |
| `scripting` | Run the cipher logic and replacement on the active page |
| `clipboardWrite` | Copy results to clipboard |
| `storage` | Persist settings and history across sessions (via `chrome.storage.sync`) |
| `contextMenus` | Add the Cryptor submenu to the right-click context menu |

---

## Privacy

Cryptor operates **entirely locally**. No text you encrypt or decrypt is ever sent to any server. All cipher logic runs in the browser. History is stored only in your Chrome sync storage.

---

## Version

`1.0.0`
