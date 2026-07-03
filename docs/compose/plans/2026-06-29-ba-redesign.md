# Blue Archive Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CRMoment's Material Design 3 purple theme with a Blue Archive-inspired aesthetic — soft gradient backgrounds, glassmorphism cards, smooth scroll animations, and the exact color palette from the lgcr837home reference site.

**Architecture:** Complete visual rewrite of `web/style.css`, `web/index.html`, and `web/app.js`. No MWC components — all custom HTML/CSS with vanilla JS. SPA structure and all existing functionality preserved. Light mode only.

**Tech Stack:** Vanilla HTML/CSS/JS, no frameworks or component libraries. API endpoints unchanged.

## Global Constraints

- All existing functionality must be preserved: auth, posts, comments, notifications, chat, music, profiles, image viewer
- API endpoints and request format unchanged — `app.js` still calls the same `/api.php?route=` endpoints
- No external CSS/JS dependencies (remove MWC importmap, Material Icons, Roboto font CDN)
- Light mode only — no dark mode CSS or toggle
- Mobile responsive (breakpoints at 720px and 480px)
- Chinese UI text preserved exactly as-is

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `web/style.css` | **Rewrite** | Complete BA theme: variables, gradient bg, glassmorphism cards, nav, dialogs, chat, music, animations, responsive |
| `web/index.html` | **Rewrite** | Replace all MWC components with custom HTML elements. Remove importmap, MWC script, Material Icons CDN |
| `web/app.js` | **Rewrite** | Update all DOM references from MWC selectors to custom element selectors. Update render functions to output custom HTML. Remove MWC-specific code (dialogOpen/dialogClose, fixButtonPadding, etc.) |
| `index.html` (root) | **Update** | Update landing page colors to match BA theme |
| `web/app.js` (imports) | **Remove** | Remove `import '@material/web/all.js'` and typescale styles import |

---

### Task 1: CSS Theme Rewrite

**Files:**
- Rewrite: `D:\code2026\crmoment\web\style.css`

**Reference colors (from lgcr837home):**
- Background gradient: `#e8f4fa → #f0f7fb → #fdf6f8 → #fafcfe → #f5f0f8`
- Card bg: `rgba(255, 255, 255, 0.55)`
- Card border: `1px solid rgba(255, 255, 255, 0.8)`
- Card shadow: `0 2px 12px rgba(150, 170, 190, 0.12)`
- Text colors: `#4a6075` (primary), `#5a6f84` (secondary), `#8a9db0` (muted), `#a0b8cc` (light)
- Accent blue: `#7ec8e3` / `#4a9fc7`
- Accent pink: `#f4c2d0`

**Steps:**

- [ ] **Step 1: Write the complete CSS file**

```css
/* ===== CRMoment Web - Blue Archive Theme ===== */

/* ===== CSS Variables ===== */
:root {
    --ba-blue: #7ec8e3;
    --ba-blue-dark: #4a9fc7;
    --ba-pink: #f4c2d0;
    --ba-text: #4a6075;
    --ba-text-secondary: #5a6f84;
    --ba-text-muted: #8a9db0;
    --ba-text-light: #a0b8cc;
    --ba-card-bg: rgba(255, 255, 255, 0.55);
    --ba-card-border: rgba(255, 255, 255, 0.8);
    --ba-card-shadow: 0 2px 12px rgba(150, 170, 190, 0.12);
    --ba-card-shadow-hover: 0 8px 28px rgba(150, 170, 190, 0.22);
    --ba-radius: 12px;
    --ba-radius-lg: 20px;
    --content-max-width: 680px;
}

/* ===== Reset & Base ===== */
* { margin: 0; padding: 0; box-sizing: border-box; }

html {
    scrollbar-color: rgba(180, 190, 200, 0.5) transparent;
    scrollbar-width: thin;
    scroll-behavior: smooth;
}

body {
    background: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%);
    background-attachment: fixed;
    font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", sans-serif;
    color: var(--ba-text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
}

a { color: var(--ba-blue-dark); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(180, 190, 200, 0.5); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(160, 170, 180, 0.7); }

/* ===== Top Navigation Bar ===== */
#app-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 20px;
    background: var(--ba-card-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--ba-card-border);
    box-shadow: 0 1px 6px rgba(150, 170, 190, 0.1);
}

.app-title { height: 40px; width: auto; display: block; }

.top-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* ===== Theme Toggle Button ===== */
.icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--ba-text-secondary);
    cursor: pointer;
    transition: background 0.2s;
    font-size: 20px;
}
.icon-btn:hover { background: rgba(126, 200, 227, 0.15); }
.icon-btn .material-symbols-outlined { font-size: 22px; }

/* ===== Sub Navigation ===== */
.sub-nav {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 8px 16px;
    background: transparent;
}

.nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 20px;
    border: none;
    background: transparent;
    color: var(--ba-text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.nav-btn:hover { background: rgba(126, 200, 227, 0.12); color: var(--ba-text); }
.nav-btn.active { background: rgba(126, 200, 227, 0.2); color: var(--ba-blue-dark); font-weight: 600; }
.nav-btn .material-symbols-outlined { font-size: 20px; }

/* ===== Avatar ===== */
.avatar-small {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background: #e0e0e0;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}
.avatar-small:hover { border-color: var(--ba-blue); }

/* Auth area */
.nav-auth, .nav-user { display: flex; align-items: center; gap: 8px; }

/* ===== Login Button ===== */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border-radius: 20px;
    border: none;
    background: var(--ba-blue);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.btn-primary:hover { background: var(--ba-blue-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(126, 200, 227, 0.3); }

.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border-radius: 20px;
    border: 1px solid var(--ba-blue);
    background: transparent;
    color: var(--ba-blue-dark);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.btn-secondary:hover { background: rgba(126, 200, 227, 0.1); }

.btn-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 20px;
    border: none;
    background: transparent;
    color: var(--ba-text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.btn-text:hover { background: rgba(126, 200, 227, 0.1); color: var(--ba-text); }

/* ===== Main Content ===== */
.main-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: 16px;
    padding-top: 80px;
    min-height: 100vh;
}

/* ===== Section Title ===== */
.section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--ba-text);
    margin-bottom: 16px;
    padding-top: 8px;
}

/* ===== Post Cards ===== */
.post-card {
    background: var(--ba-card-bg);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: var(--ba-radius-lg);
    padding: 20px;
    margin-bottom: 16px;
    border: 1px solid var(--ba-card-border);
    box-shadow: var(--ba-card-shadow);
    transition: all 0.35s ease;
    opacity: 0;
    transform: translateY(24px);
}
.post-card.reveal {
    opacity: 1;
    transform: translateY(0);
}
.post-card:hover {
    box-shadow: var(--ba-card-shadow-hover);
    border-color: var(--ba-blue);
}

.post-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.post-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: #e0e0e0;
    cursor: pointer;
    border: 2px solid rgba(126, 200, 227, 0.4);
    transition: border-color 0.2s;
}
.post-avatar:hover { border-color: var(--ba-blue); }

.post-author {
    font-weight: 500;
    font-size: 15px;
    cursor: pointer;
    color: var(--ba-text);
}
.post-author:hover { color: var(--ba-blue-dark); }

.post-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--ba-blue-dark);
    background: rgba(126, 200, 227, 0.12);
    padding: 2px 8px;
    border-radius: 10px;
}

.post-time {
    font-size: 12px;
    color: var(--ba-text-muted);
    margin-left: auto;
}

.post-content {
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--ba-text-secondary);
}

/* Inline link button */
.inline-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 18px;
    margin: 2px 4px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    background: var(--ba-blue);
    color: #fff;
    border: none;
    transition: all 0.2s;
    vertical-align: baseline;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(126, 200, 227, 0.3);
}
.inline-link-btn:hover {
    background: var(--ba-blue-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(126, 200, 227, 0.4);
}

/* Post images */
.post-images {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
}
.post-images:empty { display: none; }
.post-images img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    cursor: pointer;
    border-radius: 8px;
    transition: transform 0.2s;
}
.post-images img:hover { transform: scale(1.02); }
.post-images.single { grid-template-columns: 1fr; max-width: 300px; }

/* Post actions */
.post-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid rgba(150, 170, 190, 0.15);
}
.post-actions .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    color: var(--ba-text-muted);
    transition: all 0.2s;
    border: none;
    background: none;
    font-family: inherit;
}
.post-actions .action-btn:hover { background: rgba(126, 200, 227, 0.1); color: var(--ba-text); }
.post-actions .action-btn.liked { color: #e91e63; }
.post-actions .action-btn.liked .material-symbols-outlined { color: #e91e63; font-variation-settings: 'FILL' 1; }

/* ===== Composer Card ===== */
.composer-card {
    background: var(--ba-card-bg);
    backdrop-filter: blur(8px);
    border-radius: var(--ba-radius-lg);
    padding: 16px 20px;
    margin-bottom: 20px;
    border: 1px solid var(--ba-card-border);
    box-shadow: var(--ba-card-shadow);
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.35s ease;
}
.composer-card:hover {
    box-shadow: var(--ba-card-shadow-hover);
    border-color: var(--ba-blue);
}
.composer-card .composer-placeholder {
    flex: 1;
    color: var(--ba-text-muted);
    font-size: 15px;
}

/* ===== Loading ===== */
.loading-indicator {
    text-align: center;
    padding: 40px 0;
    color: var(--ba-text-muted);
}
.spinner {
    display: inline-block;
    width: 32px;
    height: 32px;
    border: 3px solid rgba(126, 200, 227, 0.2);
    border-top-color: var(--ba-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.end-indicator {
    text-align: center;
    padding: 24px 0;
    color: var(--ba-text-muted);
    font-size: 14px;
}

/* ===== Dialog / Modal ===== */
.modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    z-index: 100;
    align-items: center;
    justify-content: center;
}
.modal-overlay.open { display: flex; }

.modal {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: var(--ba-radius-lg);
    border: 1px solid var(--ba-card-border);
    box-shadow: 0 8px 32px rgba(150, 170, 190, 0.25);
    max-width: min(560px, calc(100% - 32px));
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
}

.modal-headline {
    font-size: 18px;
    font-weight: 600;
    color: var(--ba-text);
    padding: 20px 24px 8px;
}

.modal-content {
    padding: 8px 24px;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 24px 20px;
}

/* ===== Form Fields ===== */
.field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
}
.field-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--ba-text-secondary);
}
.field-input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid rgba(150, 170, 190, 0.3);
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    color: var(--ba-text);
    background: rgba(255, 255, 255, 0.6);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
}
.field-input:focus {
    border-color: var(--ba-blue);
    box-shadow: 0 0 0 3px rgba(126, 200, 227, 0.2);
}
.field-input::placeholder { color: var(--ba-text-light); }

textarea.field-input {
    min-height: 100px;
    resize: vertical;
    line-height: 1.5;
}

/* ===== Auth Tabs ===== */
.auth-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(150, 170, 190, 0.2);
}
.auth-tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    font-size: 14px;
    font-weight: 500;
    color: var(--ba-text-muted);
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    border-bottom: 2px solid transparent;
}
.auth-tab.active {
    color: var(--ba-blue-dark);
    border-bottom-color: var(--ba-blue);
}

/* ===== Error Message ===== */
.error-message {
    color: #d4a0a0;
    font-size: 13px;
    padding: 4px 0;
}

/* ===== Notification ===== */
.notif-list { min-width: 320px; max-height: 400px; overflow-y: auto; }
.notif-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(150, 170, 190, 0.1);
    cursor: pointer;
    transition: background 0.2s;
}
.notif-item:hover { background: rgba(126, 200, 227, 0.05); }
.notif-item:last-child { border-bottom: none; }
.notif-item .notif-text { flex: 1; font-size: 14px; line-height: 1.4; color: var(--ba-text-secondary); }
.notif-item .notif-time { font-size: 12px; color: var(--ba-text-light); }
.notif-item.unread { font-weight: 500; }
.notif-empty { text-align: center; padding: 40px 0; color: var(--ba-text-muted); }
.notif-section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ba-blue-dark);
    padding: 8px 0 4px;
    letter-spacing: 0.5px;
}

/* ===== Comments ===== */
.comment-list { min-width: 320px; max-height: 300px; overflow-y: auto; margin-bottom: 12px; }
.comment-item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(150, 170, 190, 0.1);
}
.comment-item:last-child { border-bottom: none; }
.comment-item .comment-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background: #e0e0e0;
    flex-shrink: 0;
    cursor: pointer;
    border: 1px solid rgba(126, 200, 227, 0.3);
}
.comment-item .comment-body { flex: 1; }
.comment-item .comment-author {
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    display: inline-block;
    color: var(--ba-text);
}
.comment-item .comment-author:hover { color: var(--ba-blue-dark); }
.comment-item .comment-text {
    font-size: 14px;
    line-height: 1.4;
    margin-top: 2px;
    white-space: pre-wrap;
    color: var(--ba-text-secondary);
}
.comment-item .comment-time {
    font-size: 11px;
    color: var(--ba-text-light);
    margin-top: 2px;
}
.comment-input {
    width: 100%;
    min-height: 56px;
    resize: none;
    font-size: 14px;
    line-height: 1.6;
    padding: 12px 16px;
    border: 2px solid rgba(150, 170, 190, 0.3);
    border-radius: 10px;
    outline: none;
    background: rgba(255, 255, 255, 0.5);
    color: var(--ba-text);
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
    font-family: inherit;
}
.comment-input:focus {
    border-color: var(--ba-blue);
    box-shadow: 0 0 0 3px rgba(126, 200, 227, 0.15);
}
.comment-empty { text-align: center; padding: 20px; color: var(--ba-text-muted); }

/* ===== Image Viewer ===== */
.image-viewer-img {
    max-width: 80vw;
    max-height: 70vh;
    border-radius: 8px;
}

/* ===== User Profile ===== */
.profile-header { text-align: center; padding: 24px 0; }
.profile-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    background: #e0e0e0;
    margin-bottom: 12px;
    cursor: pointer;
    border: 3px solid rgba(126, 200, 227, 0.5);
    box-shadow: 0 0 12px rgba(126, 200, 227, 0.3);
    animation: avatarGlow 3s ease-in-out infinite;
}
@keyframes avatarGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(126, 200, 227, 0.3); border-color: rgba(126, 200, 227, 0.5); }
    50% { box-shadow: 0 0 18px rgba(126, 200, 227, 0.6); border-color: rgba(126, 200, 227, 0.8); }
}
.profile-nickname { font-size: 22px; font-weight: 600; color: var(--ba-text); margin-bottom: 2px; }
.profile-username { font-size: 14px; color: var(--ba-text-muted); margin-bottom: 4px; }
.profile-bio { color: var(--ba-text-secondary); font-size: 14px; margin-bottom: 8px; }
.profile-stats { display: flex; justify-content: center; gap: 24px; margin-top: 12px; }
.profile-stats .stat { text-align: center; }
.profile-stats .stat-num { font-size: 18px; font-weight: 600; color: var(--ba-text); }
.profile-stats .stat-label { font-size: 12px; color: var(--ba-text-muted); }
.profile-edit-btn { margin-top: 16px; display: flex; gap: 8px; justify-content: center; }
.user-profile-back { text-align: left; margin-bottom: 8px; }

/* ===== Music Section ===== */
.music-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24px;
    margin-bottom: 16px;
}
.music-section-header .section-title { margin-bottom: 0; padding-top: 0; }
.music-header-actions { display: flex; gap: 6px; }

.music-card {
    background: var(--ba-card-bg);
    backdrop-filter: blur(8px);
    border-radius: var(--ba-radius-lg);
    padding: 16px;
    border: 1px solid var(--ba-card-border);
    box-shadow: var(--ba-card-shadow);
    transition: all 0.35s ease;
    cursor: pointer;
    margin-bottom: 12px;
}
.music-card:hover {
    box-shadow: var(--ba-card-shadow-hover);
    border-color: var(--ba-blue);
    transform: translateY(-2px);
}
.music-card-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--ba-text);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.music-card-meta {
    font-size: 13px;
    color: var(--ba-text-muted);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.music-card-author { color: var(--ba-blue-dark); cursor: pointer; font-weight: 500; }
.music-card-author:hover { text-decoration: underline; }
.music-actions { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; }

/* ===== LRC Position Radio ===== */
.lrc-pos-group {
    display: flex;
    gap: 0;
    border-radius: 28px;
    overflow: hidden;
    border: 1px solid rgba(150, 170, 190, 0.3);
    background: transparent;
    margin-top: 4px;
}
.lrc-pos-option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 6px 12px;
    font-size: 14px;
    color: var(--ba-text-muted);
    transition: all 0.2s;
    user-select: none;
    border-right: 1px solid rgba(150, 170, 190, 0.2);
}
.lrc-pos-option:last-child { border-right: none; }
.lrc-pos-radio { display: none; }
.lrc-pos-option:has(.lrc-pos-radio:checked) {
    background: rgba(126, 200, 227, 0.2);
    color: var(--ba-blue-dark);
    font-weight: 500;
}

/* ===== Toast ===== */
.error-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(74, 96, 117, 0.9);
    color: #fff;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: toastIn 0.3s ease;
    backdrop-filter: blur(8px);
}
@keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ===== Skeleton Loading ===== */
.skeleton {
    background: linear-gradient(90deg, rgba(200, 210, 220, 0.3) 25%, rgba(180, 195, 210, 0.4) 50%, rgba(200, 210, 220, 0.3) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
}
@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* ===== Conversation List ===== */
.conv-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.conv-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    border-radius: var(--ba-radius-lg);
    background: var(--ba-card-bg);
    backdrop-filter: blur(8px);
    border: 1px solid var(--ba-card-border);
    box-shadow: var(--ba-card-shadow);
    transition: all 0.35s ease;
    margin-bottom: 8px;
}
.conv-item:hover {
    box-shadow: var(--ba-card-shadow-hover);
    border-color: var(--ba-blue);
}

.conv-avatar-wrap { position: relative; flex-shrink: 0; }
.conv-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    background: rgba(126, 200, 227, 0.15);
}
.conv-avatar-group {
    background: rgba(126, 200, 227, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
}
.conv-avatar-group .material-symbols-outlined { font-size: 24px; color: var(--ba-blue-dark); }

.conv-info { flex: 1; min-width: 0; }
.conv-name-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.conv-name { font-weight: 500; font-size: 15px; color: var(--ba-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-time { font-size: 12px; color: var(--ba-text-light); flex-shrink: 0; margin-left: 8px; }
.conv-preview { display: flex; align-items: center; justify-content: space-between; }
.conv-preview-text { font-size: 13px; color: var(--ba-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.conv-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ba-pink); flex-shrink: 0; margin-left: 8px; }

/* ===== Chat Detail ===== */
.chat-detail { display: flex; flex-direction: column; flex: 1; overflow-y: auto; }
.chat-detail-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 1;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
}
.chat-detail-title { font-weight: 500; font-size: 16px; color: var(--ba-text); }
.chat-detail-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
    border: 2px solid rgba(126, 200, 227, 0.4);
}
.chat-detail-avatar:hover { border-color: var(--ba-blue); }

.chat-messages {
    flex: 1;
    padding: 12px 0 80px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.chat-msg-row { display: flex; align-items: flex-end; gap: 8px; max-width: 85%; }
.chat-msg-row.self { align-self: flex-end; flex-direction: row-reverse; }
.chat-msg-row.other { align-self: flex-start; }

.chat-msg-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.45;
    word-break: break-word;
}
.chat-msg-row.self .chat-msg-bubble {
    background: var(--ba-blue);
    color: #fff;
    border-bottom-right-radius: 4px;
}
.chat-msg-row.other .chat-msg-bubble {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ba-text);
    border: 1px solid rgba(150, 170, 190, 0.2);
    border-bottom-left-radius: 4px;
}
.chat-msg-time { font-size: 11px; opacity: 0.7; margin-top: 4px; }
.chat-msg-row.self .chat-msg-time { text-align: right; }

.chat-input-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: var(--content-max-width);
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(150, 170, 190, 0.15);
    z-index: 100;
    box-sizing: border-box;
}
.chat-input-bar textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    padding: 10px 14px;
    border-radius: 24px;
    background: rgba(240, 245, 250, 0.8);
    color: var(--ba-text);
    font-size: 14px;
    font-family: inherit;
    min-height: 20px;
    max-height: 100px;
    overflow-y: hidden;
    scrollbar-width: none;
    border: 1px solid rgba(150, 170, 190, 0.2);
}
.chat-input-bar textarea::-webkit-scrollbar { display: none; }
.chat-input-bar textarea::placeholder { color: var(--ba-text-light); }

.chat-msg-image { max-width: 220px; max-height: 220px; border-radius: 8px; cursor: pointer; display: block; }
.chat-msg-image:hover { opacity: 0.9; }

/* Group chat */
.chat-msg-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(126, 200, 227, 0.3);
}
.chat-msg-name { font-size: 12px; color: var(--ba-text-muted); margin-bottom: 2px; padding-left: 2px; line-height: 1.3; }

/* Group member selection */
.group-member-list { max-height: 240px; overflow-y: auto; margin-top: 8px; }
.group-member-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 4px;
    cursor: pointer;
    border-radius: 8px;
}
.group-member-item:hover { background: rgba(126, 200, 227, 0.08); }
.group-member-item img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.group-member-item .member-name { font-size: 14px; flex: 1; color: var(--ba-text); }

/* ===== Checkbox (custom) ===== */
.ba-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--ba-blue);
    cursor: pointer;
}

/* ===== Chat page full height ===== */
.main-content:has(.conv-list),
.main-content:has(.chat-detail) {
    display: flex;
    flex-direction: column;
    padding-top: 8px;
    height: 100vh;
    overflow: hidden;
    box-sizing: border-box;
}

/* ===== Reveal animation ===== */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ===== Responsive ===== */
@media (max-width: 720px) {
    .main-content { padding: 12px; padding-top: 80px; }
    .nav-btn { padding: 6px 12px; font-size: 13px; }
    .post-card { border-radius: 16px; padding: 16px; }
    .modal { border-radius: 16px; }
}

@media (max-width: 480px) {
    .nav-btn span { display: none; }
    .nav-btn .material-symbols-outlined { margin: 0; }
    .auth-tabs { font-size: 13px; }
}
```

- [ ] **Step 2: Verify CSS has no syntax errors**

Run in browser console or linter. Check that all braces are balanced and no typos.

- [ ] **Step 3: Commit**

```bash
git add web/style.css
git commit -m "style: rewrite CSS with Blue Archive theme (glassmorphism, gradient bg, soft palette)"
```

---

### Task 2: HTML Structure Rewrite

**Files:**
- Rewrite: `D:\code2026\crmoment\web\index.html`

**Key changes:**
- Remove MWC importmap and script
- Remove Material Icons and Roboto font CDN links
- Replace all MWC components with custom HTML elements
- Add material-symbols-outlined link for icons (keep using Google's Material Symbols for icon font)
- Use semantic custom classes matching the CSS from Task 1

- [ ] **Step 1: Write the complete HTML file**

Replace the entire `web/index.html` with the following structure. The key mappings:
- `md-icon-button` → `button.icon-btn`
- `md-filled-tonal-button` → `button.btn-primary`
- `md-text-button` → `button.btn-text`
- `md-filled-button` → `button.btn-primary`
- `md-outlined-button` → `button.btn-secondary`
- `md-outlined-text-field` → `input.field-input` with label
- `md-dialog` → `div.modal-overlay > div.modal`
- `md-circular-progress` → `div.spinner`
- `md-icon` → `span.material-symbols-outlined`
- `md-badge` → custom badge span
- `md-checkbox` → `input.ba-checkbox[type=checkbox]`

The HTML should include these sections:
1. `<head>`: charset, viewport, title, favicon, Material Symbols font link, custom CSS link
2. `<header id="app-bar">`: logo, theme toggle (hidden for light-only but keep element), auth/user buttons
3. `<div class="sub-nav">`: home, messages (hidden), profile (hidden), explore buttons
4. `<main class="main-content" id="main-content">`: dynamic content area
5. Auth modal (`#auth-dialog`)
6. Composer modal (`#composer-dialog`)
7. Notification modal (`#notif-dialog`)
8. Comment modal (`#comment-dialog`)
9. Image viewer modal (`#image-viewer-dialog`)
10. Create group modal (`#create-group-dialog`)
11. Add music modal (`#add-music-dialog`)
12. Search music modal (`#search-music-dialog`)
13. Script tag for `app.js` (type="module")

Each modal should use the `.modal-overlay` / `.modal` structure with `.modal-headline`, `.modal-content`, `.modal-actions`.

- [ ] **Step 2: Verify HTML structure**

Open in browser, confirm all elements render, no console errors about missing elements.

- [ ] **Step 3: Commit**

```bash
git add web/index.html
git commit -m "refactor: replace MWC components with custom HTML elements for BA theme"
```

---

### Task 3: JavaScript Rewrite

**Files:**
- Rewrite: `D:\code2026\crmoment\web\app.js`

**Key changes:**
- Remove `import '@material/web/all.js'` and typescale styles import
- Remove `fixButtonPadding()` and `setupPadObserver()`
- Replace all MWC DOM references with custom element selectors
- Replace `dialogOpen()`/`dialogClose()` with simple class toggle on `.modal-overlay`
- Update all render functions to output custom HTML (no MWC components)
- Remove `md-circular-progress` usage → use `div.spinner`
- Remove `md-icon` usage → use `span.material-symbols-outlined`
- Remove `md-badge` → use `span.notif-badge`
- Remove `md-checkbox` → use `input.ba-checkbox`
- Remove all `md-` prefixed selectors in `$$()` and `querySelector()` calls
- Keep all API calls, state management, and business logic unchanged

**DOM reference mapping (old → new):**

| Old selector | New selector |
|---|---|
| `$('#auth-dialog')` | `$('#auth-overlay')` |
| `$('#auth-title')` | `$('#auth-title')` (same) |
| `$('#auth-form')` | `$('#auth-form')` (same) |
| `$('#auth-username')` | `$('#auth-username')` (same) |
| `$('#auth-nickname')` | `$('#auth-nickname')` (same) |
| `$('#auth-password')` | `$('#auth-password')` (same) |
| `$('#auth-password-confirm')` | `$('#auth-password-confirm')` (same) |
| `$('#auth-error')` | `$('#auth-error')` (same) |
| `$('#auth-submit')` | `$('#auth-submit')` (same) |
| `$('#auth-cancel')` | `$('#auth-cancel')` (same) |
| `$('#auth-tab-login')` | `$('#auth-tab-login')` (same) |
| `$('#auth-tab-register')` | `$('#auth-tab-register')` (same) |
| `$('#btn-login')` | `$('#btn-login')` (same) |
| `$('#btn-theme-toggle')` | Remove (light only) |
| `$('#notif-badge')` | `$('#notif-badge')` (same) |
| `$('#btn-notifications')` | `$('#btn-notifications')` (same) |
| `$('#btn-user-avatar')` | `$('#btn-user-avatar')` (same) |
| `$('#composer-dialog')` | `$('#composer-overlay')` |
| `$('#composer-content')` | `$('#composer-content')` (same) |
| `$('#composer-submit')` | `$('#composer-submit')` (same) |
| `$('#composer-cancel')` | `$('#composer-cancel')` (same) |
| `$('#btn-add-image')` | `$('#btn-add-image')` (same) |
| `$('#composer-images-input')` | `$('#composer-images-input')` (same) |
| `$('#image-preview')` | `$('#image-preview')` (same) |
| `$('#image-count')` | `$('#image-count')` (same) |
| `$('#comment-dialog')` | `$('#comment-overlay')` |
| `$('#comment-title')` | `$('#comment-title')` (same) |
| `$('#comment-list')` | `$('#comment-list')` (same) |
| `$('#comment-input')` | `$('#comment-input')` (same) |
| `$('#comment-submit')` | `$('#comment-submit')` (same) |
| `$('#comment-cancel')` | `$('#comment-cancel')` (same) |
| `$('#notif-dialog')` | `$('#notif-overlay')` |
| `$('#notif-list')` | `$('#notif-list')` (same) |
| `$('#notif-read-all')` | `$('#notif-read-all')` (same) |
| `$('#notif-close')` | `$('#notif-close')` (same) |
| `$('#image-viewer-dialog')` | `$('#image-viewer-overlay')` |
| `$('#image-viewer-img')` | `$('#image-viewer-img')` (same) |
| `$('#image-viewer-close')` | `$('#image-viewer-close')` (same) |
| `$('#image-viewer-copy')` | `$('#image-viewer-copy')` (same) |
| `$('#image-viewer-open')` | `$('#image-viewer-open')` (same) |
| `$('#create-group-dialog')` | `$('#create-group-overlay')` |
| `$('#group-name-input')` | `$('#group-name-input')` (same) |
| `$('#group-member-list')` | `$('#group-member-list')` (same) |
| `$('#group-member-error')` | `$('#group-member-error')` (same) |
| `$('#create-group-submit')` | `$('#create-group-submit')` (same) |
| `$('#create-group-cancel')` | `$('#create-group-cancel')` (same) |
| `$('#add-music-dialog')` | `$('#add-music-overlay')` |
| `$('#search-music-dialog')` | `$('#search-music-overlay')` |
| `$('#music-search')` | `$('#music-search')` (same) |

**Render function HTML mapping (output changes):**

All render functions that output HTML must replace MWC components with custom elements:

- `<md-circular-progress indeterminate></md-circular-progress>` → `<div class="spinner"></div>`
- `<md-icon>xxx</md-icon>` → `<span class="material-symbols-outlined">xxx</span>`
- `<md-text-button>xxx</md-text-button>` → `<button class="btn-text">xxx</button>`
- `<md-filled-button>xxx</md-filled-button>` → `<button class="btn-primary">xxx</button>`
- `<md-outlined-button>xxx</md-outlined-button>` → `<button class="btn-secondary">xxx</button>`
- `<md-filled-tonal-button>xxx</md-filled-tonal-button>` → `<button class="btn-primary">xxx</button>`
- `<md-icon-button>xxx</md-icon-button>` → `<button class="icon-btn">xxx</button>`
- `<md-badge>xxx</md-badge>` → `<span class="notif-badge">xxx</span>` (style inline)
- `<md-checkbox ...></md-checkbox>` → `<input type="checkbox" class="ba-checkbox" ...>`

**dialogOpen/dialogClose replacement:**

```javascript
function dialogOpen(overlayEl) {
    if (overlayEl) {
        overlayEl.classList.add('open');
        document.body.classList.add('dialog-open');
    }
}
function dialogClose(overlayEl) {
    if (overlayEl) {
        overlayEl.classList.remove('open');
        document.body.classList.remove('dialog-open');
    }
}
```

**Reveal animation setup:**

Add at end of init:
```javascript
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
        }
    });
}, { threshold: 0.1 });
// Observe post cards as they're added
function observeRevealElements() {
    document.querySelectorAll('.post-card:not(.observed)').forEach(el => {
        el.classList.add('observed');
        revealObserver.observe(el);
    });
}
```

- [ ] **Step 1: Write the complete app.js file**

Rewrite the entire file with the changes described above. Preserve all API calls, state management, business logic, and functionality. Only change DOM selectors, render function HTML output, and remove MWC-specific code.

- [ ] **Step 2: Test all major flows**

Manual verification checklist:
- Login/register works
- Home feed loads and displays posts
- Post creation works (text + images)
- Like/comment works
- Navigation between pages works
- Chat list and chat detail work
- Music section loads
- Profile page loads
- Image viewer works
- Notifications load

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "refactor: rewrite app.js for custom components (remove MWC dependency)"
```

---

### Task 4: Landing Page Update

**Files:**
- Modify: `D:\code2026\crmoment\index.html`

Update the root landing page to match the BA color scheme:

- Replace `background: linear-gradient(135deg, #f5f0ff 0%, #fef7ff 50%, #f3e8fd 100%)` with `background: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%)`
- Replace `background-clip: text` gradient `#6750a4, #9c27b0` with `#4a9fc7, #7ec8e3`
- Replace button `background: #6750a4` with `background: #7ec8e3`
- Replace button hover shadow color
- Update subtitle color to `#5a6f84`
- Update footer color to `#a0b8cc`

- [ ] **Step 1: Update CSS colors in root index.html**

```html
<!-- Replace background gradient -->
background: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%);

<!-- Replace h1 gradient -->
background: linear-gradient(135deg, #4a9fc7, #7ec8e3);

<!-- Replace button background -->
background: #7ec8e3;

<!-- Replace button hover shadow -->
box-shadow: 0 4px 16px rgba(126, 200, 227, 0.4);

<!-- Replace subtitle color -->
color: #5a6f84;

<!-- Replace footer color -->
color: #a0b8cc;
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style: update landing page to Blue Archive color scheme"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Full manual test**

Open the site in browser and verify:
1. Landing page displays with BA gradient
2. Login/register works
3. Home feed loads with glassmorphism cards
4. Scroll reveal animations work
5. Post creation with images works
6. Like and comment work
7. Navigation between all pages works
8. Chat (list + detail) works
9. Music section loads
10. Profile page works (view/edit)
11. Image viewer works
12. Notifications load
13. Responsive at mobile breakpoints

- [ ] **Step 2: No console errors**

Check browser console for any errors.

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: BA redesign verification and cleanup"
```
