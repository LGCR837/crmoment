// ===== CRMoment Web App - Material Web Components SPA =====

// ---- MWC 组件导入 ----
// 参考 deepseek 示范文件：import all.js + typography 样式
import '@material/web/all.js';
import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';
document.adoptedStyleSheets.push(typescaleStyles.styleSheet);

// ===== 按钮间距修复：MWC 对中文按钮 padding 太窄，直接注入 shadow DOM =====
function fixButtonPadding() {
    const selectors = ['md-text-button', 'md-filled-button', 'md-outlined-button', 'md-filled-tonal-button'];
    for (const sel of selectors) {
        for (const btn of document.querySelectorAll(sel)) {
            if (btn.shadowRoot && !btn.dataset.padFixed) {
                btn.dataset.padFixed = '1';
                const style = document.createElement('style');
                // 有图标的按钮：leading 16px, trailing 24px
                // 无图标的按钮：leading/trailing 各 24px
                style.textContent = `
                    :host([has-icon]:not([trailing-icon])) {
                        padding-inline-start: 16px !important;
                        padding-inline-end: 24px !important;
                    }
                    :host(:not([has-icon])) {
                        padding-inline-start: 24px !important;
                        padding-inline-end: 24px !important;
                    }
                `;
                btn.shadowRoot.appendChild(style);
            }
        }
    }
}

// 页面变化后重新修复新创建的按钮
function setupPadObserver() {
    const observer = new MutationObserver(() => fixButtonPadding());
    observer.observe(document.body, { childList: true, subtree: true });
    fixButtonPadding();
}
const API_BASE = '/api.php?route=';

// ===== 状态管理 =====
const state = {
    user: null,               // 当前登录用户
    posts: [],                // 当前动态列表
    page: 1,                  // 当前页码
    hasMore: true,
    loading: false,
    currentPage: 'home',      // home / messages / profile / explore / user / chat
    viewUserId: null,         // 正在查看的用户 ID（当 currentPage === 'user'）
    commentPostId: null,      // 正在查看评论的动态 ID
    selectedImages: [],       // 待上传图片
    conversations: [],        // 会话列表
    currentConvId: null,      // 当前打开的会话 ID
    conversationMessages: {}, // { convId: [messages...] }
    pollingTimers: {},        // { convId: timerHandle }
};

// ===== DOM 引用 =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    main: $('#main-content'),
    authDialog: $('#auth-dialog'),
    authTitle: $('#auth-title'),
    authForm: $('#auth-form'),
    authUsername: $('#auth-username'),
    authNickname: $('#auth-nickname'),
    authPassword: $('#auth-password'),
    authPasswordConfirm: $('#auth-password-confirm'),
    authError: $('#auth-error'),
    authSubmit: $('#auth-submit'),
    authCancel: $('#auth-cancel'),
    authTabLogin: $('#auth-tab-login'),
    authTabRegister: $('#auth-tab-register'),
    btnLogin: $('#btn-login'),
    navAuth: $('#nav-auth'),
    navUser: $('#nav-user'),
    navProfile: $('#nav-profile'),
    userAvatarImg: $('#user-avatar-img'),
    btnNotifications: $('#btn-notifications'),
    notifBadge: $('#notif-badge'),
    btnThemeToggle: $('#btn-theme-toggle'),
    notifDialog: $('#notif-dialog'),
    notifList: $('#notif-list'),
    notifReadAll: $('#notif-read-all'),
    notifClose: $('#notif-close'),
    composerDialog: $('#composer-dialog'),
    composerContent: $('#composer-content'),
    composerSubmit: $('#composer-submit'),
    composerCancel: $('#composer-cancel'),
    btnAddImage: $('#btn-add-image'),
    composerImagesInput: $('#composer-images-input'),
    imagePreview: $('#image-preview'),
    imageCount: $('#image-count'),
    commentDialog: $('#comment-dialog'),
    commentTitle: $('#comment-title'),
    commentList: $('#comment-list'),
    commentInput: $('#comment-input'),
    commentSubmit: $('#comment-submit'),
    commentCancel: $('#comment-cancel'),
    imageViewerDialog: $('#image-viewer-dialog'),
    imageViewerImg: $('#image-viewer-img'),
    imageViewerClose: $('#image-viewer-close'),
    imageViewerCopy: $('#image-viewer-copy'),
    imageViewerOpen: $('#image-viewer-open'),
    createGroupDialog: $('#create-group-dialog'),
    groupNameInput: $('#group-name-input'),
    groupMemberList: $('#group-member-list'),
    groupMemberError: $('#group-member-error'),
    createGroupSubmit: $('#create-group-submit'),
    createGroupCancel: $('#create-group-cancel'),
    msgBadge: $('#msg-badge'),
    navMessages: $('#nav-messages'),
};

// ===== API 请求 =====
async function api(method, path, body = null) {
    const opts = {
        method,
        headers: {},
    };

    // 从 localStorage 读取 Token
    const token = localStorage.getItem('crmoment-token');

    if (body instanceof FormData) {
        // FormData 方式：把 token 作为字段追加进去
        if (token) {
            body.append('token', token);
        }
        opts.body = body;
    } else if (body !== null) {
        // JSON 方式：把 token 合并到 body 中
        if (token) {
            body.token = token;
        }
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    } else {
        // GET/DELETE 等无 body 的请求：把 token 拼到 URL 查询参数上
        if (token) {
            const sep = path.indexOf('?') === -1 ? '?' : '&';
            path = path + sep + 'token=' + encodeURIComponent(token);
        }
    }

    // 将 path 中的查询参数（?key=val）拆出来，附加到 API_BASE 末尾作为独立参数
    // 避免 ?route=/posts?page=1 这类错误的 URL
    let url = API_BASE;
    const qIdx = path.indexOf('?');
    if (qIdx !== -1) {
        url += path.substring(0, qIdx) + '&' + path.substring(qIdx + 1);
    } else {
        url += path;
    }

    const res = await fetch(url, opts);
    const data = await res.json();

    if (data.code !== 0) {
        throw new Error(data.message || '请求失败');
    }
    return data.data;
}

// ===== Toast 提示 =====
function showToast(msg) {
    const old = document.querySelector('.error-toast');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'error-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ===== MWC 对话框辅助 =====
let dialogCount = 0;
/** 所有已注册 close 事件监听的 dialog 集合，避免重复绑定 */
const dialogCloseListeners = new WeakSet();

function dialogOpen(el) {
    if (el && typeof el.show === 'function') {
        el.show();
        dialogCount++;
        document.body.classList.add('dialog-open');
        // 监听原生 close 事件（Escape 键关闭时会触发），确保 body class 被清理
        if (!dialogCloseListeners.has(el)) {
            el.addEventListener('close', () => {
                // MWC dialog 的 close 事件在 shadow DOM 内部 dialog 关闭时触发
                dialogCount--;
                if (dialogCount <= 0) {
                    dialogCount = 0;
                    document.body.classList.remove('dialog-open');
                }
            });
            dialogCloseListeners.add(el);
        }
        // 修正：MWC md-dialog 内部 <dialog> 使用 margin:inherit，
        // 但 :host 的 display:contents 使继承链断裂(<dialog> 从 <body> 继承 margin:0)，
        // 导致对话框出现在左上角。此处强制设置 margin:auto。
        requestAnimationFrame(() => {
            const dlg = el.shadowRoot?.querySelector('dialog');
            if (dlg) {
                dlg.style.margin = 'auto';
                dlg.style.maxWidth = '560px';
            }
        });
    }
}
function dialogClose(el) {
    if (el && typeof el.close === 'function') {
        el.close();
        dialogCount--;
        if (dialogCount <= 0) {
            dialogCount = 0;
            document.body.classList.remove('dialog-open');
        }
    }
}

// ===== 认证 =====
let authMode = 'login';

function switchAuthMode(mode) {
    authMode = mode;
    dom.authTitle.textContent = mode === 'login' ? '登录' : '注册';
    dom.authSubmit.label = mode === 'login' ? '登录' : '注册';
    dom.authTabLogin.classList.toggle('active', mode === 'login');
    dom.authTabRegister.classList.toggle('active', mode === 'register');
    dom.authError.style.display = 'none';
    dom.authPassword.value = '';
    dom.authPasswordConfirm.value = '';
    dom.authNickname.style.display = mode === 'register' ? '' : 'none';
    dom.authNickname.required = mode === 'register';
    dom.authPasswordConfirm.style.display = mode === 'register' ? '' : 'none';
    dom.authPasswordConfirm.required = mode === 'register';
}

dom.authTabLogin.addEventListener('click', () => switchAuthMode('login'));
dom.authTabRegister.addEventListener('click', () => switchAuthMode('register'));

dom.authSubmit.addEventListener('click', async () => {
    const username = dom.authUsername.value.trim();
    const password = dom.authPassword.value;
    const confirmPassword = dom.authPasswordConfirm.value;
    const nickname = dom.authNickname.value.trim();

    if (!username || !password) {
        dom.authError.textContent = '请填写用户名和密码';
        dom.authError.style.display = 'block';
        return;
    }

    if (authMode === 'register') {
        if (password !== confirmPassword) {
            dom.authError.textContent = '两次密码输入不一致';
            dom.authError.style.display = 'block';
            return;
        }
        if (!nickname) {
            dom.authError.textContent = '请填写昵称';
            dom.authError.style.display = 'block';
            return;
        }
    }

    try {
        const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
        const body = authMode === 'login'
            ? { username, password }
            : { username, nickname, password };
        const result = await api('POST', endpoint, body);

        // 保存 Token 到 localStorage
        if (result.token) {
            localStorage.setItem('crmoment-token', result.token);
        }

        state.user = result;
        updateAuthUI();
        dialogClose(dom.authDialog);
        dom.authError.style.display = 'none';
        dom.authUsername.value = '';
        dom.authPassword.value = '';
        dom.authPasswordConfirm.value = '';
        showToast(authMode === 'login' ? '登录成功' : '注册成功');
        renderHome();
    } catch (e) {
        dom.authError.textContent = e.message;
        dom.authError.style.display = 'block';
    }
});

dom.authCancel.addEventListener('click', () => dialogClose(dom.authDialog));

function updateAuthUI() {
    if (state.user) {
        dom.navAuth.style.display = 'none';
        dom.navUser.style.display = 'flex';
        dom.navProfile.style.display = '';
        dom.navMessages.style.display = '';
        dom.userAvatarImg.src = state.user.avatar || '/uploads/avatars/default.svg';
        dom.userAvatarImg.onerror = function() {
            const name = state.user.nickname || state.user.username;
            this.src = 'data:image/svg+xml,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill="#e0e0e0"/>
                    <text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">${name[0]}</text>
                </svg>`
            );
        };
    } else {
        dom.navAuth.style.display = 'flex';
        dom.navUser.style.display = 'none';
        dom.navProfile.style.display = 'none';
        dom.navMessages.style.display = 'none';
    }
}

// 登录按钮
dom.btnLogin.addEventListener('click', () => {
    switchAuthMode('login');
    dialogOpen(dom.authDialog);
});

// 退出
async function handleLogout() {
    try {
        await api('POST', '/auth/logout');
    } catch (_) {}
    // 停止聊天轮询
    stopAllPolling();
    // 清除 Token
    localStorage.removeItem('crmoment-token');
    state.user = null;
    updateAuthUI();
    showToast('已退出');
    renderHome();
}

// ===== 导航 =====
$$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        navigateTo(page);
    });
});

// 点击右上角头像跳转个人主页
const userAvatarBtn = $('#btn-user-avatar');
if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', () => {
        navigateTo('profile');
    });
}

function navigateTo(page) {
    state.currentPage = page;
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // 离开聊天详情时停止轮询
    if (page !== 'chat') {
        stopAllPolling();
    }

    switch (page) {
        case 'home': renderHome(); break;
        case 'messages': renderConversationList(); break;
        case 'profile': renderProfile(); break;
        case 'explore': renderExplore(); break;
        case 'chat':
            if (state.currentConvId) renderConversationDetail(state.currentConvId);
            break;
    }
}

// ===== 主页渲染 =====
async function renderHome() {
    state.page = 1;
    state.posts = [];
    state.hasMore = true;

    dom.main.innerHTML = `
        ${state.user ? `
        <div class="composer-card" id="composer-trigger">
            <img src="${state.user.avatar || '/uploads/avatars/default.svg'}" 
                 class="post-avatar" 
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#e0e0e0"/><text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">' + state.user.username[0] + '</text></svg>')}'">
            <div class="composer-placeholder">有什么新鲜事？</div>
        </div>
        ` : ''}
        <div class="section-title">最新动态</div>
        <div id="post-feed"></div>
        <div id="feed-status"></div>
    `;

    const trigger = $('#composer-trigger');
    if (trigger) {
        trigger.addEventListener('click', () => dialogOpen(dom.composerDialog));
    }

    await loadPosts();
}

async function loadPosts() {
    const feed = $('#post-feed');
    const status = $('#feed-status');
    if (!feed) return;

    if (state.loading) return;
    state.loading = true;

    // 显示加载指示
    if (state.page === 1) {
        status.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress></div>';
    } else {
        status.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress><div>加载中...</div></div>';
    }

    try {
        const data = await api('GET', `/posts?page=${state.page}&size=10`);
        state.posts = state.page === 1 ? data.list : [...state.posts, ...data.list];
        state.hasMore = data.has_more;

        renderPosts(feed);

        if (state.hasMore) {
            status.innerHTML = '<div class="loading-indicator" id="load-more-btn"><md-text-button>加载更多</md-text-button></div>';
            const loadMore = $('#load-more-btn');
            if (loadMore) {
                loadMore.addEventListener('click', () => {
                    state.page++;
                    loadPosts();
                });
            }
        } else {
            status.innerHTML = state.posts.length > 0
                ? '<div class="end-indicator">— 没有更多了 —</div>'
                : '<div class="end-indicator">暂无动态，快来发布第一条吧！</div>';
        }
    } catch (e) {
        status.innerHTML = `<div class="end-indicator">加载失败: ${e.message}</div>`;
    } finally {
        state.loading = false;
    }
}

function renderPosts(container) {
    if (state.posts.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = state.posts.map(post => renderPostCard(post)).join('\n');

    // 绑定事件
    container.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', () => handleLike(btn.dataset.postId));
    });
    container.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', () => openComments(btn.dataset.postId));
    });
    container.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                showToast('链接已复制到剪贴板');
            }).catch(() => {
                // 降级方案
                const ta = document.createElement('textarea');
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast('链接已复制到剪贴板');
            });
        });
    });
    container.querySelectorAll('.recall-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postId = btn.dataset.postId;
            if (!confirm('确定撤回这条动态？')) return;
            try {
                await api('DELETE', `/posts/${postId}`);
                showToast('已撤回');
                btn.closest('.post-card').remove();
                const idx = state.posts.findIndex(p => p.id == postId);
                if (idx !== -1) state.posts.splice(idx, 1);
            } catch (e) {
                showToast(e.message);
            }
        });
    });
    container.querySelectorAll('.post-images img').forEach(img => {
        img.addEventListener('click', () => openImageViewer(img.src));
    });
    container.querySelectorAll('.post-author, .post-avatar').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId) {
                navigateToUserProfile(parseInt(userId));
            }
        });
    });
}

// ===== 跳转到指定动态（支持懒加载） =====
async function scrollToPost(postId) {
    // 先检查是否已在 DOM 中
    let target = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!target) {
        // 尝试从 API 获取单条动态
        try {
            const post = await api('GET', `/posts/${postId}`);
            // 如果已在列表里则更新，否则插入到最前面
            const idx = state.posts.findIndex(p => p.id == postId);
            if (idx !== -1) {
                state.posts[idx] = post;
            } else {
                state.posts.unshift(post);
            }
            const feed = $('#post-feed');
            if (feed) renderPosts(feed);
        } catch (e) {
            showToast('无法找到该动态');
            return;
        }
        target = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (!target) {
            showToast('无法定位到该动态');
            return;
        }
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.boxShadow = '0 0 0 3px var(--md-sys-color-primary, #6750a4), var(--md-elevation-level2)';
    setTimeout(() => { target.style.boxShadow = ''; }, 3000);
}

function renderPostCard(post) {
    const time = formatTime(post.created_at);
    const images = post.images || [];
    const imageHtml = renderImages(images);
    const likedClass = post.is_liked ? 'liked' : '';
    const postUrl = `https://crmoment.ccwu.cc/web#${post.id}`;

    // 判断是否可撤回（自己的动态 & 8 分钟内）
    let canRecall = false;
    if (state.user) {
        const isOwner = String(post.user_id) === String(state.user.id);
        console.log('🔍 recall check:', { postId: post.id, postUserId: post.user_id, myUserId: state.user.id, isOwner, createdAt: post.created_at });
        if (isOwner) {
            const postTime = new Date(post.created_at?.replace(' ', 'T') + 'Z').getTime();
            const ageMs = Date.now() - postTime;
            const ageMin = Math.floor(ageMs / 60000);
            console.log('⏱ recall time:', { postTime, ageMs, ageMin, within8min: ageMs < 8 * 60 * 1000 });
            canRecall = ageMs < 8 * 60 * 1000;
        }
    }
    const recallHtml = canRecall ? `
            <button class="action-btn recall-btn" data-post-id="${post.id}">
                <md-icon>undo</md-icon>
                <span>撤回</span>
            </button>` : '';

    return `
    <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
            <img src="${post.avatar || '/uploads/avatars/default.svg'}" 
                 class="post-avatar" data-user-id="${post.user_id}"
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#e0e0e0"/><text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">' + (post.nickname || post.username)[0] + '</text></svg>')}'">
            <span class="post-author" data-user-id="${post.user_id}">${escapeHtml(post.nickname || post.username)}</span>
            <span class="post-badge">#${post.id}</span>
            <span class="post-time">${time}</span>
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${imageHtml}
        <div class="post-actions">
            <button class="action-btn like-btn ${likedClass}" data-post-id="${post.id}">
                <md-icon>${post.is_liked ? 'favorite' : 'favorite_border'}</md-icon>
                <span>${post.likes_count || 0}</span>
            </button>
            <button class="action-btn comment-btn" data-post-id="${post.id}">
                <md-icon>chat_bubble_outline</md-icon>
                <span>${post.comments_count || 0}</span>
            </button>
            ${recallHtml}
            <button class="action-btn share-btn" data-url="${postUrl}">
                <md-icon>share</md-icon>
                <span>分享</span>
            </button>
        </div>
    </div>`;
}

function renderImages(images) {
    if (!images || images.length === 0) return '';
    const cls = images.length === 1 ? 'post-images single' : 'post-images';
    return `<div class="${cls}">${images.map(img => `<img src="${img}" alt="图片" loading="lazy">`).join('\n')}</div>`;
}

// ===== 点赞 =====
async function handleLike(postId) {
    if (!state.user) {
        showToast('请先登录');
        return;
    }

    const post = state.posts.find(p => p.id == postId);
    if (!post) return;

    try {
        if (post.is_liked) {
            await api('DELETE', `/posts/${postId}/like`);
            post.is_liked = false;
            post.likes_count = Math.max(0, post.likes_count - 1);
        } else {
            await api('POST', `/posts/${postId}/like`);
            post.is_liked = true;
            post.likes_count = (post.likes_count || 0) + 1;
        }
        // 重新渲染当前可见卡片
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            const likeBtn = card.querySelector('.like-btn');
            if (likeBtn) {
                likeBtn.classList.toggle('liked', post.is_liked);
                likeBtn.querySelector('md-icon').textContent = post.is_liked ? 'favorite' : 'favorite_border';
                likeBtn.querySelector('span').textContent = post.likes_count;
            }
        }
    } catch (e) {
        showToast(e.message);
    }
}

// ===== 评论 =====
async function openComments(postId) {
    state.commentPostId = postId;
    dom.commentTitle.textContent = '评论';
    dom.commentList.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress></div>';
    dom.commentInput.value = '';
    dialogOpen(dom.commentDialog);

    try {
        const data = await api('GET', `/posts/${postId}/comments`);
        renderComments(data.list);
    } catch (e) {
        dom.commentList.innerHTML = `<div class="comment-empty">加载评论失败: ${e.message}</div>`;
    }
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        dom.commentList.innerHTML = '<div class="comment-empty">暂无评论，来写第一条吧</div>';
        return;
    }

    dom.commentList.innerHTML = comments.map(c => `
        <div class="comment-item">
            <img src="${c.avatar || '/uploads/avatars/default.svg'}" class="comment-avatar" data-user-id="${c.user_id}"
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e0e0e0"/><text x="16" y="21" text-anchor="middle" font-size="14" fill="#999">' + (c.nickname || c.username)[0] + '</text></svg>')}'">
            <div class="comment-body">
                <div class="comment-author" data-user-id="${c.user_id}">${escapeHtml(c.nickname || c.username)}</div>
                <div class="comment-text">${escapeHtml(c.content)}</div>
                <div class="comment-time">${formatTime(c.created_at)}</div>
                ${c.replies && c.replies.length > 0 ? c.replies.map(r => `
                    <div class="comment-item" style="margin-top:8px;padding-left:42px;border:none">
                        <img src="${r.avatar || '/uploads/avatars/default.svg'}" class="comment-avatar" data-user-id="${r.user_id}"
                             onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e0e0e0"/><text x="16" y="21" text-anchor="middle" font-size="14" fill="#999">' + (r.nickname || r.username)[0] + '</text></svg>')}'">
                        <div class="comment-body" style="margin-left:0">
                            <div class="comment-author" data-user-id="${r.user_id}">${escapeHtml(r.nickname || r.username)}</div>
                            <div class="comment-text">${escapeHtml(r.content)}</div>
                            <div class="comment-time">${formatTime(r.created_at)}</div>
                        </div>
                    </div>
                `).join('') : ''}
            </div>
        </div>
    `).join('\n');

    // 点击评论中的头像/用户名跳转到用户主页
    dom.commentList.querySelectorAll('.comment-avatar, .comment-author').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId) {
                dialogClose(dom.commentDialog);
                navigateToUserProfile(parseInt(userId));
            }
        });
    });
}

dom.commentSubmit.addEventListener('click', async () => {
    if (!state.user) {
        showToast('请先登录');
        return;
    }
    const content = dom.commentInput.value.trim();
    if (!content) {
        showToast('请输入评论内容');
        return;
    }
    try {
        await api('POST', `/posts/${state.commentPostId}/comments`, { content });
        dom.commentInput.value = '';
        showToast('评论成功');
        // 刷新评论
        const data = await api('GET', `/posts/${state.commentPostId}/comments`);
        renderComments(data.list);

        // 更新前端评论数
        const post = state.posts.find(p => p.id == state.commentPostId);
        if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            const card = document.querySelector(`.post-card[data-post-id="${state.commentPostId}"]`);
            if (card) {
                const countSpan = card.querySelector('.comment-btn span');
                if (countSpan) countSpan.textContent = post.comments_count;
            }
        }
    } catch (e) {
        showToast(e.message);
    }
});

dom.commentCancel.addEventListener('click', () => dialogClose(dom.commentDialog));

// ===== 发布动态 =====
let selectedFiles = [];

dom.btnAddImage.addEventListener('click', (e) => {
    e.preventDefault();
    dom.composerImagesInput.click();
});

dom.composerImagesInput.addEventListener('change', () => {
    const remain = 9 - selectedFiles.length;
    if (remain <= 0) {
        showToast('最多选择 9 张图片');
        dom.composerImagesInput.value = '';
        return;
    }
    const newFiles = Array.from(dom.composerImagesInput.files).slice(0, remain);
    selectedFiles = [...selectedFiles, ...newFiles];
    dom.imageCount.textContent = selectedFiles.length > 0 ? `${selectedFiles.length} 张图片` : '';

    // 追加新图片预览（可点击删除）
    const startIdx = selectedFiles.length - newFiles.length;
    const newPreviews = newFiles.map((f, i) => {
        const url = URL.createObjectURL(f);
        return `<div class="preview-item" data-idx="${startIdx + i}">
            <img src="${url}" alt="">
            <div class="preview-remove">×</div>
        </div>`;
    }).join('\n');
    dom.imagePreview.insertAdjacentHTML('beforeend', newPreviews);

    // 清空 input，允许重复选择同一文件
    dom.composerImagesInput.value = '';
});

// 点击预览图片删除
dom.imagePreview.addEventListener('click', (e) => {
    const item = e.target.closest('.preview-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx);
    // 从 selectedFiles 中移除
    selectedFiles.splice(idx, 1);
    // 从 DOM 移除
    item.remove();
    // 更新后续预览的 data-idx
    const items = dom.imagePreview.querySelectorAll('.preview-item');
    items.forEach((el, i) => el.dataset.idx = i);
    // 更新图片计数
    dom.imageCount.textContent = selectedFiles.length > 0 ? `${selectedFiles.length} 张图片` : '';
});

dom.composerSubmit.addEventListener('click', async () => {
    if (!state.user) {
        showToast('请先登录');
        return;
    }
    const content = dom.composerContent.value.trim();
    if (!content) {
        showToast('请输入内容');
        return;
    }

    const formData = new FormData();
    formData.append('content', content);
    selectedFiles.forEach(f => formData.append('images[]', f));

    dom.composerSubmit.label = '发布中...';
    dom.composerSubmit.disabled = true;

    try {
        await api('POST', '/posts', formData);
        dom.composerContent.value = '';
        selectedFiles = [];
        dom.composerImagesInput.value = '';
        dom.imagePreview.innerHTML = '';
        dom.imageCount.textContent = '';
        dialogClose(dom.composerDialog);
        showToast('发布成功');
        renderHome();
    } catch (e) {
        showToast(e.message);
    } finally {
        dom.composerSubmit.label = '发布';
        dom.composerSubmit.disabled = false;
    }
});

dom.composerCancel.addEventListener('click', () => {
    dialogClose(dom.composerDialog);
});

// ===== 图片查看器 =====
let _viewerImageSrc = '';

function openImageViewer(src) {
    _viewerImageSrc = src;
    dom.imageViewerImg.src = src;
    dialogOpen(dom.imageViewerDialog);
}
dom.imageViewerClose.addEventListener('click', () => dialogClose(dom.imageViewerDialog));

dom.imageViewerOpen.addEventListener('click', () => {
    if (_viewerImageSrc) {
        window.open(_viewerImageSrc, '_blank');
    }
});

dom.imageViewerCopy.addEventListener('click', async () => {
    if (!_viewerImageSrc) return;
    try {
        await navigator.clipboard.writeText(_viewerImageSrc);
        showToast('图片直链已复制到剪贴板');
    } catch (e) {
        showToast('复制失败');
    }
});

// ===== 通知 =====
dom.btnNotifications.addEventListener('click', () => {
    loadNotifications();
    dialogOpen(dom.notifDialog);
});

async function loadNotifications() {
    dom.notifList.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress></div>';
    try {
        const data = await api('GET', '/notifications');
        if (data.list.length === 0) {
            dom.notifList.innerHTML = '<div class="notif-empty">暂无通知</div>';
        } else {
            // 分组：未读和已读
            const unread = data.list.filter(n => !n.is_read);
            const read = data.list.filter(n => n.is_read);

            function renderNotifItems(items) {
                return items.map(n => {
                    const text = n.type === 'like' ? '赞了你的动态' :
                                 n.type === 'comment' ? '评论了你的动态' :
                                 '回复了你的评论';
                    return `
                    <div class="notif-item ${n.is_read ? '' : 'unread'}" data-post-id="${n.post_id || ''}">
                        <div class="notif-text">
                            <strong>${escapeHtml(n.actor_nickname || n.actor_username)}</strong> ${text}
                        </div>
                        <div class="notif-time">${formatTime(n.created_at)}</div>
                    </div>`;
                }).join('\n');
            }

            let html = '';
            if (unread.length > 0) {
                html += '<div class="notif-section-title">未读</div>';
                html += renderNotifItems(unread);
            }
            if (unread.length > 0 && read.length > 0) {
                html += '<div class="notif-divider"></div>';
            }
            if (read.length > 0) {
                html += '<div class="notif-section-title">已读</div>';
                html += renderNotifItems(read);
            }
            dom.notifList.innerHTML = html;

            // 点击通知跳转到对应动态
            dom.notifList.querySelectorAll('.notif-item').forEach(el => {
                el.style.cursor = 'pointer';
                el.addEventListener('click', () => {
                    const postId = el.dataset.postId;
                    if (!postId) return;
                    dialogClose(dom.notifDialog);
                    navigateTo('home');
                    scrollToPost(postId);
                });
            });
        }
        // 更新未读数量
        await checkUnread();
    } catch (e) {
        dom.notifList.innerHTML = `<div class="notif-empty">加载失败: ${e.message}</div>`;
    }
}

dom.notifReadAll.addEventListener('click', async () => {
    try {
        await api('PUT', '/notifications/read');
        dom.notifBadge.style.display = 'none';
        dom.notifList.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
        showToast('已全部标记已读');
    } catch (e) {
        showToast(e.message);
    }
});

dom.notifClose.addEventListener('click', () => dialogClose(dom.notifDialog));

async function checkUnread() {
    if (!state.user) return;
    try {
        const data = await api('GET', '/notifications/unread');
        dom.notifBadge.style.display = data.unread_count > 0 ? '' : 'none';
        dom.notifBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
    } catch (_) {}
}

// ===== 个人主页 =====
async function renderProfile() {
    if (!state.user) {
        dom.main.innerHTML = `
            <div class="section-title">我的</div>
            <div class="profile-header">
                <p style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;">请先登录以查看个人主页</p>
                <md-filled-button id="profile-login-btn">
                    <md-icon slot="icon">login</md-icon>
                    登录 / 注册
                </md-filled-button>
            </div>
        `;
        $('#profile-login-btn')?.addEventListener('click', () => {
            switchAuthMode('login');
            dialogOpen(dom.authDialog);
        });
        return;
    }

    dom.main.innerHTML = `
        <div class="profile-header">
            <img src="${state.user.avatar || '/uploads/avatars/default.svg'}" 
                 class="profile-avatar" id="profile-avatar-img"
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="#e0e0e0"/><text x="40" y="50" text-anchor="middle" font-size="30" fill="#999">' + (state.user.nickname || state.user.username)[0] + '</text></svg>')}'">
            <div class="profile-nickname" id="profile-nickname" contenteditable="true" data-original="${escapeHtml(state.user.nickname || state.user.username)}">
                ${escapeHtml(state.user.nickname || state.user.username)}
            </div>
            <div class="profile-username">@${escapeHtml(state.user.username)}</div>
            <div class="profile-bio" id="profile-bio" contenteditable="true" data-original="${escapeHtml(state.user.bio || '')}">
                ${state.user.bio ? escapeHtml(state.user.bio) : '这个人很懒，什么都没写...'}
            </div>
            <div class="profile-stats">
                <div class="stat"><div class="stat-num" id="profile-post-count">0</div><div class="stat-label">动态</div></div>
            </div>
            <div class="profile-edit-btn">
                <md-text-button id="btn-edit-avatar">
                    <md-icon slot="icon">photo_camera</md-icon>
                    更换头像
                </md-text-button>
                <md-text-button id="btn-logout" style="color:var(--md-sys-color-error);">
                    退出登录
                </md-text-button>
            </div>
            <input type="file" id="avatar-input" accept="image/*" style="display:none">
        </div>
        <div class="section-title">我的动态</div>
        <div id="my-posts"></div>
    `;

    // 退出登录
    $('#btn-logout')?.addEventListener('click', handleLogout);

    // 上传头像
    $('#btn-edit-avatar')?.addEventListener('click', () => $('#avatar-input').click());
    $('#avatar-input')?.addEventListener('change', async () => {
        const file = $('#avatar-input').files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const result = await api('POST', '/user/avatar', formData);
            state.user.avatar = result.avatar;
            updateAuthUI();
            $('#profile-avatar-img').src = result.avatar;
            showToast('头像更新成功');
        } catch (e) {
            showToast(e.message);
        }
    });

    // 修改简介
    const bioDiv = $('#profile-bio');
    if (bioDiv) {
        const saveBio = async () => {
            const newBio = bioDiv.innerText.trim();
            const originalBio = bioDiv.dataset.original;
            if (newBio === originalBio) return;
            try {
                const result = await api('POST', '/user/bio', { bio: newBio });
                state.user.bio = result.bio;
                bioDiv.dataset.original = newBio;
                showToast('简介已更新');
            } catch (e) {
                showToast(e.message);
                bioDiv.innerText = originalBio;
            }
        };
        bioDiv.addEventListener('blur', saveBio);
        bioDiv.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                bioDiv.blur();
            }
        });
    }

    // 修改昵称
    const nickDiv = $('#profile-nickname');
    if (nickDiv) {
        const saveNickname = async () => {
            const newNick = nickDiv.innerText.trim();
            const originalNick = nickDiv.dataset.original;
            if (newNick === originalNick) return;
            try {
                const result = await api('POST', '/user/nickname', { nickname: newNick });
                state.user.nickname = result.nickname;
                nickDiv.dataset.original = newNick;
                showToast('昵称已更新');
            } catch (e) {
                showToast(e.message);
                nickDiv.innerText = originalNick;
            }
        };
        nickDiv.addEventListener('blur', saveNickname);
        nickDiv.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nickDiv.blur();
            }
        });
    }

    // 加载用户动态
    try {
        const data = await api('GET', `/posts?page=1&size=20`);
        const myPosts = data.list.filter(p => p.user_id === state.user.id);
        const myPostsCount = myPosts.length;
        $('#profile-post-count').textContent = myPostsCount;

        if (myPosts.length === 0) {
            $('#my-posts').innerHTML = '<div class="end-indicator">还没有发布过动态</div>';
        } else {
            state.posts = myPosts;
            $('#my-posts').innerHTML = myPosts.map(p => renderPostCard(p)).join('\n');
            $('#my-posts').querySelectorAll('.like-btn').forEach(btn => {
                btn.addEventListener('click', () => handleLike(btn.dataset.postId));
            });
            $('#my-posts').querySelectorAll('.comment-btn').forEach(btn => {
                btn.addEventListener('click', () => openComments(btn.dataset.postId));
            });
            $('#my-posts').querySelectorAll('.recall-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const postId = btn.dataset.postId;
                    if (!confirm('确定撤回这条动态？')) return;
                    try {
                        await api('DELETE', `/posts/${postId}`);
                        showToast('已撤回');
                        btn.closest('.post-card').remove();
                        const idx = state.posts.findIndex(p => p.id == postId);
                        if (idx !== -1) state.posts.splice(idx, 1);
                    } catch (e) {
                        showToast(e.message);
                    }
                });
            });
            $('#my-posts').querySelectorAll('.post-images img').forEach(img => {
                img.addEventListener('click', () => openImageViewer(img.src));
            });
        }
    } catch (e) {
        $('#my-posts').innerHTML = `<div class="end-indicator">加载失败: ${e.message}</div>`;
    }
}

// ===== 用户详情页（查看他人主页） =====
function navigateToUserProfile(userId) {
    state.currentPage = 'user';
    state.viewUserId = userId;
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    renderUserProfile(userId);
}

async function renderUserProfile(userId) {
    dom.main.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress></div>';

    try {
        const [user, postsData] = await Promise.all([
            api('GET', `/user/${userId}`),
            api('GET', `/posts?page=1&size=20`),
        ]);

        const isSelf = state.user && state.user.id === userId;

        dom.main.innerHTML = `
            <div class="profile-header">
                <div class="user-profile-back">
                    <md-text-button id="btn-back-from-user">
                        <md-icon slot="icon">arrow_back</md-icon>
                        返回
                    </md-text-button>
                </div>
                <img src="${user.avatar || '/uploads/avatars/default.svg'}" 
                     class="profile-avatar"
                     onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="#e0e0e0"/><text x="40" y="50" text-anchor="middle" font-size="30" fill="#999">' + (user.nickname || user.username)[0] + '</text></svg>')}'">
                <div class="profile-nickname">${escapeHtml(user.nickname || user.username)}</div>
                <div class="profile-username">@${escapeHtml(user.username)}</div>
                <div class="profile-bio">${user.bio ? escapeHtml(user.bio) : '这个人很懒，什么都没写...'}</div>
                <div class="profile-stats">
                    <div class="stat"><div class="stat-num">${user.posts_count || 0}</div><div class="stat-label">动态</div></div>
                </div>
                ${!isSelf ? `
                <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
                    <md-filled-tonal-button id="btn-start-chat" data-user-id="${userId}">
                        <md-icon slot="icon">chat</md-icon>
                        发私信
                    </md-filled-tonal-button>
                </div>
                ` : ''}
            </div>
            <div class="section-title">${escapeHtml(user.nickname || user.username)} 的动态</div>
            <div id="user-posts"></div>
        `;

        $('#btn-back-from-user')?.addEventListener('click', () => {
            state.currentPage = 'home';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            const homeBtn = document.querySelector('.nav-btn[data-page="home"]');
            if (homeBtn) homeBtn.classList.add('active');
            renderHome();
        });

        $('#btn-start-chat')?.addEventListener('click', async () => {
            const otherUserId = parseInt($('#btn-start-chat').dataset.userId);
            if (!otherUserId) return;
            try {
                const result = await api('POST', '/conversations', { type: 'private', user_id: otherUserId });
                state.currentConvId = result.id;
                navigateTo('chat');
            } catch (e) {
                showToast(e.message);
            }
        });

        const userPosts = postsData.list.filter(p => p.user_id === userId);
        const container = $('#user-posts');
        if (userPosts.length === 0) {
            container.innerHTML = '<div class="end-indicator">还没有发布过动态</div>';
        } else {
            state.posts = userPosts;
            container.innerHTML = userPosts.map(p => renderPostCard(p)).join('\n');
            container.querySelectorAll('.like-btn').forEach(btn => {
                btn.addEventListener('click', () => handleLike(btn.dataset.postId));
            });
            container.querySelectorAll('.comment-btn').forEach(btn => {
                btn.addEventListener('click', () => openComments(btn.dataset.postId));
            });
            container.querySelectorAll('.recall-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const postId = btn.dataset.postId;
                    if (!confirm('确定撤回这条动态？')) return;
                    try {
                        await api('DELETE', `/posts/${postId}`);
                        showToast('已撤回');
                        btn.closest('.post-card').remove();
                        const idx = state.posts.findIndex(p => p.id == postId);
                        if (idx !== -1) state.posts.splice(idx, 1);
                    } catch (e) {
                        showToast(e.message);
                    }
                });
            });
            container.querySelectorAll('.post-images img').forEach(img => {
                img.addEventListener('click', () => openImageViewer(img.src));
            });
        }
    } catch (e) {
        dom.main.innerHTML = `
            <div class="profile-header">
                <div class="user-profile-back">
                    <md-text-button id="btn-back-from-user">
                        <md-icon slot="icon">arrow_back</md-icon>
                        返回
                    </md-text-button>
                </div>
                <p style="color:var(--md-sys-color-error);text-align:center;">加载失败: ${escapeHtml(e.message)}</p>
            </div>
        `;
        $('#btn-back-from-user')?.addEventListener('click', () => {
            state.currentPage = 'home';
            renderHome();
        });
    }
}

// ===== 发现页 =====
function renderExplore() {
    dom.main.innerHTML = `
        <div class="section-title">发现</div>
        <div class="card" style="background:var(--md-sys-color-surface-container-low);border-radius:16px;padding:24px;box-shadow:var(--md-elevation-level1);text-align:center;">
            <md-icon style="font-size:48px;color:var(--md-sys-color-primary);margin-bottom:12px;">explore</md-icon>
            <h3 style="margin-bottom:8px;">探索 CRMoment</h3>
            <p style="color:var(--md-sys-color-on-surface-variant);line-height:1.6;">
                一个轻量的动态分享社区。<br>
                浏览最新动态，分享你的生活瞬间。
            </p>
            <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                <md-filled-button id="explore-home-btn">
                    <md-icon slot="icon">home</md-icon>
                    去看看动态
                </md-filled-button>
                ${!state.user ? `
                <md-outlined-button id="explore-login-btn">
                    <md-icon slot="icon">login</md-icon>
                    登录体验更多
                </md-outlined-button>
                ` : ''}
            </div>
        </div>
    `;
    $('#explore-home-btn')?.addEventListener('click', () => navigateTo('home'));
    $('#explore-login-btn')?.addEventListener('click', () => {
        switchAuthMode('login');
        dialogOpen(dom.authDialog);
    });
}

// ===== 聊天子系统 =====

/**
 * 页面 A - 会话列表
 */
async function renderConversationList() {
    dom.main.innerHTML = '<div class="loading-indicator"><md-circular-progress indeterminate></md-circular-progress></div>';

    await loadConversations();

    dom.main.innerHTML = `
        <div class="conv-list-header">
            <div class="section-title" style="margin:0;">信息</div>
            <md-filled-tonal-button id="btn-create-group" style="--md-filled-tonal-button-container-shape:24px;">
                <md-icon slot="icon">group_add</md-icon>
                创建群聊
            </md-filled-tonal-button>
        </div>
        <div id="conv-list"></div>
    `;

    $('#btn-create-group')?.addEventListener('click', () => {
        openCreateGroupDialog();
    });

    if (state.conversations.length === 0) {
        $('#conv-list').innerHTML = '<div class="end-indicator">暂无会话</div>';
        return;
    }

    const listHtml = state.conversations.map(conv => renderConvItem(conv)).join('\n');
    $('#conv-list').innerHTML = listHtml;

    state.conversations.forEach(conv => {
        const el = document.getElementById(`conv-item-${conv.id}`);
        if (el) {
            el.addEventListener('click', () => {
                state.currentConvId = conv.id;
                navigateTo('chat');
            });
        }
    });
}

function renderConvItem(conv) {
    const lastMsg = conv.last_msg_id ? conv.last_msg_content : '';
    const lastMsgPreview = conv.last_msg_id
        ? (conv.last_msg_user_id && parseInt(conv.last_msg_user_id) !== (state.user?.id)
            ? `${conv.last_msg_nickname || conv.last_msg_username}: ${lastMsg}`
            : lastMsg)
        : '暂无消息';

    const timeStr = conv.updated_at ? formatTimeShort(conv.updated_at) : '';
    const unread = conv.unread_count > 0;

    if (conv.type === 'group') {
        return `
        <div class="conv-item" id="conv-item-${conv.id}">
            <div class="conv-avatar-wrap">
                <div class="conv-avatar conv-avatar-group">
                    <md-icon>group</md-icon>
                </div>
            </div>
            <div class="conv-info">
                <div class="conv-name-row">
                    <span class="conv-name">${escapeHtml(conv.display_name || conv.name || '群聊')}</span>
                    <span class="conv-time">${escapeHtml(timeStr)}</span>
                </div>
                <div class="conv-preview">
                    <span class="conv-preview-text">${escapeHtml(lastMsgPreview.slice(0, 50))}</span>
                    ${unread ? '<span class="conv-unread-dot"></span>' : ''}
                </div>
            </div>
        </div>`;
    }

    return `
    <div class="conv-item" id="conv-item-${conv.id}">
        <div class="conv-avatar-wrap">
            <img src="${conv.display_avatar || '/uploads/avatars/default.svg'}" 
                 class="conv-avatar"
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#e0e0e0"/><text x="24" y="30" text-anchor="middle" font-size="18" fill="#999">' + (conv.display_name || '?')[0] + '</text></svg>')}'">
        </div>
        <div class="conv-info">
            <div class="conv-name-row">
                <span class="conv-name">${escapeHtml(conv.display_name || '用户')}</span>
                <span class="conv-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="conv-preview">
                <span class="conv-preview-text">${escapeHtml(lastMsgPreview.slice(0, 50))}</span>
                ${unread ? '<span class="conv-unread-dot"></span>' : ''}
            </div>
        </div>
    </div>`;
}

async function loadConversations() {
    try {
        const data = await api('GET', '/conversations');
        state.conversations = data.list || [];
    } catch (e) {
        console.error('加载会话失败:', e);
        state.conversations = [];
    }
}

/**
 * 页面 B - 聊天详情
 */
async function renderConversationDetail(convId) {
    const conv = state.conversations.find(c => c.id === convId);

    // 如果会话不在本地列表中（例如从私聊按钮直接创建后跳转），尝试从 API 加载
    if (!conv) {
        try {
            await loadConversations();
            // 重新查找
            const found = state.conversations.find(c => c.id === convId);
            if (found) {
                return renderConversationDetail(convId); // 递归，这次能找到了
            }
        } catch (_) {}
        // 仍然没找到，用 convId 继续渲染，显示默认名称
    }

    const displayName = conv
        ? (conv.display_name || (conv.other_user?.nickname || conv.other_user?.username || '聊天'))
        : '聊天';
    const messages = state.conversationMessages[convId] || [];
    state.currentConvType = conv?.type || 'private';

    dom.main.innerHTML = `
        <div class="chat-detail">
            <div class="chat-detail-header">
                <md-icon-button id="btn-back-to-conv">
                    <md-icon>arrow_back</md-icon>
                </md-icon-button>
                <span class="chat-detail-title">${escapeHtml(displayName)}</span>
            </div>
            <div class="chat-messages" id="chat-messages">
                ${messages.length === 0 ? '<div class="end-indicator">暂无消息，发送第一条消息吧</div>' : ''}
                ${messages.map(m => renderChatMessage(m)).join('\n')}
            </div>
            <div class="chat-input-bar">
                <md-icon-button id="btn-chat-image" title="发送图片">
                    <md-icon>add_photo_alternate</md-icon>
                </md-icon-button>
                <input type="file" id="chat-image-input" accept="image/*" style="display:none">
                ${state.currentConvType === 'group' ? `
                <md-icon-button id="btn-chat-invite" title="邀请成员">
                    <md-icon>person_add</md-icon>
                </md-icon-button>` : ''}
                <textarea id="chat-input" placeholder="输入消息..." rows="1" maxlength="5000"></textarea>
                <md-filled-button id="btn-chat-send">
                    <md-icon slot="icon">send</md-icon>
                    发送
                </md-filled-button>
            </div>
        </div>
    `;

    // 返回按钮
    $('#btn-back-to-conv')?.addEventListener('click', () => {
        stopPolling(convId);
        navigateTo('messages');
    });

    // 发送消息
    const chatInput = $('#chat-input');
    const chatSend = $('#btn-chat-send');

    async function doSend() {
        const content = chatInput.value.trim();
        if (!content) return;
        chatInput.value = '';
        chatInput.style.height = 'auto';
        try {
            // 乐观更新
            const tempMsg = {
                id: Date.now(),
                user_id: state.user.id,
                content: content,
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nickname: state.user.nickname,
                username: state.user.username,
                avatar: state.user.avatar,
                _pending: true,
            };
            if (!state.conversationMessages[convId]) {
                state.conversationMessages[convId] = [];
            }
            state.conversationMessages[convId].push(tempMsg);
            appendChatMessage(tempMsg);
            scrollChatToBottom();

            const result = await api('POST', `/conversations/${convId}/messages`, { content });
            // 替换临时消息
            const msgs = state.conversationMessages[convId];
            const idx = msgs.findIndex(m => m._pending && m.id === tempMsg.id);
            if (idx !== -1) {
                msgs[idx] = result;
            }
            const msgEl = document.getElementById(`msg-${tempMsg.id}`);
            if (msgEl) {
                msgEl.outerHTML = renderChatMessage(result);
            }
        } catch (e) {
            showToast('发送失败: ' + e.message);
        }
    }

    chatSend?.addEventListener('click', doSend);
    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSend();
        }
    });

    // 自动调整输入框高度
    chatInput?.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });

    // 图片按钮 - 选择图片
    const chatImageBtn = $('#btn-chat-image');
    const chatImageInput = $('#chat-image-input');
    chatImageBtn?.addEventListener('click', () => {
        chatImageInput.click();
    });
    chatImageInput?.addEventListener('change', async () => {
        const file = chatImageInput.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            // 上传图片获取 URL
            const uploadResult = await api('POST', '/upload/image', formData);
            const imageUrl = uploadResult.url;

            // 作为图片消息发送
            const content = imageUrl;
            chatInput.value = '';
            chatInput.style.height = 'auto';

            const tempMsg = {
                id: Date.now(),
                user_id: state.user.id,
                content: content,
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nickname: state.user.nickname,
                username: state.user.username,
                avatar: state.user.avatar,
                _pending: true,
            };
            if (!state.conversationMessages[convId]) {
                state.conversationMessages[convId] = [];
            }
            state.conversationMessages[convId].push(tempMsg);
            appendChatMessage(tempMsg);
            scrollChatToBottom();

            const result = await api('POST', `/conversations/${convId}/messages`, { content });
            const msgs = state.conversationMessages[convId];
            const idx = msgs.findIndex(m => m._pending && m.id === tempMsg.id);
            if (idx !== -1) {
                msgs[idx] = result;
            }
            const msgEl = document.getElementById(`msg-${tempMsg.id}`);
            if (msgEl) {
                msgEl.outerHTML = renderChatMessage(result);
            }
        } catch (e) {
            showToast('图片发送失败: ' + e.message);
        }

        chatImageInput.value = '';
    });

    // 邀请按钮 - 拉人进群
    $('#btn-chat-invite')?.addEventListener('click', async () => {
        await showInviteDialog(convId);
    });

    // 点击消息中的用户头像 → 跳转个人主页
    if (state.currentConvType === 'group') {
        const msgContainer = $('#chat-messages');
        msgContainer?.addEventListener('click', (e) => {
            const avatar = e.target.closest('.chat-msg-avatar');
            if (avatar) {
                const userId = parseInt(avatar.dataset.userId);
                if (userId && userId !== state.user?.id) {
                    navigateToUserProfile(userId);
                }
            }
        });
    }

    // 加载历史消息（第一次进入时加载全部）
    if (!state.conversationMessages[convId] || state.conversationMessages[convId].length === 0) {
        try {
            const data = await api('GET', `/conversations/${convId}/messages?since_id=0`);
            state.conversationMessages[convId] = data.messages || [];
            const container = $('#chat-messages');
            if (container) {
                container.innerHTML = state.conversationMessages[convId].length === 0
                    ? '<div class="end-indicator">暂无消息，发送第一条消息吧</div>'
                    : state.conversationMessages[convId].map(m => renderChatMessage(m)).join('\n');
            }
            scrollChatToBottom();
        } catch (e) {
            console.error('加载消息失败:', e);
        }
    }

    // 标记已读
    try {
        await api('POST', `/conversations/${convId}/read`);
    } catch (_) {}

    // 开始轮询
    startPolling(convId);
}

function renderChatMessage(msg) {
    const isSelf = parseInt(msg.user_id) === state.user?.id;
    const isGroup = state.currentConvType === 'group';
    const time = msg.created_at ? formatChatTime(msg.created_at) : '';
    const pendingClass = msg._pending ? ' style="opacity:0.5;"' : '';

    let contentHtml;
    const content = msg.content || '';
    // 检测是否为图片 URL
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(content)
        && (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('/'));
    if (isImage) {
        contentHtml = `<img src="${content}" alt="图片" class="chat-msg-image" style="cursor:pointer">`;
    } else {
        contentHtml = `<div>${escapeHtml(content)}</div>`;
    }

    if (isGroup) {
        const avatarUrl = msg.avatar || '/uploads/avatars/default.svg';
        const displayName = msg.nickname || msg.username || '用户';
        if (isSelf) {
            return `
            <div class="chat-msg-row self group" id="msg-${msg.id}"${pendingClass}>
                <div class="chat-msg-bubble">
                    ${contentHtml}
                    <div class="chat-msg-time">${escapeHtml(time)}</div>
                </div>
            </div>`;
        } else {
            return `
            <div class="chat-msg-row other group" id="msg-${msg.id}"${pendingClass}>
                <img src="${avatarUrl}" alt="" class="chat-msg-avatar" data-user-id="${msg.user_id}" style="cursor:pointer" onerror="this.src='/uploads/avatars/default.svg'">
                <div>
                    <div class="chat-msg-name">${escapeHtml(displayName)}</div>
                    <div class="chat-msg-bubble">
                        ${contentHtml}
                        <div class="chat-msg-time">${escapeHtml(time)}</div>
                    </div>
                </div>
            </div>`;
        }
    }

    return `
    <div class="chat-msg-row ${isSelf ? 'self' : 'other'}" id="msg-${msg.id}"${pendingClass}>
        <div class="chat-msg-bubble">
            ${contentHtml}
            <div class="chat-msg-time">${escapeHtml(time)}</div>
        </div>
    </div>`;
}

function appendChatMessage(msg) {
    const container = $('#chat-messages');
    if (!container) return;
    // 移除 "暂无消息" 提示
    const empty = container.querySelector('.end-indicator');
    if (empty) empty.remove();
    container.insertAdjacentHTML('beforeend', renderChatMessage(msg));
}

function scrollChatToBottom() {
    const container = $('#chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * 轮询新消息
 */
function startPolling(convId) {
    stopPolling(convId); // 先停止旧的

    const timer = setInterval(async () => {
        const msgs = state.conversationMessages[convId] || [];
        const lastId = msgs.length > 0 ? Math.max(...msgs.filter(m => !m._pending).map(m => m.id)) : 0;

        try {
            const data = await api('GET', `/conversations/${convId}/messages?since_id=${lastId}`);
            const newMsgs = data.messages || [];
            if (newMsgs.length === 0) return;

            if (!state.conversationMessages[convId]) {
                state.conversationMessages[convId] = [];
            }

            // 去重，避免重复追加
            const existingIds = new Set(state.conversationMessages[convId].map(m => m.id));
            const toAdd = newMsgs.filter(m => !existingIds.has(m.id));

            if (toAdd.length === 0) return;

            state.conversationMessages[convId].push(...toAdd);
            toAdd.forEach(m => appendChatMessage(m));

            // 如果正在查看该会话则标记已读
            if (state.currentPage === 'chat' && state.currentConvId === convId) {
                scrollChatToBottom();
                try {
                    await api('POST', `/conversations/${convId}/read`);
                } catch (_) {}
            }

            // 同时刷新会话列表的未读数
            updateConvUnreadBadge();
        } catch (e) {
            console.error('轮询消息失败:', e);
        }
    }, 3000);

    state.pollingTimers[convId] = timer;
}

function stopPolling(convId) {
    if (state.pollingTimers[convId]) {
        clearInterval(state.pollingTimers[convId]);
        delete state.pollingTimers[convId];
    }
}

function stopAllPolling() {
    Object.keys(state.pollingTimers).forEach(convId => stopPolling(parseInt(convId)));
}

/**
 * 创建群聊对话框
 */
async function openCreateGroupDialog() {
    if (!state.user) return;

    // 加载用户列表 — 只显示和自己有私聊的用户
    try {
        // 确保会话列表已加载
        if (!state.conversations || state.conversations.length === 0) {
            await loadConversations();
        }

        // 从私聊中提取对方用户
        const userMap = new Map();
        for (const conv of state.conversations) {
            if (conv.type === 'private' && conv.other_user && conv.other_user.id !== state.user.id) {
                const u = conv.other_user;
                if (!userMap.has(u.id)) {
                    userMap.set(u.id, {
                        id: u.id,
                        nickname: u.nickname || u.username,
                        username: u.username,
                        avatar: u.avatar,
                    });
                }
            }
        }

        const allUsers = Array.from(userMap.values());

        dom.groupMemberList.innerHTML = allUsers.length === 0
            ? '<div class="end-indicator">暂无私聊用户</div>'
            : allUsers.map(u => `
                <label class="group-member-item">
                    <img src="${u.avatar || '/uploads/avatars/default.svg'}"
                         onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#e0e0e0"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="#999">' + (u.nickname || u.username)[0] + '</text></svg>')}'">
                    <span class="member-name">${escapeHtml(u.nickname || u.username)}</span>
                    <md-checkbox touch-target="wrapper" data-user-id="${u.id}"></md-checkbox>
                </label>
            `).join('');

        dialogOpen(dom.createGroupDialog);
    } catch (e) {
        showToast('加载用户列表失败: ' + e.message);
    }
}

// 创建群聊 - 提交
dom.createGroupSubmit?.addEventListener('click', async () => {
    const name = dom.groupNameInput.value.trim();
    if (!name) {
        dom.groupMemberError.textContent = '请输入群聊名称';
        dom.groupMemberError.style.display = 'block';
        return;
    }

    const allCheckboxes = dom.groupMemberList.querySelectorAll('md-checkbox');
    const checkedBoxes = Array.from(allCheckboxes).filter(cb => cb.checked);
    const userIds = checkedBoxes.map(cb => parseInt(cb.dataset.userId));

    if (userIds.length === 0) {
        dom.groupMemberError.textContent = '请至少选择一位成员';
        dom.groupMemberError.style.display = 'block';
        return;
    }

    dom.groupMemberError.style.display = 'none';

    try {
        const result = await api('POST', '/conversations', {
            type: 'group',
            name,
            user_ids: userIds,
        });
        dialogClose(dom.createGroupDialog);
        dom.groupNameInput.value = '';
        showToast('群聊创建成功');
        state.currentConvId = result.id;
        navigateTo('chat');
    } catch (e) {
        dom.groupMemberError.textContent = e.message;
        dom.groupMemberError.style.display = 'block';
    }
});

dom.createGroupCancel?.addEventListener('click', () => {
    dialogClose(dom.createGroupDialog);
    dom.groupNameInput.value = '';
    dom.groupMemberError.style.display = 'none';
});

/**
 * 显示群信息对话框（成员列表）
 */
async function showGroupInfoDialog(convId) {
    if (!state.user) return;

    try {
        const data = await api('GET', `/conversations/${convId}/members`);
        const members = data.members || [];

        // 创建对话框
        const dialog = document.createElement('md-dialog');
        dialog.id = 'group-info-dialog';

        const memberHtml = members.map(m => `
            <div class="group-member-item" style="cursor:pointer" data-user-id="${m.id}">
                <img src="${m.avatar || '/uploads/avatars/default.svg'}"
                     onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#e0e0e0"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="#999">' + (m.nickname || m.username)[0] + '</text></svg>')}'">
                <span class="member-name">${escapeHtml(m.nickname || m.username)}</span>
            </div>
        `).join('');

        dialog.innerHTML = `
            <div slot="headline">群成员 (${members.length}人)</div>
            <div slot="content" style="min-width:280px;">
                ${memberHtml || '<div class="end-indicator">暂无成员</div>'}
            </div>
            <div slot="actions">
                <md-text-button id="group-info-close">关闭</md-text-button>
            </div>
        `;

        document.body.appendChild(dialog);

        // 成员点击 - 进入个人主页
        dialog.addEventListener('click', (e) => {
            const item = e.target.closest('.group-member-item');
            if (item) {
                const userId = parseInt(item.dataset.userId);
                if (userId && userId !== state.user?.id) {
                    dialogClose(dialog);
                    dialog.remove();
                    navigateToUserProfile(userId);
                }
            }
        });

        dialog.querySelector('#group-info-close')?.addEventListener('click', () => {
            dialogClose(dialog);
            dialog.remove();
        });

        dialog.addEventListener('close', () => {
            dialog.remove();
        });

        dialogOpen(dialog);
    } catch (e) {
        showToast('加载群信息失败: ' + e.message);
    }
}

/**
 * 显示邀请成员对话框（拉人进群）
 */
async function showInviteDialog(convId) {
    if (!state.user) return;

    try {
        // 先获取现有成员
        const memberData = await api('GET', `/conversations/${convId}/members`);
        const existingIds = new Set((memberData.members || []).map(m => m.id));

        // 获取可选用户列表 — 从私聊中提取
        if (!state.conversations || state.conversations.length === 0) {
            await loadConversations();
        }

        const userMap = new Map();
        for (const conv of state.conversations) {
            if (conv.type === 'private' && conv.other_user && conv.other_user.id !== state.user.id) {
                const u = conv.other_user;
                if (!userMap.has(u.id)) {
                    userMap.set(u.id, {
                        id: u.id,
                        nickname: u.nickname || u.username,
                        username: u.username,
                        avatar: u.avatar,
                    });
                }
            }
        }

        // 过滤掉已在群中的用户
        const allUsers = Array.from(userMap.values()).filter(u => !existingIds.has(u.id));

        // 创建对话框
        const dialog = document.createElement('md-dialog');
        dialog.id = 'invite-dialog';

        dialog.innerHTML = `
            <div slot="headline">邀请成员</div>
            <div slot="content" style="min-width:300px;">
                <div id="invite-member-list" class="group-member-list">
                    ${allUsers.length === 0
                        ? '<div class="end-indicator">没有可邀请的用户</div>'
                        : allUsers.map(u => `
                            <label class="group-member-item">
                                <img src="${u.avatar || '/uploads/avatars/default.svg'}"
                                     onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#e0e0e0"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="#999">' + (u.nickname || u.username)[0] + '</text></svg>')}'">
                                <span class="member-name">${escapeHtml(u.nickname || u.username)}</span>
                                <md-checkbox touch-target="wrapper" data-user-id="${u.id}"></md-checkbox>
                            </label>
                        `).join('')}
                </div>
                <div id="invite-error" class="error-message" style="display:none"></div>
            </div>
            <div slot="actions">
                <md-text-button id="invite-cancel">取消</md-text-button>
                <md-filled-button id="invite-submit">邀请</md-filled-button>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('#invite-cancel')?.addEventListener('click', () => {
            dialogClose(dialog);
            dialog.remove();
        });

        dialog.querySelector('#invite-submit')?.addEventListener('click', async () => {
            const allCheckboxes = dialog.querySelectorAll('#invite-member-list md-checkbox');
            const checkedBoxes = Array.from(allCheckboxes).filter(cb => cb.checked);
            const userIds = checkedBoxes.map(cb => parseInt(cb.dataset.userId));

            if (userIds.length === 0) {
                dialog.querySelector('#invite-error').textContent = '请至少选择一位用户';
                dialog.querySelector('#invite-error').style.display = 'block';
                return;
            }

            dialog.querySelector('#invite-error').style.display = 'none';

            try {
                await api('POST', `/conversations/${convId}/members`, { user_ids: userIds });
                dialogClose(dialog);
                dialog.remove();
                showToast('邀请成功');
                // 刷新会话列表（更新成员信息）
                await loadConversations();
            } catch (e) {
                dialog.querySelector('#invite-error').textContent = e.message;
                dialog.querySelector('#invite-error').style.display = 'block';
            }
        });

        dialog.addEventListener('close', () => {
            dialog.remove();
        });

        dialogOpen(dialog);
    } catch (e) {
        showToast('加载用户列表失败: ' + e.message);
    }
}

/**
 * 检查未读会话并更新 badge
 */
async function checkUnreadConversations() {
    if (!state.user) return;
    try {
        const data = await api('GET', '/conversations/unread');
        const count = data.unread_count || 0;
        const badge = dom.msgBadge;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    } catch (_) {}
}

function updateConvUnreadBadge() {
    const totalUnread = state.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const badge = dom.msgBadge;
    if (totalUnread > 0) {
        badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * 格式化为简短时间（用于会话列表）
 */
function formatTimeShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) {
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }
    if (diff < 172800) return '昨天';
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;

    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
}

/**
 * 格式化为聊天时间（用于消息气泡）
 */
function formatChatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

// ===== 工具函数 =====
function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== 初始化 =====
async function init() {
    // 检查登录状态
    try {
        const user = await api('GET', '/user/me');
        state.user = user;
    } catch (_) {
        state.user = null;
    }
    updateAuthUI();

    // 渲染主页
    await renderHome();

    // 检查 hash 定位到指定动态
    const hash = window.location.hash.slice(1);
    if (hash && /^\d+$/.test(hash)) {
        await scrollToPost(hash);
    }

    // 定时检查未读通知
    if (state.user) {
        await checkUnread();
        setInterval(checkUnread, 30000);
        // 检查未读会话
        await checkUnreadConversations();
        setInterval(checkUnreadConversations, 30000);
    }

    // ===== 深色/浅色模式切换（支持设备系统自动适配） =====
    const themeToggle = dom.btnThemeToggle;
    const themeIcon = themeToggle.querySelector('md-icon');

    /** 获取当前应使用的主题：优先使用用户手动保存的，否则跟随系统 */
    function getEffectiveTheme() {
        const saved = localStorage.getItem('crmoment-theme');
        if (saved === 'dark' || saved === 'light') return saved;
        // 没有保存过 → 跟随系统
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    /** 应用主题到页面 */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeIcon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    }

    // 初始化主题
    applyTheme(getEffectiveTheme());

    // 用户手动切换
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('crmoment-theme', next);
    });

    // 监听系统主题变化（设备自动切换深色/浅色时实时响应）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 仅当用户没有手动存储过偏好时才跟随系统
        const saved = localStorage.getItem('crmoment-theme');
        if (saved !== 'dark' && saved !== 'light') {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

    console.log('CRMoment Web App 已启动');

    // 修复按钮间距（在 DOM 填充完毕后执行）
    setupPadObserver();
}

// 等待 DOM 加载后初始化
document.addEventListener('DOMContentLoaded', init);
