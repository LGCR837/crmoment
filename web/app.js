// ===== CRMoment Web App - Blue Archive Theme =====

const API_BASE = '/api.php?route=';

// ===== State Management =====
const state = {
    user: null,
    posts: [],
    page: 1,
    hasMore: true,
    loading: false,
    currentPage: 'home',
    viewUserId: null,
    music: [],
    musicSearchQuery: '',
    editingMusicId: null,
    commentPostId: null,
    replyTo: null, // { commentId, username }
    selectedImages: [],
    selectedVideos: [],
    conversations: [],
    currentConvId: null,
    currentConvType: 'private',
    conversationMessages: {},
    pollingTimers: {},
};

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    main: $('#main-content'),
    authOverlay: $('#auth-overlay'),
    authTitle: $('#auth-title'),
    authUsername: $('#auth-username'),
    authNickname: $('#auth-nickname'),
    authNicknameGroup: $('#auth-nickname-group'),
    authPassword: $('#auth-password'),
    authPasswordConfirm: $('#auth-password-confirm'),
    authPasswordConfirmGroup: $('#auth-password-confirm-group'),
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
    notifOverlay: $('#notif-overlay'),
    notifList: $('#notif-list'),
    notifReadAll: $('#notif-read-all'),
    notifClose: $('#notif-close'),
    composerOverlay: $('#composer-overlay'),
    composerContent: $('#composer-content'),
    composerSubmit: $('#composer-submit'),
    composerCancel: $('#composer-cancel'),
    btnAddImage: $('#btn-add-image'),
    composerImagesInput: $('#composer-images-input'),
    imagePreview: $('#image-preview'),
    imageCount: $('#image-count'),
    btnAddVideo: $('#btn-add-video'),
    composerVideosInput: $('#composer-videos-input'),
    videoPreview: $('#video-preview'),
    mediaCount: $('#media-count'),
    commentOverlay: $('#comment-overlay'),
    commentTitle: $('#comment-title'),
    commentList: $('#comment-list'),
    commentInput: $('#comment-input'),
    commentSubmit: $('#comment-submit'),
    commentCancel: $('#comment-cancel'),
    createGroupOverlay: $('#create-group-overlay'),
    groupNameInput: $('#group-name-input'),
    groupMemberList: $('#group-member-list'),
    groupMemberError: $('#group-member-error'),
    createGroupSubmit: $('#create-group-submit'),
    createGroupCancel: $('#create-group-cancel'),
    msgBadge: $('#msg-badge'),
    navMessages: $('#nav-messages'),
    addMusicOverlay: $('#add-music-overlay'),
    musicTitle: $('#music-title'),
    musicUrl: $('#music-url'),
    musicLrcUrl: $('#music-lrc-url'),
    musicBgUrl: $('#music-bg-url'),
    musicVideoUrl: $('#music-video-url'),
    addMusicError: $('#add-music-error'),
    addMusicSubmit: $('#add-music-submit'),
    addMusicCancel: $('#add-music-cancel'),
};

// ===== API Request =====
async function api(method, path, body = null) {
    const opts = { method, headers: {} };
    const token = localStorage.getItem('crmoment-token');

    if (body instanceof FormData) {
        if (token) body.append('token', token);
        opts.body = body;
    } else if (body !== null) {
        if (token) body.token = token;
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    } else {
        if (token) {
            const sep = path.indexOf('?') === -1 ? '?' : '&';
            path = path + sep + 'token=' + encodeURIComponent(token);
        }
    }

    let url = API_BASE;
    const qIdx = path.indexOf('?');
    if (qIdx !== -1) {
        url += path.substring(0, qIdx) + '&' + path.substring(qIdx + 1);
    } else {
        url += path;
    }

    const res = await fetch(url, opts);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || '请求失败');
    return data.data;
}

// ===== Toast =====
function showToast(msg) {
    const old = document.querySelector('.error-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'error-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ===== Modal Helpers =====
function getOpenOverlay() {
    return document.querySelector('.modal-overlay.open');
}
function dialogOpen(overlayEl) {
    if (overlayEl) {
        overlayEl.classList.add('open');
        document.body.classList.add('dialog-open');
        history.pushState({ dialog: true }, '');
    }
}
function dialogClose(overlayEl) {
    if (overlayEl) {
        overlayEl.classList.remove('open');
        document.body.classList.remove('dialog-open');
    }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
        dialogClose(e.target);
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = getOpenOverlay();
        if (overlay) dialogClose(overlay);
    }
});

// Close modal on phone back button
window.addEventListener('popstate', () => {
    const overlay = getOpenOverlay();
    if (overlay) dialogClose(overlay);
});

// ===== Icon Helper =====
function icon(name) {
    return `<span class="material-symbols-outlined">${name}</span>`;
}

// ===== Avatar Helper =====
const AVATAR_CDN_PRIMARY = '';
const AVATAR_CDN_FALLBACK = '';
const AVATAR_FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23e0e0e0'/%3E%3C/svg%3E";

function avatarSrc(path) {
    if (!path) return '/uploads/avatars/default.svg';
    if (path.startsWith('http')) return path;
    return AVATAR_CDN_PRIMARY + path;
}

function avatarOnerror(name) {
    const initial = (name || '?')[0];
    const fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#e0e0e0"/><text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">${initial}</text></svg>`);
    return `var s=this.src;if(s.indexOf('${AVATAR_CDN_PRIMARY}')!==-1){this.src=s.replace('${AVATAR_CDN_PRIMARY}','${AVATAR_CDN_FALLBACK}')}else{this.onerror=null;this.src='${fallbackSvg}'}`;
}

function retryArea(msg, retryFn) {
    if (!retryArea._counter) retryArea._counter = 0;
    const id = '_retry_' + (++retryArea._counter);
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.stopPropagation(); retryFn(); });
    }, 0);
    return `<div class="retry-area">${escapeHtml(msg)}<br><button class="btn-primary retry-btn" id="${id}">${icon('refresh')} 重试</button></div>`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制链接');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制链接');
    });
}

// ===== Auth =====
let authMode = 'login';

function switchAuthMode(mode) {
    authMode = mode;
    dom.authTitle.textContent = mode === 'login' ? '登录' : '注册';
    dom.authSubmit.textContent = mode === 'login' ? '登录' : '注册';
    dom.authTabLogin.classList.toggle('active', mode === 'login');
    dom.authTabRegister.classList.toggle('active', mode === 'register');
    dom.authError.style.display = 'none';
    dom.authPassword.value = '';
    dom.authPasswordConfirm.value = '';
    dom.authNicknameGroup.style.display = mode === 'register' ? '' : 'none';
    dom.authNickname.required = mode === 'register';
    dom.authPasswordConfirmGroup.style.display = mode === 'register' ? '' : 'none';
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
        const body = authMode === 'login' ? { username, password } : { username, nickname, password };
        const result = await api('POST', endpoint, body);
        if (result.token) localStorage.setItem('crmoment-token', result.token);
        state.user = result;
        updateAuthUI();
        dialogClose(dom.authOverlay);
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

dom.authCancel.addEventListener('click', () => dialogClose(dom.authOverlay));

function updateAuthUI() {
    if (state.user) {
        dom.navAuth.style.display = 'none';
        dom.navUser.style.display = 'flex';
        dom.navProfile.style.display = '';
        dom.navMessages.style.display = '';
        dom.userAvatarImg.src = avatarSrc(state.user.avatar);
        dom.userAvatarImg.onerror = function() { avatarOnerror.call(this, state.user.nickname || state.user.username); };
    } else {
        dom.navAuth.style.display = 'flex';
        dom.navUser.style.display = 'none';
        dom.navProfile.style.display = 'none';
        dom.navMessages.style.display = 'none';
    }
}

// ===== Theme Toggle (Dark / Light) =====
const THEME_STORAGE_KEY = 'crmoment-theme';
const logoEl = document.getElementById('app-logo');

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    }
    // Update logo — try dark logo first, fall back to light
    if (logoEl) {
        const src = theme === 'dark' ? 'crmomentlogodark.png' : 'crmomentlogo.png';
        logoEl.src = src;
        logoEl.onerror = function() {
            if (this.src.includes('crmomentlogodark.png')) {
                this.src = 'crmomentlogo.png';
            }
        };
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
}

function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
}

// Theme toggle button click listener
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
});

dom.btnLogin.addEventListener('click', () => {
    switchAuthMode('login');
    dialogOpen(dom.authOverlay);
});

async function handleLogout() {
    try { await api('POST', '/auth/logout'); } catch (_) {}
    stopAllPolling();
    localStorage.removeItem('crmoment-token');
    state.user = null;
    updateAuthUI();
    showToast('已退出');
    renderHome();
}

// ===== Navigation =====
$$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

const userAvatarBtn = $('#btn-user-avatar');
if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', () => navigateTo('profile'));
}

async function navigateTo(page) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    state.currentPage = page;
    window.location.hash = 'page:' + page;
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    if (page !== 'chat') stopAllPolling();
    switch (page) {
        case 'home': await renderHome(); break;
        case 'messages': await renderConversationList(); break;
        case 'profile': await renderProfile(); break;
        case 'explore': await renderExplore(); break;
        case 'chat':
            if (state.currentConvId) renderConversationDetail(state.currentConvId);
            break;
    }
}

function navigateToPost(postId) {
    openPostDetail(postId);
}

// ===== Home Page =====
async function renderHome() {
    state.page = 1;
    state.posts = [];
    state.hasMore = true;

    dom.main.innerHTML = `
        ${state.user ? `
        <div class="composer-card" id="composer-trigger">
            <img src="${avatarSrc(state.user.avatar)}" class="post-avatar"
                 onerror="${avatarOnerror(state.user.username)}">
            <div class="composer-placeholder">有什么新鲜事？</div>
        </div>` : ''}
        <div class="section-title">最新动态</div>
        <div id="post-feed"></div>
        <div id="feed-status"></div>
    `;

    $('#composer-trigger')?.addEventListener('click', () => dialogOpen(dom.composerOverlay));
    await loadPosts();
}

async function loadPosts() {
    const feed = $('#post-feed');
    const status = $('#feed-status');
    if (!feed) return;
    if (state.loading) return;
    state.loading = true;

    if (state.page === 1) {
        status.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    } else {
        status.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><div>加载中...</div></div>';
    }

    try {
        const data = await api('GET', `/posts?page=${state.page}&size=10`);
        state.hasMore = data.has_more;

        if (state.page === 1) {
            state.posts = data.list;
            renderPosts(feed);
        } else {
            const newPosts = data.list;
            state.posts = [...state.posts, ...newPosts];
            const html = newPosts.map(post => renderPostCard(post)).join('\n');
            feed.insertAdjacentHTML('beforeend', html);
            feed.querySelectorAll('.post-card:not([data-bound])').forEach(card => {
                card.dataset.bound = '1';
                bindPostCardEvents(card);
            });
            observeRevealElements();
        }

        if (state.hasMore) {
            status.innerHTML = '<div class="loading-indicator" id="load-more-btn"><button class="btn-text">加载更多</button></div>';
            $('#load-more-btn')?.addEventListener('click', () => { state.page++; loadPosts(); });
        } else {
            status.innerHTML = state.posts.length > 0
                ? '<div class="end-indicator">— 没有更多了 —</div>'
                : '<div class="end-indicator">暂无动态，快来发布第一条吧！</div>';
        }
    } catch (e) {
        status.innerHTML = retryArea('加载失败: ' + e.message, () => { state.page = 1; state.posts = []; state.hasMore = true; loadPosts(); });
    } finally {
        state.loading = false;
    }
}

function bindPostCardEvents(card) {
    card.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLike(btn.dataset.postId);
        });
    });
    card.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openComments(btn.dataset.postId);
        });
    });
    card.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(btn.dataset.url);
        });
    });
    card.querySelectorAll('.recall-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('确定撤回这条动态？')) return;
            try {
                await api('DELETE', `/posts/${btn.dataset.postId}`);
                showToast('已撤回');
                btn.closest('.post-card').remove();
                const idx = state.posts.findIndex(p => p.id == btn.dataset.postId);
                if (idx !== -1) state.posts.splice(idx, 1);
            } catch (e) { showToast(e.message); }
        });
    });
    card.querySelectorAll('.post-images img').forEach(img => {
        bindImageEvents(img);
    });
    card.querySelectorAll('.post-author, .post-avatar').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId) navigateToUserProfile(parseInt(userId));
        });
    });
    // Click on card body (not on action buttons) opens detail page
    card.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn, .post-author, .post-avatar, .post-images img, .video-link');
        if (target) return;
        openPostDetail(card.dataset.postId);
    });
}

function renderPosts(container) {
    if (state.posts.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = state.posts.map(post => renderPostCard(post)).join('\n');
    container.querySelectorAll('.post-card').forEach(card => bindPostCardEvents(card));
    observeRevealElements();
}

async function scrollToPost(postId) {
    let target = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!target) {
        try {
            const post = await api('GET', `/posts/${postId}`);
            const idx = state.posts.findIndex(p => p.id == postId);
            if (idx !== -1) state.posts[idx] = post; else state.posts.unshift(post);
            const feed = $('#post-feed');
            if (feed) renderPosts(feed);
        } catch (e) { showToast('无法找到该动态'); return; }
        target = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (!target) { showToast('无法定位到该动态'); return; }
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.boxShadow = '0 0 0 3px var(--ba-blue), var(--ba-card-shadow-hover)';
    target.style.borderColor = 'var(--ba-blue)';
    setTimeout(() => { target.style.boxShadow = ''; target.style.borderColor = ''; }, 3000);
}

function renderPostCard(post) {
    const time = formatTime(post.created_at);
    const images = post.images || [];
    const videos = post.videos || [];
    const videoHtml = renderVideos(videos);
    const imageHtml = renderImages(images);
    const likedClass = post.is_liked ? 'liked' : '';
    const postUrl = `${window.location.origin}/web#post:${post.id}`;
    const badgeText = post.is_pinned ? `#TOP${post.id}` : `#${post.id}`;

    let canRecall = false;
    if (state.user) {
        const isOwner = String(post.user_id) === String(state.user.id);
        if (isOwner) {
            const postTime = new Date(post.created_at?.replace(' ', 'T') + 'Z').getTime();
            canRecall = (Date.now() - postTime) < 24 * 60 * 60 * 1000;
        }
    }
    const recallHtml = canRecall ? `
        <button class="action-btn recall-btn" data-post-id="${post.id}">
            ${icon('undo')}<span>撤回</span>
        </button>` : '';

    return `
    <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
            <img src="${avatarSrc(post.avatar)}" class="post-avatar" data-user-id="${post.user_id}"
                 onerror="${avatarOnerror(post.nickname || post.username)}">
            <span class="post-author" data-user-id="${post.user_id}">${escapeHtml(post.nickname || post.username)}</span>
            <span class="post-badge">${badgeText}</span>
            <span class="post-time">${time}</span>
        </div>
        <div class="post-content">${renderTextWithLinks(post.content)}</div>
        ${videoHtml}
        ${imageHtml}
        <div class="post-actions">
            <button class="action-btn like-btn ${likedClass}" data-post-id="${post.id}">
                ${icon(post.is_liked ? 'favorite' : 'favorite_border')}
                <span>${post.likes_count || 0}</span>
            </button>
            <button class="action-btn comment-btn" data-post-id="${post.id}">
                ${icon('chat_bubble_outline')}
                <span class="comment-count">${post.comments_count || 0}</span>
            </button>
            ${recallHtml}
            <button class="action-btn share-btn" data-url="${postUrl}">
                ${icon('share')}<span>分享</span>
            </button>
        </div>
    </div>`;
}

function renderImages(images) {
    if (!images || images.length === 0) return '';
    const cls = images.length === 1 ? 'post-images single' : 'post-images';
    return `<div class="${cls}">${images.map(img => `<img src="${img}" alt="图片" loading="lazy">`).join('\n')}</div>`;
}

function renderVideos(videos) {
    if (!videos || videos.length === 0) return '';
    const placeholderSrc = 'video.png';
    return `<div class="post-videos single">${videos.map(v => `<a href="${v}" target="_blank" rel="noopener" class="video-link"><img src="${placeholderSrc}" alt="视频" loading="lazy" class="video-placeholder"></a>`).join('\n')}</div>`;
}

// ===== Like =====
async function handleLike(postId) {
    if (!state.user) { showToast('请先登录'); return; }
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
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            const likeBtn = card.querySelector('.like-btn');
            if (likeBtn) {
                likeBtn.classList.toggle('liked', post.is_liked);
                likeBtn.querySelector('.material-symbols-outlined').textContent = post.is_liked ? 'favorite' : 'favorite_border';
                likeBtn.querySelector('span:last-child').textContent = post.likes_count;
            }
        }
    } catch (e) { showToast(e.message); }
}

// ===== Comments =====
function clearReply() {
    state.replyTo = null;
    const modalBar = $('#comment-reply-bar');
    if (modalBar) modalBar.style.display = 'none';
    const detailBar = $('#detail-reply-bar');
    if (detailBar) detailBar.style.display = 'none';
}

async function openComments(postId) {
    state.commentPostId = postId;
    clearReply();
    dom.commentTitle.textContent = '评论';
    dom.commentList.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    dom.commentInput.value = '';
    dialogOpen(dom.commentOverlay);
    try {
        const data = await api('GET', `/posts/${postId}/comments`);
        renderComments(data.list);
    } catch (e) {
        dom.commentList.innerHTML = retryArea('加载评论失败: ' + e.message, () => openComments(state.commentPostId || postId));
    }
}

function canRecallComment(createdAt, userId) {
    if (!state.user) return false;
    if (String(userId) !== String(state.user.id)) return false;
    const d = new Date(createdAt.replace(' ', 'T') + 'Z');
    return (Date.now() - d.getTime()) < 72 * 60 * 60 * 1000;
}

function recallCommentHtml(commentId, createdAt, userId) {
    if (!canRecallComment(createdAt, userId)) return '';
    return `<span class="comment-recall-btn" data-comment-id="${commentId}">撤回</span>`;
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        dom.commentList.innerHTML = '<div class="comment-empty">暂无评论，来写第一条吧</div>';
        return;
    }

    // 展平：将回复作为独立评论，内容前加 @父评论作者
    const flat = [];
    comments.forEach(c => {
        flat.push(c);
        if (c.replies && c.replies.length > 0) {
            const parentName = escapeHtml(c.nickname || c.username);
            c.replies.forEach(r => {
                flat.push({
                    ...r,
                    _replyTo: parentName,
                    _replyToUserId: c.user_id,
                });
            });
        }
    });

    dom.commentList.innerHTML = flat.map(c => `
        <div class="comment-item">
            <img src="${avatarSrc(c.avatar)}" class="comment-avatar" data-user-id="${c.user_id}"
                 onerror="${avatarOnerror(c.nickname || c.username)}">
            <div class="comment-body">
                <div class="comment-author" data-user-id="${c.user_id}">${escapeHtml(c.nickname || c.username)}</div>
                <div class="comment-text">${c._replyTo ? `<span class="reply-at" data-user-id="${c._replyToUserId}">@${c._replyTo}</span> ` : ''}${renderTextWithLinks(c.content)}</div>
                <div class="comment-time">
                    ${formatTime(c.created_at)}
                    <button class="comment-reply-btn" data-comment-id="${c.id}" data-username="${escapeHtml(c.nickname || c.username)}">回复</button>
                    ${recallCommentHtml(c.id, c.created_at, c.user_id)}
                </div>
            </div>
        </div>
    `).join('\n');

    dom.commentList.querySelectorAll('.comment-avatar, .comment-author').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId) { dialogClose(dom.commentOverlay); navigateToUserProfile(parseInt(userId)); }
        });
    });

    // 评论回复按钮
    dom.commentList.querySelectorAll('.comment-reply-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const commentId = parseInt(btn.dataset.commentId);
            const username = btn.dataset.username;
            state.replyTo = { commentId, username };
            $('#comment-reply-username').textContent = username;
            $('#comment-reply-bar').style.display = 'flex';
            dom.commentInput.focus();
        });
    });

    // 回复@点击跳转
    dom.commentList.querySelectorAll('.reply-at').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId) { dialogClose(dom.commentOverlay); navigateToUserProfile(parseInt(userId)); }
        });
    });

    // 评论撤回事件
    dom.commentList.querySelectorAll('.comment-recall-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const commentId = btn.dataset.commentId;
            if (!confirm('确定撤回这条评论？')) return;
            try {
                await api('DELETE', `/comments/${commentId}`);
                showToast('已撤回');
                const data = await api('GET', `/posts/${state.commentPostId}/comments`);
                renderComments(data.list);
                const post = state.posts.find(p => p.id == state.commentPostId);
                if (post) {
                    post.comments_count = (post.comments_count || 0) - 1;
                    const card = document.querySelector(`.post-card[data-post-id="${state.commentPostId}"]`);
                    if (card) {
                        const countSpan = card.querySelector('.comment-btn .comment-count');
                        if (countSpan) countSpan.textContent = Math.max(0, post.comments_count);
                    }
                }
            } catch (e) {
                showToast(e.message);
            }
        });
    });
}

// ===== Post Detail Page =====
async function openPostDetail(postId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    state.currentPage = 'post';
    window.location.hash = 'post:' + postId;
    $$('.nav-btn').forEach(b => b.classList.remove('active'));

    dom.main.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    try {
        const post = await api('GET', `/posts/${postId}`);
        const time = formatTime(post.created_at);
        const username = post.nickname || post.username || '匿名';
        const images = post.images || [];
        const videos = post.videos || [];
        const videoHtml = renderVideos(videos);
        const imageHtml = renderImages(images);
        const likedClass = post.is_liked ? 'liked' : '';

        let canRecall = false;
        if (state.user) {
            const isOwner = String(post.user_id) === String(state.user.id);
            if (isOwner) {
                const postTime = new Date(post.created_at?.replace(' ', 'T') + 'Z').getTime();
                canRecall = (Date.now() - postTime) < 24 * 60 * 60 * 1000;
            }
        }
        const recallHtml = canRecall ? `
            <button class="action-btn recall-btn" data-post-id="${post.id}">
                ${icon('undo')}<span>撤回</span>
            </button>` : '';
        const detailPostUrl = `${window.location.origin}/web#post:${post.id}`;

        dom.main.innerHTML = `
            <div class="post-detail-card">
                <div class="post-detail-header">
                    <button class="btn-icon" id="btn-back-detail">${icon('arrow_back')}</button>
                    <img src="${avatarSrc(post.avatar)}" class="post-avatar" data-user-id="${post.user_id}"
                         onerror="${avatarOnerror(username)}">
                    <span class="post-author" data-user-id="${post.user_id}">${escapeHtml(username)}</span>
                    <span class="post-badge">#${post.id}</span>
                    <span class="post-time">${time}</span>
                </div>
                <div class="post-detail-content">${renderTextWithLinks(post.content)}</div>
                ${videoHtml}
                ${imageHtml}
                <div class="post-detail-actions">
                    <button class="action-btn like-btn ${likedClass}" data-post-id="${post.id}">
                        ${icon(post.is_liked ? 'favorite' : 'favorite_border')}
                        <span>${post.likes_count || 0}</span>
                    </button>
                    <button class="action-btn comment-btn" data-post-id="${post.id}">
                        ${icon('chat_bubble_outline')}
                        <span>${post.comments_count || 0}</span>
                    </button>
                    <button class="action-btn share-btn" data-url="${detailPostUrl}">
                        ${icon('share')}<span>分享</span>
                    </button>
                    ${recallHtml}
                </div>
            </div>
            <div class="detail-comments-section">
                <div class="section-title">评论</div>
                <div id="detail-comment-list" class="detail-comment-list"></div>
                <div class="detail-reply-bar" id="detail-reply-bar" style="display:none">
                    <span class="reply-indicator">回复 <span id="detail-reply-username"></span></span>
                    <button class="btn-text" id="detail-reply-cancel">取消</button>
                </div>
                <div class="detail-comment-input-bar">
                    <textarea id="detail-comment-input" placeholder="写评论..." rows="1"></textarea>
                    <button class="btn-primary" id="detail-comment-send">${icon('send')}</button>
                </div>
            </div>
        `;

        // Back button
        $('#btn-back-detail')?.addEventListener('click', () => navigateTo('home'));

        // Author click
        dom.main.querySelectorAll('.post-author, .post-avatar').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = el.dataset.userId;
                if (userId) navigateToUserProfile(parseInt(userId));
            });
        });

        // Like button
        const likeBtn = dom.main.querySelector('.like-btn');
        likeBtn?.addEventListener('click', async () => {
            if (!state.user) { showToast('请先登录'); return; }
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
                likeBtn.classList.toggle('liked', post.is_liked);
                likeBtn.querySelector('.material-symbols-outlined').textContent = post.is_liked ? 'favorite' : 'favorite_border';
                likeBtn.querySelector('span:last-child').textContent = post.likes_count;
            } catch (e) { showToast(e.message); }
        });

        // Recall button
        dom.main.querySelector('.recall-btn')?.addEventListener('click', async () => {
            if (!confirm('确定撤回这条动态？')) return;
            try {
                await api('DELETE', `/posts/${postId}`);
                showToast('已撤回');
                navigateTo('home');
            } catch (e) { showToast(e.message); }
        });

        // Share button
        dom.main.querySelector('.share-btn')?.addEventListener('click', (e) => {
            copyToClipboard(e.currentTarget.dataset.url);
        });

        // Detail reply cancel
        $('#detail-reply-cancel')?.addEventListener('click', clearReply);

        // Comment send
        const commentSend = $('#detail-comment-send');
        const commentInput = $('#detail-comment-input');
        commentSend?.addEventListener('click', async () => {
            if (!state.user) { showToast('请先登录'); return; }
            const content = commentInput.value.trim();
            if (!content) { showToast('请输入评论内容'); return; }
            try {
                const body = { content };
                if (state.replyTo) body.parent_id = state.replyTo.commentId;
                await api('POST', `/posts/${postId}/comments`, body);
                commentInput.value = '';
                clearReply();
                showToast('评论成功');
                loadDetailComments(postId);
                // Update comment count in the detail page
                post.comments_count = (post.comments_count || 0) + 1;
                const countSpan = dom.main.querySelector('.comment-btn span:last-child');
                if (countSpan) countSpan.textContent = post.comments_count;
            } catch (e) { showToast(e.message); }
        });
        commentInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commentSend?.click(); }
        });

        // Bind images
        dom.main.querySelectorAll('.post-images img').forEach(img => bindImageEvents(img));

        loadDetailComments(postId);
    } catch (e) {
        dom.main.innerHTML = `
            <div class="retry-area">
                加载失败: ${escapeHtml(e.message)}<br>
                <button class="btn-primary retry-btn" id="btn-back-detail-error">${icon('arrow_back')} 返回</button>
            </div>`;
        $('#btn-back-detail-error')?.addEventListener('click', () => navigateTo('home'));
    }
}

async function loadDetailComments(postId) {
    const container = $('#detail-comment-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    try {
        const data = await api('GET', `/posts/${postId}/comments`);
        const comments = data.list || [];
        if (comments.length === 0) {
            container.innerHTML = '<div class="detail-comment-empty">暂无评论，来写第一条吧</div>';
            return;
        }

        // 展平：将回复作为独立评论，内容前加 @父评论作者
        const flat = [];
        comments.forEach(c => {
            flat.push(c);
            if (c.replies && c.replies.length > 0) {
                const parentName = escapeHtml(c.nickname || c.username);
                c.replies.forEach(r => {
                    flat.push({
                        ...r,
                        _replyTo: parentName,
                        _replyToUserId: c.user_id,
                    });
                });
            }
        });

        container.innerHTML = flat.map(c => `
            <div class="detail-comment-item">
                <img src="${avatarSrc(c.avatar)}" class="detail-comment-avatar" data-user-id="${c.user_id}"
                     onerror="${avatarOnerror(c.nickname || c.username)}">
                <div class="detail-comment-body">
                    <div class="detail-comment-author" data-user-id="${c.user_id}">${escapeHtml(c.nickname || c.username)}</div>
                    <div class="detail-comment-text">${c._replyTo ? `<span class="reply-at" data-user-id="${c._replyToUserId}">@${c._replyTo}</span> ` : ''}${renderTextWithLinks(c.content)}</div>
                    <div class="detail-comment-time">
                        ${formatTime(c.created_at)}
                        <button class="comment-reply-btn" data-comment-id="${c.id}" data-username="${escapeHtml(c.nickname || c.username)}">回复</button>
                        ${recallCommentHtml(c.id, c.created_at, c.user_id)}
                    </div>
                </div>
            </div>
        `).join('\n');

        // Bind author clicks
        container.querySelectorAll('.detail-comment-avatar, .detail-comment-author').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = el.dataset.userId;
                if (userId) navigateToUserProfile(parseInt(userId));
            });
        });

        // Bind reply buttons
        container.querySelectorAll('.comment-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentId = parseInt(btn.dataset.commentId);
                const username = btn.dataset.username;
                state.replyTo = { commentId, username };
                const replyBar = $('#detail-reply-bar');
                if (replyBar) {
                    $('#detail-reply-username').textContent = username;
                    replyBar.style.display = 'flex';
                }
                const input = $('#detail-comment-input');
                if (input) input.focus();
            });
        });

        // Bind reply-at clicks
        container.querySelectorAll('.reply-at').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = el.dataset.userId;
                if (userId) navigateToUserProfile(parseInt(userId));
            });
        });

        // Bind recall buttons
        container.querySelectorAll('.comment-recall-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;
                if (!confirm('确定撤回这条评论？')) return;
                try {
                    await api('DELETE', `/comments/${commentId}`);
                    showToast('已撤回');
                    loadDetailComments(postId);
                } catch (e) { showToast(e.message); }
            });
        });
    } catch (e) {
        container.innerHTML = `<div class="retry-area">加载评论失败: ${escapeHtml(e.message)}</div>`;
    }
}

dom.commentSubmit.addEventListener('click', async () => {
    if (!state.user) { showToast('请先登录'); return; }
    const content = dom.commentInput.value.trim();
    if (!content) { showToast('请输入评论内容'); return; }
    try {
        const body = { content };
        if (state.replyTo) body.parent_id = state.replyTo.commentId;
        await api('POST', `/posts/${state.commentPostId}/comments`, body);
        dom.commentInput.value = '';
        clearReply();
        showToast('评论成功');
        const data = await api('GET', `/posts/${state.commentPostId}/comments`);
        renderComments(data.list);
        const post = state.posts.find(p => p.id == state.commentPostId);
        if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            const card = document.querySelector(`.post-card[data-post-id="${state.commentPostId}"]`);
            if (card) {
                const countSpan = card.querySelector('.comment-btn .comment-count');
                if (countSpan) countSpan.textContent = post.comments_count;
            }
        }
    } catch (e) { showToast(e.message); }
});

dom.commentCancel.addEventListener('click', () => { clearReply(); dialogClose(dom.commentOverlay); });

// 回复取消按钮
$('#comment-reply-cancel')?.addEventListener('click', clearReply);
$('#detail-reply-cancel')?.addEventListener('click', clearReply);

// ===== Post Composer =====
let selectedFiles = [];

dom.btnAddImage.addEventListener('click', (e) => {
    e.preventDefault();
    dom.composerImagesInput.click();
});

dom.composerImagesInput.addEventListener('change', () => {
    const remain = 9 - selectedFiles.length;
    if (remain <= 0) { showToast('最多选择 9 张图片'); dom.composerImagesInput.value = ''; return; }
    const newFiles = Array.from(dom.composerImagesInput.files).slice(0, remain);
    selectedFiles = [...selectedFiles, ...newFiles];
    updateMediaCount();
    const startIdx = selectedFiles.length - newFiles.length;
    const newPreviews = newFiles.map((f, i) => {
        const url = URL.createObjectURL(f);
        return `<div class="preview-item" data-idx="${startIdx + i}" style="position:relative;width:80px;height:80px;cursor:pointer">
            <img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid rgba(150,170,190,0.3)">
            <div class="preview-remove" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:var(--ba-pink);color:#fff;border-radius:50%;font-size:14px;line-height:20px;text-align:center;display:none;box-shadow:0 1px 3px rgba(0,0,0,0.3)">×</div>
        </div>`;
    }).join('\n');
    dom.imagePreview.insertAdjacentHTML('beforeend', newPreviews);
    dom.composerImagesInput.value = '';
});

// ===== Video Selection =====
dom.btnAddVideo.addEventListener('click', (e) => {
    e.preventDefault();
    dom.composerVideosInput.click();
});

dom.composerVideosInput.addEventListener('change', () => {
    const file = dom.composerVideosInput.files[0];
    if (!file) return;
    if (state.selectedVideos.length > 0) {
        showToast('最多上传 1 个视频');
        dom.composerVideosInput.value = '';
        return;
    }
    if (file.size > 28 * 1024 * 1024) {
        showToast('视频不能超过 28MB');
        dom.composerVideosInput.value = '';
        return;
    }
    state.selectedVideos = [file];
    updateMediaCount();
    dom.videoPreview.innerHTML = `
        <div class="preview-item" data-idx="0" style="position:relative;width:140px;height:100px;cursor:pointer">
            <video src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid rgba(150,170,190,0.3)" muted></video>
            <div class="preview-remove" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:var(--ba-pink);color:#fff;border-radius:50%;font-size:14px;line-height:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.3)">×</div>
        </div>`;
    dom.composerVideosInput.value = '';
});

dom.videoPreview.addEventListener('click', (e) => {
    const item = e.target.closest('.preview-item');
    if (!item) return;
    state.selectedVideos = [];
    item.remove();
    updateMediaCount();
});

function updateMediaCount() {
    const imgCount = selectedFiles.length;
    const vidCount = state.selectedVideos.length;
    const parts = [];
    if (imgCount > 0) parts.push(`${imgCount} 张图片`);
    if (vidCount > 0) parts.push(`${vidCount} 个视频`);
    dom.mediaCount.textContent = parts.join(' · ');
}

dom.imagePreview.addEventListener('click', (e) => {
    const item = e.target.closest('.preview-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx);
    selectedFiles.splice(idx, 1);
    item.remove();
    const items = dom.imagePreview.querySelectorAll('.preview-item');
    items.forEach((el, i) => el.dataset.idx = i);
    updateMediaCount();
});

// Show remove button on hover
dom.imagePreview.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.preview-item');
    if (item) { const rm = item.querySelector('.preview-remove'); if (rm) rm.style.display = 'block'; }
});
dom.imagePreview.addEventListener('mouseout', (e) => {
    const item = e.target.closest('.preview-item');
    if (item) { const rm = item.querySelector('.preview-remove'); if (rm) rm.style.display = 'none'; }
});

dom.composerSubmit.addEventListener('click', async () => {
    if (!state.user) { showToast('请先登录'); return; }
    const content = dom.composerContent.value.trim();
    if (!content) { showToast('请输入内容'); return; }
    const formData = new FormData();
    formData.append('content', content);
    selectedFiles.forEach(f => formData.append('images[]', f));
    state.selectedVideos.forEach(f => formData.append('videos[]', f));
    dom.composerSubmit.textContent = '发布中...';
    dom.composerSubmit.disabled = true;
    try {
        await api('POST', '/posts', formData);
        dom.composerContent.value = '';
        selectedFiles = [];
        state.selectedVideos = [];
        dom.composerImagesInput.value = '';
        dom.composerVideosInput.value = '';
        dom.imagePreview.innerHTML = '';
        dom.videoPreview.innerHTML = '';
        dom.mediaCount.textContent = '';
        dialogClose(dom.composerOverlay);
        showToast('发布成功');
        renderHome();
    } catch (e) { showToast(e.message); }
    finally { dom.composerSubmit.textContent = '发布'; dom.composerSubmit.disabled = false; }
});

dom.composerCancel.addEventListener('click', () => dialogClose(dom.composerOverlay));

// ===== Image Viewer (全屏覆盖层) =====
// 创建查看器 DOM（单例）
let _viewerOverlay = null;
let _viewerImg = null;

function createImageViewer() {
    if (_viewerOverlay) return;
    _viewerOverlay = document.createElement('div');
    _viewerOverlay.id = 'imageViewerOverlay';
    _viewerImg = document.createElement('img');
    _viewerImg.draggable = false;
    _viewerImg._scale = 1;
    _viewerImg._tx = 0;
    _viewerImg._ty = 0;
    _viewerOverlay.appendChild(_viewerImg);
    document.body.appendChild(_viewerOverlay);

    // ---- 关闭 ----
    function close() {
        _viewerOverlay.classList.remove('open');
        _viewerOverlay.style.opacity = '0';
        _viewerImg.style.transform = 'scale(1) translate(0px, 0px)';
        _viewerImg._scale = 1; _viewerImg._tx = 0; _viewerImg._ty = 0;
        _viewerOverlay.addEventListener('transitionend', function h() {
            _viewerOverlay.style.display = 'none';
            _viewerOverlay.removeEventListener('transitionend', h);
        }, { once: true });
    }
    function apply() {
        _viewerImg.style.transform = `scale(${_viewerImg._scale})translate(${_viewerImg._tx||0}px,${_viewerImg._ty||0}px)`;
    }
    function clamp() {
        const s = _viewerImg._scale || 1;
        const r = _viewerImg.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let mx = 0, my = 0;
        if (r.width * s > vw) mx = (r.width * s - vw) / (2 * s);
        if (r.height * s > vh) my = (r.height * s - vh) / (2 * s);
        _viewerImg._tx = Math.max(-mx, Math.min(mx, _viewerImg._tx));
        _viewerImg._ty = Math.max(-my, Math.min(my, _viewerImg._ty));
    }

    // ---- 点击遮罩关闭 ----
    let _hasDragged = false;
    _viewerOverlay.addEventListener('click', function(e) {
        if (_hasDragged) { _hasDragged = false; return; }
        close();
    });

    // ---- PC 鼠标拖拽 ----
    let _drag = false;
    let _sx = 0, _sy = 0, _ix = 0, _iy = 0;
    _viewerOverlay.addEventListener('mousedown', function(e) {
        e.preventDefault();
        _drag = true; _hasDragged = false;
        _sx = e.clientX; _sy = e.clientY;
        _ix = _viewerImg._tx || 0; _iy = _viewerImg._ty || 0;
        _viewerOverlay.style.cursor = 'grabbing';
        _viewerImg.style.transition = 'none';
    });
    window.addEventListener('mousemove', function(e) {
        if (!_drag) return;
        const dx = e.clientX - _sx, dy = e.clientY - _sy;
        const s = _viewerImg._scale || 1;
        _viewerImg._tx = _ix + dx / s; _viewerImg._ty = _iy + dy / s;
        clamp(); apply();
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _hasDragged = true;
    });
    window.addEventListener('mouseup', function() {
        if (_drag) { _drag = false; _viewerOverlay.style.cursor = 'grab'; _viewerImg.style.transition = 'transform 0.2s ease'; }
    });

    // ---- PC 滚轮缩放 ----
    _viewerOverlay.addEventListener('wheel', function(e) {
        e.preventDefault();
        let s = _viewerImg._scale || 1;
        s = Math.min(5, Math.max(0.5, s + (e.deltaY > 0 ? -0.2 : 0.2)));
        _viewerImg._scale = s; clamp(); apply();
    }, { passive: false });

    // ---- 触摸事件 ----
    let ts = { touching: false, lastTap: 0, pinchD: 0, pinchS: 1, px: 0, py: 0, ipx: 0, ipy: 0, moved: false, fingers: 0 };
    function dist(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }
    _viewerOverlay.addEventListener('touchstart', function(e) {
        const t = e.touches;
        ts.touching = true; ts.fingers = t.length; ts.moved = false;
        if (t.length === 1) {
            const now = Date.now();
            if (now - ts.lastTap < 300) {
                e.preventDefault();
                if (_viewerImg._scale > 1.2) {
                    _viewerImg._scale = 1; _viewerImg._tx = 0; _viewerImg._ty = 0;
                } else {
                    _viewerImg._scale = 2.5;
                    const r = _viewerImg.getBoundingClientRect();
                    _viewerImg._tx = (window.innerWidth / 2 - t[0].clientX) / _viewerImg._scale;
                    _viewerImg._ty = (window.innerHeight / 2 - t[0].clientY) / _viewerImg._scale;
                    clamp();
                }
                _viewerImg.style.transition = 'transform 0.3s ease'; apply();
                ts.lastTap = 0; return;
            }
            ts.lastTap = now;
            e.preventDefault();
            _viewerImg.style.transition = 'none';
            ts.px = t[0].clientX; ts.py = t[0].clientY;
            ts.ipx = _viewerImg._tx || 0; ts.ipy = _viewerImg._ty || 0;
            _hasDragged = false;
        } else if (t.length === 2) {
            e.preventDefault(); _viewerImg.style.transition = 'none';
            ts.pinchD = dist(t[0], t[1]); ts.pinchS = _viewerImg._scale || 1;
            ts.ipx = _viewerImg._tx || 0; ts.ipy = _viewerImg._ty || 0;
            const cx = (t[0].clientX + t[1].clientX) / 2;
            const cy = (t[0].clientY + t[1].clientY) / 2;
            ts.px = cx; ts.py = cy;
            _hasDragged = true;
        }
    }, { passive: false });
    _viewerOverlay.addEventListener('touchmove', function(e) {
        if (!ts.touching) return;
        const t = e.touches;
        if (t.length === 1 && ts.fingers === 1) {
            e.preventDefault();
            const dx = t[0].clientX - ts.px, dy = t[0].clientY - ts.py;
            const s = _viewerImg._scale || 1;
            _viewerImg._tx = ts.ipx + dx / s; _viewerImg._ty = ts.ipy + dy / s;
            clamp(); apply();
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { _hasDragged = true; ts.moved = true; }
        } else if (t.length === 2) {
            e.preventDefault();
            const d = dist(t[0], t[1]);
            let ns = ts.pinchS * (d / ts.pinchD);
            ns = Math.min(5, Math.max(0.5, ns));
            _viewerImg._scale = ns;
            const cx = (t[0].clientX + t[1].clientX) / 2;
            const cy = (t[0].clientY + t[1].clientY) / 2;
            _viewerImg._tx = ts.ipx + (cx - ts.px) / ns;
            _viewerImg._ty = ts.ipy + (cy - ts.py) / ns;
            clamp(); apply();
            _hasDragged = true; ts.moved = true;
        }
    }, { passive: false });
    function touchEnd(e) {
        if (e.touches.length === 0) {
            const wasSingle = ts.fingers === 1;
            const noMove = !ts.moved;
            ts.touching = false; ts.fingers = 0;
            _viewerImg.style.transition = 'transform 0.2s ease';
            if (_viewerImg._scale < 1) { _viewerImg._scale = 1; _viewerImg._tx = 0; _viewerImg._ty = 0; apply(); }
            if (_viewerImg._scale > 5) { _viewerImg._scale = 5; clamp(); apply(); }
            if (wasSingle && noMove && _viewerImg._scale <= 1) { _hasDragged = false; close(); return; }
            _hasDragged = noMove ? false : true;
        } else if (e.touches.length === 1) {
            ts.fingers = 1;
            ts.px = e.touches[0].clientX; ts.py = e.touches[0].clientY;
            ts.ipx = _viewerImg._tx || 0; ts.ipy = _viewerImg._ty || 0;
        }
    }
    _viewerOverlay.addEventListener('touchend', touchEnd, { passive: false });
    _viewerOverlay.addEventListener('touchcancel', touchEnd, { passive: false });
}

function openImageViewer(src) {
    createImageViewer();
    _viewerImg.src = src;
    _viewerImg._scale = 1; _viewerImg._tx = 0; _viewerImg._ty = 0;
    _viewerImg.style.transform = 'scale(1) translate(0px, 0px)';
    _viewerOverlay.style.display = 'flex';
    requestAnimationFrame(() => { _viewerOverlay.style.opacity = '1'; _viewerOverlay.classList.add('open'); });
}

// ===== 绑定图片点击事件（缩略图 → 打开查看器）=====
function bindImageEvents(imgEl) {
    imgEl.addEventListener('click', () => openImageViewer(imgEl.src));
}

// ===== Notifications =====
dom.btnNotifications.addEventListener('click', () => { loadNotifications(); dialogOpen(dom.notifOverlay); });

async function loadNotifications() {
    dom.notifList.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    try {
        const data = await api('GET', '/notifications');
        if (data.list.length === 0) {
            dom.notifList.innerHTML = '<div class="notif-empty">暂无通知</div>';
        } else {
            const unread = data.list.filter(n => !n.is_read);
            const read = data.list.filter(n => n.is_read);
            function renderNotifItems(items) {
                return items.map(n => {
                    const text = n.type === 'like' ? '赞了你的动态' : n.type === 'comment' ? '评论了你的动态' : '回复了你的评论';
                    return `<div class="notif-item ${n.is_read ? '' : 'unread'}" data-post-id="${n.post_id || ''}">
                        <div class="notif-text"><strong>${escapeHtml(n.actor_nickname || n.actor_username)}</strong> ${text}</div>
                        <div class="notif-time">${formatTime(n.created_at)}</div>
                    </div>`;
                }).join('\n');
            }
            let html = '';
            if (unread.length > 0) { html += '<div class="notif-section-title">未读</div>' + renderNotifItems(unread); }
            if (unread.length > 0 && read.length > 0) html += '<div class="notif-divider"></div>';
            if (read.length > 0) html += '<div class="notif-section-title">已读</div>' + renderNotifItems(read);
            dom.notifList.innerHTML = html;
            dom.notifList.querySelectorAll('.notif-item').forEach(el => {
                el.addEventListener('click', async () => {
                    const postId = el.dataset.postId;
                    if (!postId) return;
                    dialogClose(dom.notifOverlay);
                    await navigateTo('home');
                    await scrollToPost(postId);
                });
            });
        }
        await checkUnread();
    } catch (e) { dom.notifList.innerHTML = retryArea('加载失败: ' + e.message, loadNotifications); }
}

dom.notifReadAll.addEventListener('click', async () => {
    try {
        await api('PUT', '/notifications/read');
        dom.notifBadge.style.display = 'none';
        dom.notifList.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
        showToast('已全部标记已读');
    } catch (e) { showToast(e.message); }
});
dom.notifClose.addEventListener('click', () => dialogClose(dom.notifOverlay));

async function checkUnread() {
    if (!state.user) return;
    try {
        const data = await api('GET', '/notifications/unread');
        dom.notifBadge.style.display = data.unread_count > 0 ? '' : 'none';
        dom.notifBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
    } catch (_) {}
}

// ===== Profile =====
async function renderProfile() {
    if (!state.user) {
        dom.main.innerHTML = `
            <div class="section-title">我的</div>
            <div class="profile-header">
                <p style="color:var(--ba-text-muted);margin-bottom:16px">请先登录以查看个人主页</p>
                <button class="btn-primary" id="profile-login-btn">${icon('login')} 登录 / 注册</button>
            </div>`;
        $('#profile-login-btn')?.addEventListener('click', () => { switchAuthMode('login'); dialogOpen(dom.authOverlay); });
        return;
    }
    dom.main.innerHTML = `
        <div class="profile-header">
            <img src="${avatarSrc(state.user.avatar)}" class="profile-avatar" id="profile-avatar-img"
                 onerror="${avatarOnerror(state.user.nickname || state.user.username)}">
            <div class="profile-nickname" id="profile-nickname" contenteditable="true" data-original="${escapeHtml(state.user.nickname || state.user.username)}">${escapeHtml(state.user.nickname || state.user.username)}</div>
            <div class="profile-username">@${escapeHtml(state.user.username)}</div>
            <div class="profile-bio" id="profile-bio" contenteditable="true" data-original="${escapeHtml(state.user.bio || '')}">${state.user.bio ? escapeHtml(state.user.bio) : '这个人很懒，什么都没写...'}</div>
            <div class="profile-stats">
                <div class="stat"><div class="stat-num" id="profile-post-count">0</div><div class="stat-label">动态</div></div>
            </div>
            <div class="profile-edit-btn">
                <button class="btn-text" id="btn-edit-avatar">${icon('photo_camera')} 更换头像</button>
                <button class="btn-text" id="btn-logout" style="color:#d4a0a0">退出登录</button>
            </div>
            <input type="file" id="avatar-input" accept="image/*" style="display:none">
        </div>
        <div class="section-title">我的动态</div>
        <div id="my-posts"></div>`;

    $('#btn-logout')?.addEventListener('click', handleLogout);
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
            $('#profile-avatar-img').src = avatarSrc(result.avatar);
            showToast('头像更新成功');
        } catch (e) { showToast(e.message); }
    });

    const bioDiv = $('#profile-bio');
    if (bioDiv) {
        const saveBio = async () => {
            const newBio = bioDiv.innerText.trim();
            if (newBio === bioDiv.dataset.original) return;
            try {
                const result = await api('POST', '/user/bio', { bio: newBio });
                state.user.bio = result.bio;
                bioDiv.dataset.original = newBio;
                showToast('简介已更新');
            } catch (e) { showToast(e.message); bioDiv.innerText = bioDiv.dataset.original; }
        };
        bioDiv.addEventListener('blur', saveBio);
        bioDiv.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); bioDiv.blur(); } });
    }

    const nickDiv = $('#profile-nickname');
    if (nickDiv) {
        const saveNickname = async () => {
            const newNick = nickDiv.innerText.trim();
            if (newNick === nickDiv.dataset.original) return;
            try {
                const result = await api('POST', '/user/nickname', { nickname: newNick });
                state.user.nickname = result.nickname;
                nickDiv.dataset.original = newNick;
                showToast('昵称已更新');
            } catch (e) { showToast(e.message); nickDiv.innerText = nickDiv.dataset.original; }
        };
        nickDiv.addEventListener('blur', saveNickname);
        nickDiv.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); nickDiv.blur(); } });
    }

    try {
        const data = await api('GET', `/posts?page=1&size=20`);
        const myPosts = data.list.filter(p => p.user_id === state.user.id);
        $('#profile-post-count').textContent = myPosts.length;
        if (myPosts.length === 0) {
            $('#my-posts').innerHTML = '<div class="end-indicator">还没有发布过动态</div>';
        } else {
            state.posts = myPosts;
            $('#my-posts').innerHTML = myPosts.map(p => renderPostCard(p)).join('\n');
            setupPostCardEvents('#my-posts');
        }
    } catch (e) { $('#my-posts').innerHTML = retryArea('加载失败: ' + e.message, renderProfile); }
}

function setupPostCardEvents(container) {
    const c = $(container);
    c.querySelectorAll('.like-btn').forEach(btn => btn.addEventListener('click', () => handleLike(btn.dataset.postId)));
    c.querySelectorAll('.comment-btn').forEach(btn => btn.addEventListener('click', () => openComments(btn.dataset.postId)));
    c.querySelectorAll('.recall-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('确定撤回这条动态？')) return;
            try { await api('DELETE', `/posts/${btn.dataset.postId}`); showToast('已撤回'); btn.closest('.post-card').remove(); }
            catch (e) { showToast(e.message); }
        });
    });
    c.querySelectorAll('.post-images img').forEach(img => bindImageEvents(img));
    observeRevealElements();
}

// ===== User Profile (viewing others) =====
function navigateToUserProfile(userId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    state.currentPage = 'user';
    state.viewUserId = userId;
    window.location.hash = 'page:user:' + userId;
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    renderUserProfile(userId);
}

async function renderUserProfile(userId) {
    dom.main.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    try {
        const [user, postsData] = await Promise.all([
            api('GET', `/user/${userId}`),
            api('GET', `/posts?page=1&size=20`),
        ]);
        const isSelf = state.user && state.user.id === userId;
        dom.main.innerHTML = `
            <div class="profile-header">
                <div class="user-profile-back">
                    <button class="btn-text" id="btn-back-from-user">${icon('arrow_back')} 返回</button>
                </div>
                <img src="${avatarSrc(user.avatar)}" class="profile-avatar"
                     onerror="${avatarOnerror(user.nickname || user.username)}">
                <div class="profile-nickname">${escapeHtml(user.nickname || user.username)}</div>
                <div class="profile-username">@${escapeHtml(user.username)}</div>
                <div class="profile-bio">${user.bio ? escapeHtml(user.bio) : '这个人很懒，什么都没写...'}</div>
                <div class="profile-stats">
                    <div class="stat"><div class="stat-num">${user.posts_count || 0}</div><div class="stat-label">动态</div></div>
                </div>
                ${!isSelf ? `<div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
                    <button class="btn-primary" id="btn-start-chat" data-user-id="${userId}">${icon('chat')} 发私信</button>
                </div>` : ''}
            </div>
            <div class="section-title">${escapeHtml(user.nickname || user.username)} 的动态</div>
            <div id="user-posts"></div>`;

        $('#btn-back-from-user')?.addEventListener('click', () => {
            navigateTo('home');
        });
        $('#btn-start-chat')?.addEventListener('click', async () => {
            const otherUserId = parseInt($('#btn-start-chat').dataset.userId);
            if (!otherUserId) return;
            try {
                const result = await api('POST', '/conversations', { type: 'private', user_id: otherUserId });
                state.currentConvId = result.id;
                navigateTo('chat');
            } catch (e) { showToast(e.message); }
        });

        const userPosts = postsData.list.filter(p => p.user_id === userId);
        const container = $('#user-posts');
        if (userPosts.length === 0) {
            container.innerHTML = '<div class="end-indicator">还没有发布过动态</div>';
        } else {
            state.posts = userPosts;
            container.innerHTML = userPosts.map(p => renderPostCard(p)).join('\n');
            setupPostCardEvents('#user-posts');
        }
    } catch (e) {
        dom.main.innerHTML = `
            <div class="profile-header">
                <button class="btn-text" id="btn-back-from-user">${icon('arrow_back')} 返回</button>
                <p style="color:#d4a0a0;text-align:center">加载失败: ${escapeHtml(e.message)}</p>
            </div>`;
        $('#btn-back-from-user')?.addEventListener('click', () => { navigateTo('home'); });
    }
}

// ===== Explore Page =====
async function renderExplore() {
    dom.main.innerHTML = `
        <div class="section-title">发现</div>
        <div style="background:var(--ba-card-bg);border-radius:var(--ba-radius-lg);padding:16px 24px 20px;border:1px solid var(--ba-card-border);box-shadow:var(--ba-card-shadow);text-align:center;margin-bottom:16px">
            <span class="material-symbols-outlined" style="font-size:48px;color:var(--ba-accent);margin-bottom:12px;display:block">explore</span>
            <h3 style="margin-bottom:8px;color:var(--ba-text)">探索 CRMoment</h3>
            <p style="color:var(--ba-text-secondary);line-height:1.6">一个轻量的动态分享社区。<br>浏览最新动态，分享你的生活瞬间。</p>
            <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                <button class="btn-primary" id="explore-home-btn">${icon('home')} 去看看动态</button>
                ${!state.user ? `<button class="btn-secondary" id="explore-login-btn">${icon('login')} 登录体验更多</button>` : ''}
            </div>
        </div>
        <div class="music-section-header">
            <div class="section-title"><span class="material-symbols-outlined" style="font-size:20px;vertical-align:middle;margin-right:4px">music_note</span> 音乐广场</div>
            <div class="music-header-actions">
                <button class="btn-primary" id="btn-search-music" style="padding:6px 16px;font-size:13px">${icon('search')} 搜索</button>
                ${state.user ? `<button class="btn-primary" id="btn-add-music" style="padding:6px 16px;font-size:13px">${icon('add')} 添加音乐</button>` : ''}
            </div>
        </div>
        <div id="music-list"></div>
        <div id="music-loading" class="loading-indicator"><div class="spinner"></div></div>`;

    $('#explore-home-btn')?.addEventListener('click', () => navigateTo('home'));
    $('#explore-login-btn')?.addEventListener('click', () => { switchAuthMode('login'); dialogOpen(dom.authOverlay); });
    $('#btn-add-music')?.addEventListener('click', openAddMusicDialog);
    $('#btn-search-music')?.addEventListener('click', openSearchDialog);
    await loadMusic();
}

async function loadMusic() {
    const listEl = $('#music-list');
    if (listEl) listEl.style.opacity = '0.4';
    try {
        const q = state.musicSearchQuery || '';
        const url = q ? `/music?page=1&size=200&q=${encodeURIComponent(q)}` : '/music?page=1&size=200';
        const data = await api('GET', url);
        state.music = data.list || [];
    } catch (e) {
        state.music = [];
        const ml = $('#music-list');
        if (ml) ml.innerHTML = retryArea('加载失败: ' + e.message, loadMusic);
        const ld = $('#music-loading');
        if (ld) ld.style.display = 'none';
        if (listEl) listEl.style.opacity = '1';
        return;
    }
    if (listEl) listEl.style.opacity = '1';
    renderMusicList();
}

function openSearchDialog() {
    dialogOpen($('#search-music-overlay'));
    setTimeout(() => {
        const searchInput = $('#music-search');
        if (searchInput) searchInput.value = state.musicSearchQuery || '';
        searchInput?.focus();
    }, 100);
}

function handleSearchSubmit() {
    state.musicSearchQuery = $('#music-search')?.value?.trim() || '';
    dialogClose($('#search-music-overlay'));
    loadMusic();
}

function handleSearchClear() {
    $('#music-search').value = '';
    state.musicSearchQuery = '';
    dialogClose($('#search-music-overlay'));
    loadMusic();
}

function renderMusicList() {
    const container = $('#music-list');
    const loading = $('#music-loading');
    if (!container) return;
    if (loading) loading.style.display = 'none';
    if (state.music.length === 0) {
        container.innerHTML = '<p style="color:var(--ba-text-muted);text-align:center;padding:24px">还没有音乐，快来添加第一首吧</p>';
        return;
    }
    container.innerHTML = state.music.map(item => {
        const displayName = escapeHtml(item.nickname || item.username);
        const timeStr = formatTime(item.created_at);
        const params = new URLSearchParams({ id: item.id, music: item.music_url, lrc: item.lrc_url });
        if (item.bg_url) params.set('bg', item.bg_url);
        if (item.video_url) params.set('video', item.video_url);
        if (item.lrc_pos && item.lrc_pos !== 'center') params.set('pos', item.lrc_pos);
        if (item.lrc_color && item.lrc_color !== 'light') params.set('color', item.lrc_color);
        const musicUrl = '/crmusic.html?' + params.toString();
        const isOwner = state.user && String(item.user_id) === String(state.user.id);
        return `
            <div class="music-card" data-music-url="${escapeHtml(musicUrl)}">
                <div class="music-card-title">${escapeHtml(item.title)}</div>
                <div class="music-card-meta">
                    <span class="music-card-author" data-user-id="${item.user_id}">${displayName}</span>
                    <span>${item.plays_count} 次播放</span>
                    <span>${timeStr}</span>
                    <span class="music-right-group">
                        <button class="btn-text music-lite-btn" data-id="${item.id}" data-music="${escapeHtml(item.music_url)}" data-lrc="${escapeHtml(item.lrc_url)}" style="padding:4px 8px;font-size:12px" title="Lite 模式（仅音频+歌词）">${icon('play_circle')} Lite</button>
                        ${isOwner ? `<span class="music-actions">
                            <button class="btn-text music-edit-btn" data-id="${item.id}" style="padding:4px 8px;font-size:12px">${icon('edit')} 编辑</button>
                            <button class="btn-text music-del-btn" data-id="${item.id}" style="padding:4px 8px;font-size:12px;color:#d4a0a0">${icon('delete')} 删除</button>
                        </span>` : ''}
                    </span>
                </div>
            </div>`;
    }).join('');

    container.querySelectorAll('.music-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.music-card-author')) return;
            const url = card.dataset.musicUrl;
            if (url) window.open(url, '_blank');
        });
    });
    container.querySelectorAll('.music-card-author').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = parseInt(el.dataset.userId);
            if (userId) navigateToUserProfile(userId);
        });
    });
    container.querySelectorAll('.music-lite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const music = btn.dataset.music;
            const lrc = btn.dataset.lrc;
            const params = new URLSearchParams({ id, music, lrc });
            const url = '/crmusic.html?' + params.toString();
            window.open(url, '_blank');
        });
    });
    container.querySelectorAll('.music-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = state.music.find(m => m.id === parseInt(btn.dataset.id));
            if (item) openAddMusicDialog(item);
        });
    });
    container.querySelectorAll('.music-del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('确定要删除这首音乐吗？')) return;
            try { await api('DELETE', '/music/' + btn.dataset.id); showToast('删除成功'); await loadMusic(); }
            catch (err) { showToast(err.message || '删除失败'); }
        });
    });
}

function openAddMusicDialog(editItem) {
    if (!state.user) { showToast('请先登录'); return; }
    state.editingMusicId = editItem ? editItem.id : null;
    dom.musicTitle.value = editItem ? (editItem.title || '') : '';
    dom.musicUrl.value = editItem ? (editItem.music_url || '') : '';
    dom.musicLrcUrl.value = editItem ? (editItem.lrc_url || '') : '';
    dom.musicBgUrl.value = editItem ? (editItem.bg_url || '') : '';
    dom.musicVideoUrl.value = editItem ? (editItem.video_url || '') : '';
    const pos = editItem ? (editItem.lrc_pos || 'center') : 'center';
    const posRadio = document.querySelector(`.lrc-pos-radio[name="lrc_pos"][value="${pos}"]`);
    if (posRadio) posRadio.checked = true;
    const color = editItem ? (editItem.lrc_color || 'light') : 'light';
    const colorRadio = document.querySelector(`.lrc-pos-radio[name="lrc_color"][value="${color}"]`);
    if (colorRadio) colorRadio.checked = true;
    dom.addMusicError.style.display = 'none';
    const headline = dom.addMusicOverlay.querySelector('.modal-headline');
    if (headline) headline.textContent = editItem ? '编辑音乐' : '添加音乐';
    dom.addMusicSubmit.textContent = editItem ? '保存' : '添加';
    dialogOpen(dom.addMusicOverlay);
}

async function handleAddMusic() {
    const title = dom.musicTitle.value.trim();
    const musicUrl = dom.musicUrl.value.trim();
    const lrcUrl = dom.musicLrcUrl.value.trim();
    const bgUrl = dom.musicBgUrl.value.trim();
    const videoUrl = dom.musicVideoUrl.value.trim();
    const lrcPos = (document.querySelector('.lrc-pos-radio[name="lrc_pos"]:checked')?.value) || 'center';
    const lrcColor = (document.querySelector('.lrc-pos-radio[name="lrc_color"]:checked')?.value) || 'light';
    if (!title) { dom.addMusicError.textContent = '请输入音乐名称'; dom.addMusicError.style.display = ''; return; }
    if (!musicUrl) { dom.addMusicError.textContent = '请输入音频链接'; dom.addMusicError.style.display = ''; return; }
    if (!lrcUrl) { dom.addMusicError.textContent = '请输入歌词文件链接'; dom.addMusicError.style.display = ''; return; }
    try {
        dom.addMusicSubmit.textContent = '处理中...';
        dom.addMusicSubmit.disabled = true;
        const body = { title, music_url: musicUrl, lrc_url: lrcUrl, bg_url: bgUrl || undefined, video_url: videoUrl || undefined, lrc_pos: lrcPos, lrc_color: lrcColor };
        if (state.editingMusicId) {
            await api('PUT', '/music/' + state.editingMusicId, body);
            state.editingMusicId = null;
            showToast('修改成功');
        } else {
            await api('POST', '/music', body);
            showToast('添加成功');
        }
        dialogClose(dom.addMusicOverlay);
        await loadMusic();
    } catch (e) { dom.addMusicError.textContent = e.message || '操作失败'; dom.addMusicError.style.display = ''; }
    finally {
        const stillEditing = !!state.editingMusicId;
        dom.addMusicSubmit.textContent = stillEditing ? '保存' : '添加';
        dom.addMusicSubmit.disabled = false;
    }
}

// ===== Chat System =====
async function renderConversationList() {
    dom.main.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    try {
        await loadConversations();
    } catch (e) {
        dom.main.innerHTML = retryArea('加载失败: ' + e.message, renderConversationList);
        return;
    }
    dom.main.innerHTML = `
        <div class="conv-list-header">
            <div class="section-title" style="margin:0">信息</div>
            <button class="btn-primary" id="btn-create-group" style="padding:6px 16px;font-size:13px">${icon('group_add')} 创建群聊</button>
        </div>
        <div id="conv-list"></div>`;
    $('#btn-create-group')?.addEventListener('click', openCreateGroupDialog);
    if (state.conversations.length === 0) { $('#conv-list').innerHTML = '<div class="end-indicator">暂无会话</div>'; return; }
    $('#conv-list').innerHTML = state.conversations.map(conv => renderConvItem(conv)).join('\n');
    state.conversations.forEach(conv => {
        const el = document.getElementById(`conv-item-${conv.id}`);
        if (el) el.addEventListener('click', () => { state.currentConvId = conv.id; navigateTo('chat'); });
    });
}

function renderConvItem(conv) {
    const lastMsg = conv.last_msg_id ? conv.last_msg_content : '';
    const lastMsgPreview = conv.last_msg_id
        ? (conv.last_msg_user_id && parseInt(conv.last_msg_user_id) !== (state.user?.id)
            ? `${conv.last_msg_nickname || conv.last_msg_username}: ${lastMsg}` : lastMsg)
        : '暂无消息';
    const timeStr = conv.updated_at ? formatTimeShort(conv.updated_at) : '';
    const unread = conv.unread_count > 0;

    if (conv.type === 'group') {
        return `<div class="conv-item" id="conv-item-${conv.id}">
            <div class="conv-avatar-wrap"><div class="conv-avatar conv-avatar-group">${icon('group')}</div></div>
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
    return `<div class="conv-item" id="conv-item-${conv.id}">
        <div class="conv-avatar-wrap">
            <img src="${avatarSrc(conv.display_avatar)}" class="conv-avatar"
                 onerror="${avatarOnerror(conv.display_name)}">
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
    const data = await api('GET', '/conversations');
    state.conversations = data.list || [];
}

async function renderConversationDetail(convId) {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv) {
        try { await loadConversations(); const found = state.conversations.find(c => c.id === convId); if (found) return renderConversationDetail(convId); } catch (_) {}
    }
    const displayName = conv ? (conv.display_name || (conv.other_user?.nickname || conv.other_user?.username || '聊天')) : '聊天';
    const messages = state.conversationMessages[convId] || [];
    state.currentConvType = conv?.type || 'private';

    dom.main.innerHTML = `
        <div class="chat-detail">
            <div class="chat-detail-header">
                <button class="btn-icon" id="btn-back-to-conv">${icon('arrow_back')}</button>
                <span class="chat-detail-title">${escapeHtml(displayName)}</span>
            </div>
            <div class="chat-messages" id="chat-messages">
                ${messages.length === 0 ? '<div class="end-indicator">暂无消息，发送第一条消息吧</div>' : ''}
                ${messages.map(m => renderChatMessage(m)).join('\n')}
            </div>
            <div class="chat-input-bar">
                <button class="btn-icon" id="btn-chat-image" title="发送图片">${icon('add_photo_alternate')}</button>
                <input type="file" id="chat-image-input" accept="image/*" style="display:none">
                ${state.currentConvType === 'group' ? `<button class="btn-icon" id="btn-chat-invite" title="邀请成员">${icon('person_add')}</button>` : ''}
                <textarea id="chat-input" placeholder="输入消息..." rows="1" maxlength="5000"></textarea>
                <button class="btn-primary" id="btn-chat-send">${icon('send')} 发送</button>
            </div>
        </div>`;

    $('#btn-back-to-conv')?.addEventListener('click', () => { stopPolling(convId); navigateTo('messages'); });

    const chatInput = $('#chat-input');
    const chatSend = $('#btn-chat-send');

    async function doSend() {
        const content = chatInput.value.trim();
        if (!content) return;
        chatInput.value = '';
        chatInput.style.height = 'auto';
        try {
            const tempMsg = {
                id: Date.now(), user_id: state.user.id, content,
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nickname: state.user.nickname, username: state.user.username, avatar: state.user.avatar, _pending: true,
            };
            if (!state.conversationMessages[convId]) state.conversationMessages[convId] = [];
            state.conversationMessages[convId].push(tempMsg);
            appendChatMessage(tempMsg);
            scrollChatToBottom();
            const result = await api('POST', `/conversations/${convId}/messages`, { content });
            const msgs = state.conversationMessages[convId];
            const idx = msgs.findIndex(m => m._pending && m.id === tempMsg.id);
            if (idx !== -1) msgs[idx] = result;
            const msgEl = document.getElementById(`msg-${tempMsg.id}`);
            if (msgEl) msgEl.outerHTML = renderChatMessage(result);
        } catch (e) { showToast('发送失败: ' + e.message); }
    }

    chatSend?.addEventListener('click', doSend);
    chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    chatInput?.addEventListener('input', () => { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px'; });

    const chatImageBtn = $('#btn-chat-image');
    const chatImageInput = $('#chat-image-input');
    chatImageBtn?.addEventListener('click', () => chatImageInput.click());
    chatImageInput?.addEventListener('change', async () => {
        const file = chatImageInput.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const uploadResult = await api('POST', '/upload/image', formData);
            const imageUrl = uploadResult.url;
            const tempMsg = {
                id: Date.now(), user_id: state.user.id, content: imageUrl,
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nickname: state.user.nickname, username: state.user.username, avatar: state.user.avatar, _pending: true,
            };
            if (!state.conversationMessages[convId]) state.conversationMessages[convId] = [];
            state.conversationMessages[convId].push(tempMsg);
            appendChatMessage(tempMsg);
            scrollChatToBottom();
            const result = await api('POST', `/conversations/${convId}/messages`, { content: imageUrl });
            const msgs = state.conversationMessages[convId];
            const idx = msgs.findIndex(m => m._pending && m.id === tempMsg.id);
            if (idx !== -1) msgs[idx] = result;
            const msgEl = document.getElementById(`msg-${tempMsg.id}`);
            if (msgEl) msgEl.outerHTML = renderChatMessage(result);
        } catch (e) { showToast('图片发送失败: ' + e.message); }
        chatImageInput.value = '';
    });

    $('#btn-chat-invite')?.addEventListener('click', async () => { await showInviteDialog(convId); });

    if (state.currentConvType === 'group') {
        const msgContainer = $('#chat-messages');
        msgContainer?.addEventListener('click', (e) => {
            const avatar = e.target.closest('.chat-msg-avatar');
            if (avatar) {
                const userId = parseInt(avatar.dataset.userId);
                if (userId && userId !== state.user?.id) navigateToUserProfile(userId);
            }
        });
    }

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
        } catch (e) { console.error('加载消息失败:', e); }
    }

    try { await api('POST', `/conversations/${convId}/read`); } catch (_) {}
    startPolling(convId);
}

function renderChatMessage(msg) {
    const isSelf = parseInt(msg.user_id) === state.user?.id;
    const isGroup = state.currentConvType === 'group';
    const time = msg.created_at ? formatChatTime(msg.created_at) : '';
    const pendingStyle = msg._pending ? ' style="opacity:0.5;"' : '';
    const content = msg.content || '';
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(content) && (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('/'));
    const contentHtml = isImage ? `<img src="${content}" alt="图片" class="chat-msg-image" style="cursor:pointer">` : `<div>${renderTextWithLinks(content)}</div>`;

    if (isGroup) {
        const avatarUrl = avatarSrc(msg.avatar);
        const displayName = msg.nickname || msg.username || '用户';
        if (isSelf) {
            return `<div class="chat-msg-row self group" id="msg-${msg.id}"${pendingStyle}>
                <div class="chat-msg-bubble">${contentHtml}<div class="chat-msg-time">${escapeHtml(time)}</div></div>
            </div>`;
        }
        return `<div class="chat-msg-row other group" id="msg-${msg.id}"${pendingStyle}>
            <img src="${avatarUrl}" alt="" class="chat-msg-avatar" data-user-id="${msg.user_id}" style="cursor:pointer" onerror="${avatarOnerror(msg.nickname || msg.username)}">
            <div><div class="chat-msg-name">${escapeHtml(displayName)}</div>
            <div class="chat-msg-bubble">${contentHtml}<div class="chat-msg-time">${escapeHtml(time)}</div></div></div>
        </div>`;
    }
    return `<div class="chat-msg-row ${isSelf ? 'self' : 'other'}" id="msg-${msg.id}"${pendingStyle}>
        <div class="chat-msg-bubble">${contentHtml}<div class="chat-msg-time">${escapeHtml(time)}</div></div>
    </div>`;
}

function appendChatMessage(msg) {
    const container = $('#chat-messages');
    if (!container) return;
    const empty = container.querySelector('.end-indicator');
    if (empty) empty.remove();
    container.insertAdjacentHTML('beforeend', renderChatMessage(msg));
}

function scrollChatToBottom() {
    const container = $('#chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function startPolling(convId) {
    stopPolling(convId);
    const timer = setInterval(async () => {
        if (document.hidden) return;
        const msgs = state.conversationMessages[convId] || [];
        const lastId = msgs.length > 0 ? Math.max(...msgs.filter(m => !m._pending).map(m => m.id)) : 0;
        try {
            const data = await api('GET', `/conversations/${convId}/messages?since_id=${lastId}`);
            const newMsgs = data.messages || [];
            if (newMsgs.length === 0) return;
            if (!state.conversationMessages[convId]) state.conversationMessages[convId] = [];
            const existingIds = new Set(state.conversationMessages[convId].map(m => m.id));
            const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
            if (toAdd.length === 0) return;
            state.conversationMessages[convId].push(...toAdd);
            toAdd.forEach(m => appendChatMessage(m));
            if (state.currentPage === 'chat' && state.currentConvId === convId) {
                scrollChatToBottom();
                try { await api('POST', `/conversations/${convId}/read`); } catch (_) {}
            }
            updateConvUnreadBadge();
        } catch (e) { console.error('轮询消息失败:', e); }
    }, 3000);
    state.pollingTimers[convId] = timer;
}

function stopPolling(convId) {
    if (state.pollingTimers[convId]) { clearInterval(state.pollingTimers[convId]); delete state.pollingTimers[convId]; }
}
function stopAllPolling() { Object.keys(state.pollingTimers).forEach(convId => stopPolling(parseInt(convId))); }

async function openCreateGroupDialog() {
    if (!state.user) return;
    try {
        if (!state.conversations || state.conversations.length === 0) await loadConversations();
        const userMap = new Map();
        for (const conv of state.conversations) {
            if (conv.type === 'private' && conv.other_user && conv.other_user.id !== state.user.id) {
                const u = conv.other_user;
                if (!userMap.has(u.id)) userMap.set(u.id, { id: u.id, nickname: u.nickname || u.username, username: u.username, avatar: u.avatar });
            }
        }
        const allUsers = Array.from(userMap.values());
        dom.groupMemberList.innerHTML = allUsers.length === 0
            ? '<div class="end-indicator">暂无私聊用户</div>'
            : allUsers.map(u => `<label class="group-member-item">
                <img src="${avatarSrc(u.avatar)}" onerror="${avatarOnerror(u.nickname || u.username)}">
                <span class="member-name">${escapeHtml(u.nickname || u.username)}</span>
                <input type="checkbox" class="ba-checkbox" data-user-id="${u.id}">
            </label>`).join('');
        dialogOpen(dom.createGroupOverlay);
    } catch (e) { showToast('加载用户列表失败: ' + e.message); }
}

dom.createGroupSubmit?.addEventListener('click', async () => {
    const name = dom.groupNameInput.value.trim();
    if (!name) { dom.groupMemberError.textContent = '请输入群聊名称'; dom.groupMemberError.style.display = 'block'; return; }
    const userIds = Array.from(dom.groupMemberList.querySelectorAll('.ba-checkbox:checked')).map(cb => parseInt(cb.dataset.userId));
    if (userIds.length === 0) { dom.groupMemberError.textContent = '请至少选择一位成员'; dom.groupMemberError.style.display = 'block'; return; }
    dom.groupMemberError.style.display = 'none';
    try {
        const result = await api('POST', '/conversations', { type: 'group', name, user_ids: userIds });
        dialogClose(dom.createGroupOverlay);
        dom.groupNameInput.value = '';
        showToast('群聊创建成功');
        state.currentConvId = result.id;
        navigateTo('chat');
    } catch (e) { dom.groupMemberError.textContent = e.message; dom.groupMemberError.style.display = 'block'; }
});

dom.createGroupCancel?.addEventListener('click', () => {
    dialogClose(dom.createGroupOverlay);
    dom.groupNameInput.value = '';
    dom.groupMemberError.style.display = 'none';
});

async function showInviteDialog(convId) {
    if (!state.user) return;
    try {
        const memberData = await api('GET', `/conversations/${convId}/members`);
        const existingIds = new Set((memberData.members || []).map(m => m.id));
        if (!state.conversations || state.conversations.length === 0) await loadConversations();
        const userMap = new Map();
        for (const conv of state.conversations) {
            if (conv.type === 'private' && conv.other_user && conv.other_user.id !== state.user.id) {
                const u = conv.other_user;
                if (!userMap.has(u.id)) userMap.set(u.id, { id: u.id, nickname: u.nickname || u.username, username: u.username, avatar: u.avatar });
            }
        }
        const allUsers = Array.from(userMap.values()).filter(u => !existingIds.has(u.id));
        const dialogOverlay = document.createElement('div');
        dialogOverlay.className = 'modal-overlay';
        dialogOverlay.innerHTML = `<div class="modal">
            <div class="modal-headline">邀请成员</div>
            <div class="modal-content">
                <div id="invite-member-list" class="group-member-list">
                    ${allUsers.length === 0 ? '<div class="end-indicator">没有可邀请的用户</div>'
                        : allUsers.map(u => `<label class="group-member-item">
                            <img src="${avatarSrc(u.avatar)}" onerror="${avatarOnerror(u.nickname || u.username)}">
                            <span class="member-name">${escapeHtml(u.nickname || u.username)}</span>
                            <input type="checkbox" class="ba-checkbox" data-user-id="${u.id}">
                        </label>`).join('')}
                </div>
                <div id="invite-error" class="error-message" style="display:none"></div>
            </div>
            <div class="modal-actions">
                <button class="btn-text" id="invite-cancel">取消</button>
                <button class="btn-primary" id="invite-submit">邀请</button>
            </div>
        </div>`;
        document.body.appendChild(dialogOverlay);
        dialogOverlay.querySelector('#invite-cancel')?.addEventListener('click', () => { dialogClose(dialogOverlay); dialogOverlay.remove(); });
        dialogOverlay.querySelector('#invite-submit')?.addEventListener('click', async () => {
            const userIds = Array.from(dialogOverlay.querySelectorAll('#invite-member-list .ba-checkbox:checked')).map(cb => parseInt(cb.dataset.userId));
            if (userIds.length === 0) { dialogOverlay.querySelector('#invite-error').textContent = '请至少选择一位用户'; dialogOverlay.querySelector('#invite-error').style.display = 'block'; return; }
            dialogOverlay.querySelector('#invite-error').style.display = 'none';
            try { await api('POST', `/conversations/${convId}/members`, { user_ids: userIds }); dialogClose(dialogOverlay); dialogOverlay.remove(); showToast('邀请成功'); await loadConversations(); }
            catch (e) { dialogOverlay.querySelector('#invite-error').textContent = e.message; dialogOverlay.querySelector('#invite-error').style.display = 'block'; }
        });
        dialogOverlay.addEventListener('click', (e) => { if (e.target === dialogOverlay) { dialogClose(dialogOverlay); dialogOverlay.remove(); } });
        dialogOpen(dialogOverlay);
    } catch (e) { showToast('加载用户列表失败: ' + e.message); }
}

async function checkUnreadConversations() {
    if (!state.user) return;
    try {
        const data = await api('GET', '/conversations/unread');
        const count = data.unread_count || 0;
        if (count > 0) { dom.msgBadge.textContent = count > 99 ? '99+' : count; dom.msgBadge.style.display = ''; }
        else { dom.msgBadge.style.display = 'none'; }
    } catch (_) {}
}

function updateConvUnreadBadge() {
    const totalUnread = state.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    if (totalUnread > 0) { dom.msgBadge.textContent = totalUnread > 99 ? '99+' : totalUnread; dom.msgBadge.style.display = ''; }
    else { dom.msgBadge.style.display = 'none'; }
}

// ===== Utilities =====
function formatTimeShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (diff < 172800) return '昨天';
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatChatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderTextWithLinks(text) {
    if (!text) return '';
    const htmlBlocks = [];
    const placeholderPrefix = '%%HTMLBLOCK_';
    const textWithPlaceholders = text.replace(/\[htmltext\]([\s\S]*?)\[\/htmltext\]/g, (match, content) => {
        const idx = htmlBlocks.length;
        htmlBlocks.push(content);
        return placeholderPrefix + idx + '%%';
    });
    const escaped = escapeHtml(textWithPlaceholders);
    return escaped.replace(/\[link\]([^\[]+)\[text\]([^\[]+?)\[\/link\]/g, (match, url, buttonText) => {
        return `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="inline-link-btn">${buttonText.trim()}</a>`;
    }).replace(/%%HTMLBLOCK_(\d+)%%/g, (match, idx) => htmlBlocks[parseInt(idx)] || '');
}

// ===== Scroll Reveal =====
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
        } else {
            entry.target.classList.remove('reveal');
        }
    });
}, { threshold: 0.1 });

function observeRevealElements() {
    document.querySelectorAll('.post-card:not(.observed)').forEach(el => {
        el.classList.add('observed');
        revealObserver.observe(el);
    });
}

// ===== Init =====
async function init() {
    initTheme();
    try { const user = await api('GET', '/user/me'); state.user = user; } catch (_) { state.user = null; }
    updateAuthUI();
    await renderHome();
    const hash = window.location.hash.slice(1);
    if (hash && /^\d+$/.test(hash)) await scrollToPost(hash);
    else if (hash.startsWith('post:')) {
        const postId = parseInt(hash.slice(5));
        if (postId) openPostDetail(postId);
    } else if (hash.startsWith('page:')) {
        const page = hash.slice(5);
        if (page.startsWith('user:')) {
            const uid = parseInt(page.slice(5));
            if (uid) navigateToUserProfile(uid);
        } else if (['home', 'explore', 'messages', 'profile', 'chat'].includes(page)) {
            navigateTo(page);
        }
    }
    if (state.user) {
        await checkUnread();
        setInterval(() => { if (!document.hidden) checkUnread(); }, 30000);
        await checkUnreadConversations();
        setInterval(() => { if (!document.hidden) checkUnreadConversations(); }, 30000);
    }
    dom.addMusicSubmit?.addEventListener('click', handleAddMusic);
    dom.addMusicCancel?.addEventListener('click', () => dialogClose(dom.addMusicOverlay));
    dom.addMusicOverlay?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMusic(); } });
    $('#search-music-submit')?.addEventListener('click', handleSearchSubmit);
    $('#search-music-cancel')?.addEventListener('click', () => dialogClose($('#search-music-overlay')));
    $('#search-music-clear')?.addEventListener('click', handleSearchClear);
    $('#music-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearchSubmit(); });
    console.log('CRMoment Web App (BA Theme) 已启动');
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith('page:')) return;
    const page = hash.slice(5);
    if (page.startsWith('user:')) {
        const uid = parseInt(page.slice(5));
        if (uid && uid !== state.viewUserId) navigateToUserProfile(uid);
    } else if (['home', 'explore', 'messages', 'profile', 'chat'].includes(page) && page !== state.currentPage) {
        navigateTo(page);
    }
});
