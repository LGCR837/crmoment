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
    currentPage: 'home',      // home / profile / explore / user
    viewUserId: null,         // 正在查看的用户 ID（当 currentPage === 'user'）
    commentPostId: null,      // 正在查看评论的动态 ID
    selectedImages: [],       // 待上传图片
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
};

// ===== API 请求 =====
async function api(method, path, body = null) {
    const opts = {
        method,
        headers: {},
        credentials: 'same-origin',
    };

    if (body instanceof FormData) {
        opts.body = body;
    } else if (body !== null) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
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
    dom.authPasswordConfirm.style.display = mode === 'register' ? '' : 'none';
    dom.authPasswordConfirm.required = mode === 'register';
}

dom.authTabLogin.addEventListener('click', () => switchAuthMode('login'));
dom.authTabRegister.addEventListener('click', () => switchAuthMode('register'));

dom.authSubmit.addEventListener('click', async () => {
    const username = dom.authUsername.value.trim();
    const password = dom.authPassword.value;
    const confirmPassword = dom.authPasswordConfirm.value;

    if (!username || !password) {
        dom.authError.textContent = '请填写用户名和密码';
        dom.authError.style.display = 'block';
        return;
    }

    if (authMode === 'register' && password !== confirmPassword) {
        dom.authError.textContent = '两次密码输入不一致';
        dom.authError.style.display = 'block';
        return;
    }

    try {
        const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
        const result = await api('POST', endpoint, { username, password });

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
        dom.userAvatarImg.src = state.user.avatar || '/uploads/avatars/default.svg';
        dom.userAvatarImg.onerror = function() {
            this.src = 'data:image/svg+xml,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill="#e0e0e0"/>
                    <text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">${state.user.username[0]}</text>
                </svg>`
            );
        };
    } else {
        dom.navAuth.style.display = 'flex';
        dom.navUser.style.display = 'none';
        dom.navProfile.style.display = 'none';
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

    switch (page) {
        case 'home': renderHome(); break;
        case 'profile': renderProfile(); break;
        case 'explore': renderExplore(); break;
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
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#e0e0e0"/><text x="20" y="26" text-anchor="middle" font-size="18" fill="#999">' + post.username[0] + '</text></svg>')}'">
            <span class="post-author" data-user-id="${post.user_id}">${escapeHtml(post.username)}</span>
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
    const count = images.length;
    let cls = 'post-images';
    if (count === 1) cls += ' single';
    else if (count === 2) cls += ' multi-2';
    else if (count === 3) cls += ' multi-3';
    else cls += ' multi-4';

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
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e0e0e0"/><text x="16" y="21" text-anchor="middle" font-size="14" fill="#999">' + c.username[0] + '</text></svg>')}'">
            <div class="comment-body">
                <div class="comment-author" data-user-id="${c.user_id}">${escapeHtml(c.username)}</div>
                <div class="comment-text">${escapeHtml(c.content)}</div>
                <div class="comment-time">${formatTime(c.created_at)}</div>
                ${c.replies && c.replies.length > 0 ? c.replies.map(r => `
                    <div class="comment-item" style="margin-top:8px;padding-left:42px;border:none">
                        <img src="${r.avatar || '/uploads/avatars/default.svg'}" class="comment-avatar" data-user-id="${r.user_id}"
                             onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e0e0e0"/><text x="16" y="21" text-anchor="middle" font-size="14" fill="#999">' + r.username[0] + '</text></svg>')}'">
                        <div class="comment-body" style="margin-left:0">
                            <div class="comment-author" data-user-id="${r.user_id}">${escapeHtml(r.username)}</div>
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

    // 追加新图片预览
    const newPreviews = newFiles.map(f => {
        const url = URL.createObjectURL(f);
        return `<img src="${url}" alt="">`;
    }).join('\n');
    dom.imagePreview.insertAdjacentHTML('beforeend', newPreviews);

    // 清空 input，允许重复选择同一文件
    dom.composerImagesInput.value = '';
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
            dom.notifList.innerHTML = data.list.map(n => {
                const text = n.type === 'like' ? '赞了你的动态' :
                             n.type === 'comment' ? '评论了你的动态' :
                             '回复了你的评论';
                return `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" data-post-id="${n.post_id || ''}">
                    <div class="notif-text">
                        <strong>${escapeHtml(n.actor_username)}</strong> ${text}
                    </div>
                    <div class="notif-time">${formatTime(n.created_at)}</div>
                </div>`;
            }).join('\n');

            // 点击通知跳转到对应动态
            dom.notifList.querySelectorAll('.notif-item').forEach(el => {
                el.style.cursor = 'pointer';
                el.addEventListener('click', () => {
                    const postId = el.dataset.postId;
                    if (!postId) return;
                    dialogClose(dom.notifDialog);
                    navigateTo('home');
                    // 等主页渲染完成后滚动到目标动态
                    const scrollTimer = setInterval(() => {
                        const target = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            target.style.boxShadow = '0 0 0 3px var(--md-sys-color-primary, #6750a4), var(--md-elevation-level2)';
                            setTimeout(() => { target.style.boxShadow = ''; }, 3000);
                            clearInterval(scrollTimer);
                        }
                    }, 200);
                    // 5 秒超时停止轮询
                    setTimeout(() => clearInterval(scrollTimer), 5000);
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
                 onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="#e0e0e0"/><text x="40" y="50" text-anchor="middle" font-size="30" fill="#999">' + state.user.username[0] + '</text></svg>')}'">
            <div class="profile-username">${escapeHtml(state.user.username)}</div>
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
                     onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="#e0e0e0"/><text x="40" y="50" text-anchor="middle" font-size="30" fill="#999">' + user.username[0] + '</text></svg>')}'">
                <div class="profile-username">${escapeHtml(user.username)}</div>
                <div class="profile-bio">${user.bio ? escapeHtml(user.bio) : '这个人很懒，什么都没写...'}</div>
                <div class="profile-stats">
                    <div class="stat"><div class="stat-num">${user.posts_count || 0}</div><div class="stat-label">动态</div></div>
                </div>
            </div>
            <div class="section-title">${escapeHtml(user.username)} 的动态</div>
            <div id="user-posts"></div>
        `;

        $('#btn-back-from-user')?.addEventListener('click', () => {
            state.currentPage = 'home';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            const homeBtn = document.querySelector('.nav-btn[data-page="home"]');
            if (homeBtn) homeBtn.classList.add('active');
            renderHome();
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
        <div class="card" style="background:#fff;border-radius:16px;padding:24px;box-shadow:var(--md-elevation-level1);text-align:center;">
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
        const target = document.querySelector(`.post-card[data-post-id="${hash}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.boxShadow = '0 0 0 3px var(--md-sys-color-primary, #6750a4), var(--md-elevation-level2)';
            setTimeout(() => {
                target.style.boxShadow = '';
            }, 3000);
        }
    }

    // 定时检查未读通知
    if (state.user) {
        await checkUnread();
        setInterval(checkUnread, 30000);
    }

    console.log('CRMoment Web App 已启动');

    // 修复按钮间距（在 DOM 填充完毕后执行）
    setupPadObserver();
}

// 等待 DOM 加载后初始化
document.addEventListener('DOMContentLoaded', init);
