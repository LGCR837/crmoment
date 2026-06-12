# CRMoment 开发文档

> 一个轻量的动态分享社区 + 音乐播放器，PHP + MySQL + Material Web Components SPA。

---

## 目录

1. [项目结构](#1-项目结构)
2. [技术栈](#2-技术栈)
3. [快速部署](#3-快速部署)
4. [数据库](#4-数据库)
5. [API 总览](#5-api-总览)
6. [认证机制](#6-认证机制)
7. [前端架构](#7-前端架构)
8. [音乐广场模块](#8-音乐广场模块)
9. [聊天模块](#9-聊天模块)
10. [通知机制](#10-通知机制)
11. [关键实现细节](#11-关键实现细节)
12. [常见问题](#12-常见问题)

---

## 1. 项目结构

```
crmoment/
│
├── api.php                  # 通用 API 入口（?route=/xxx 方式）
├── api_index.php            # 路由分发（匹配 path → 调用 handler）
├── api_config.php           # 数据库连接 & 全局常量
├── api_helpers.php          # 工具函数（JSON 响应、Token 验证等）
├── api_auth.php             # 注册 / 登录 / 退出
├── api_user.php             # 用户信息 / 头像 / 简介 / 昵称
├── api_posts.php            # 动态 CRUD / 点赞 / 取消点赞
├── api_comments.php         # 评论 CRUD
├── api_notifications.php    # 通知列表 / 未读计数 / 全部已读
├── api_conversations.php    # 私聊 / 群聊 (CRUD + 消息)
├── api_upload.php           # 图片上传
├── api_music.php            # 音乐广场（列表 / 添加 / 修改 / 删除 / 播放+1）
├── api_schema.sql           # 数据库建表脚本（参考用）
│
├── crmusic.php              # 音乐播放页（独立页面，歌词+背景+播放量追踪）
│
├── .htaccess                # Apache 重写规则
├── nginx.conf               # Nginx 配置参考
├── router.php               # PHP 内置开发服务器路由
│
├── index.html               # 站点首页（引导进入 /web/）
│
├── web/                     # ← Web 前端 SPA
│   ├── index.html           #   入口 HTML（包含所有 MWC 对话框）
│   ├── app.js               #   应用逻辑（2300+ 行）
│   └── style.css            #   Material Design 3 样式
│
├── uploads/
│   ├── avatars/             # 用户头像（default.svg 为默认）
│   └── posts/               # 动态图片（按年月归档）
│
└── docs/
    ├── deployment.md        # ← 本文件
    └── todo202606070826.md  # 早期设计稿
```

### 路由方式

本项目支持 **两种** API 调用方式（可混用）：

| 方式 | 示例 | 说明 |
|------|------|------|
| `?route=` 参数 | `/api.php?route=/posts&page=1` | 兼容任何主机，最可靠 |
| URL 重写 | `/app/posts` | 需要 Apache/Nginx 配置重写规则 |

两种方式最终都走到 `api_index.php` 进行路由分发。

---

## 2. 技术栈

| 层 | 技术 | 版本要求 |
|----|------|----------|
| 后端 | PHP | 8.0+（需 pdo_mysql, fileinfo） |
| 数据库 | MySQL / MariaDB | 5.7+ / 10.3+ |
| 前端 | Material Web Components (MWC) | CDN 加载 |
| 图标 | Material Symbols | CDN 加载 |
| 字体 | Roboto | CDN 加载 |
| 部署 | 任意支持 PHP 的虚拟主机 | Apache 或 Nginx |

前端**无构建步骤**，所有依赖通过 CDN 的 importmap 加载：
```html
<script type="importmap">
{
    "imports": {
        "@material/web/": "https://esm.run/@material/web/"
    }
}
</script>
```

---

## 3. 快速部署

### 3.1 数据库

```bash
mysql -u root -p < api_schema.sql
```

或通过 phpMyAdmin 导入 `api_schema.sql`。

### 3.2 修改配置

编辑 `api_config.php`：

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', '你的数据库名');
define('DB_USER', '你的用户名');
define('DB_PASS', '你的密码');
define('SITE_URL', 'https://你的域名');
```

### 3.3 上传

将整个项目上传到网站根目录（如 `public_html/` 或 `www/`）。

### 3.4 目录权限

确保以下目录 PHP 可写入：
- `uploads/avatars/`
- `uploads/posts/`

### 3.5 环境要求

- PHP 8.0+
- PDO MySQL 扩展 (`pdo_mysql`)
- `fileinfo` 扩展（图片验证）
- `json` 扩展（默认开启）

### 3.6 验证

```
访问 https://你的域名/web/           → 进入 Web 版
访问 https://你的域名/api.php        → 返回 API 信息
访问 https://你的域名/api.php?route=/posts → 返回 JSON 列表
```

---

## 4. 数据库

### 4.1 完整表结构

**users** — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED AUTO_INCREMENT | 主键 |
| username | VARCHAR(50) UNIQUE | 用户名 |
| nickname | VARCHAR(50) | 昵称 |
| password_hash | VARCHAR(255) | bcrypt 哈希 |
| avatar | VARCHAR(255) | 头像路径 |
| bio | VARCHAR(200) | 个人简介 |
| created_at | DATETIME | 注册时间 |

**posts** — 动态表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| user_id | INT UNSIGNED | 作者，FK→users |
| content | TEXT | 内容 |
| images | JSON | 图片路径数组 |
| likes_count | INT UNSIGNED | 点赞数 |
| comments_count | INT UNSIGNED | 评论数 |
| created_at | DATETIME | 发布时间 |

**comments** — 评论表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| post_id | INT UNSIGNED | 所属动态 |
| user_id | INT UNSIGNED | 评论者 |
| parent_id | INT UNSIGNED | 父评论（回复用） |
| content | TEXT | 内容 |
| created_at | DATETIME | 评论时间 |

**likes** — 点赞表（联合主键）

| 字段 | 类型 |
|------|------|
| user_id | INT UNSIGNED |
| post_id | INT UNSIGNED |

**auth_tokens** — Token 认证表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| user_id | INT UNSIGNED | 用户 |
| token | VARCHAR(64) UNIQUE | Token 值 |
| expires_at | DATETIME | 过期时间 |
| last_used_at | DATETIME | 最后使用时间 |
| created_at | DATETIME | 创建时间 |

**conversations** — 会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| type | ENUM('private','group') | 类型 |
| name | VARCHAR(100) | 群聊名称 |
| avatar | VARCHAR(255) | 群聊头像 |
| created_by | INT UNSIGNED | 创建者 |
| updated_at | DATETIME | 最后活跃时间 |
| created_at | DATETIME | 创建时间 |

**conversation_members** — 会话参与者

| 字段 | 类型 |
|------|------|
| conversation_id | INT UNSIGNED |
| user_id | INT UNSIGNED |
| last_read_at | DATETIME |
| joined_at | DATETIME |

**messages** — 消息表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| conversation_id | INT UNSIGNED | 所属会话 |
| user_id | INT UNSIGNED | 发送者 |
| content | TEXT | 消息内容 |
| created_at | DATETIME | 发送时间 |

**notifications** — 通知表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| user_id | INT UNSIGNED | 接收者 |
| type | ENUM('comment','reply','like') | 类型 |
| actor_id | INT UNSIGNED | 触发者 |
| post_id | INT UNSIGNED | 关联动态 |
| is_read | TINYINT(1) | 是否已读 |
| created_at | DATETIME | 触发时间 |

**music** — 音乐广场表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT UNSIGNED | 主键 |
| user_id | INT UNSIGNED | 上传者 |
| title | VARCHAR(200) | 音乐名称 |
| music_url | VARCHAR(500) | 音频直链 |
| lrc_url | VARCHAR(500) | 歌词文件直链 |
| bg_url | VARCHAR(500) | 背景图片直链 |
| lrc_pos | VARCHAR(10) DEFAULT 'center' | 歌词位置 |
| plays_count | INT UNSIGNED DEFAULT 0 | 播放量 |
| created_at | DATETIME | 上传时间 |

### 4.2 手动 SQL（已有数据库迁移）

```sql
-- 添加 lrc_pos 列（如果要从旧版升级）
ALTER TABLE `music` ADD COLUMN `lrc_pos` VARCHAR(10) DEFAULT 'center' COMMENT '歌词位置 left/center/right' AFTER `bg_url`;
```

---

## 5. API 总览

### 5.1 统一响应格式

```json
// 成功
{ "code": 0, "message": "ok", "data": { ... } }

// 失败
{ "code": 1, "message": "错误原因" }
```

### 5.2 完整接口列表

#### Auth（认证）

| 接口 | 方法 | 需登录 | Body | 说明 |
|------|------|--------|------|------|
| `/auth/register` | POST | 否 | `{username, nickname, password}` | 注册，返回 token+用户信息 |
| `/auth/login` | POST | 否 | `{username, password}` | 登录（支持用户名或昵称），返回 token |
| `/auth/logout` | POST | 是 | — | 退出，删除当前 token |

#### User（用户）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/user/me` | GET | 是 | 当前用户信息 |
| `/user/{id}` | GET | 否 | 用户公开信息（含动态数） |
| `/user/avatar` | POST | 是 | 上传头像 （multipart: avatar） |
| `/user/bio` | POST | 是 | 修改简介：`{bio}` |
| `/user/nickname` | POST | 是 | 修改昵称：`{nickname}` |

#### Posts（动态）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/posts` | GET | 否 | 列表 `?page=1&size=20`，含 is_liked 状态 |
| `/posts` | POST | 是 | 发布（multipart: content, images[]） |
| `/posts/{id}` | GET | 否 | 详情（含前 10 条评论） |
| `/posts/{id}` | DELETE | 是(作者) | 删除（24小时撤回时限） |
| `/posts/{id}/like` | POST | 是 | 点赞 |
| `/posts/{id}/like` | DELETE | 是 | 取消点赞 |

#### Comments（评论）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/posts/{id}/comments` | GET | 否 | 评论列表 |
| `/posts/{id}/comments` | POST | 是 | 发评论：`{content, parent_id?}` |
| `/comments/{id}` | DELETE | 是(作者) | 删除评论 |

#### Notifications（通知）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/notifications` | GET | 是 | 通知列表 |
| `/notifications/unread` | GET | 是 | 未读计数 |
| `/notifications/read` | PUT | 是 | 全部标记已读 |

#### Conversations（聊天）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/conversations` | GET | 是 | 会话列表 |
| `/conversations` | POST | 是 | 创建会话：`{type, name?, member_ids[]}` |
| `/conversations/unread` | GET | 是 | 未读会话计数 |
| `/conversations/{id}/messages` | GET | 是 | 消息列表 `?before_id=` |
| `/conversations/{id}/messages` | POST | 是 | 发送消息：`{content}` |
| `/conversations/{id}/read` | POST | 是 | 标记已读 |
| `/conversations/{id}/members` | GET | 是 | 成员列表 |
| `/conversations/{id}/members` | POST | 是 | 添加成员：`{user_ids[]}` |

#### Music（音乐广场）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/music` | GET | 否 | 列表 `?page=1&size=50` |
| `/music` | POST | 是 | 添加：`{title, music_url, lrc_url, bg_url?, lrc_pos?}` |
| `/music/{id}` | PUT | 是(作者) | 修改 |
| `/music/{id}` | DELETE | 是(作者) | 删除 |
| `/music/{id}/play` | POST | 否 | 播放量+1 |

#### Upload（上传）

| 接口 | 方法 | 需登录 | 说明 |
|------|------|--------|------|
| `/upload/image` | POST | 是 | 上传单张图片（multipart: image） |

---

## 6. 认证机制

使用 **Token 认证**（非 Session），适合跨设备/无状态场景。

### 认证流程

```
注册/登录
  → 后端生成 64 字符随机 Token（bin2hex(random_bytes(32))）
  → 返回给前端
  → 前端存入 localStorage key="crmoment-token"

后续请求
  → Token 通过以下方式之一传递：
    1. JSON body 中的 token 字段（POST/PUT）
    2. GET/DELETE 查询参数 ?token=xxx
    3. FormData 中的 token 字段（multipart）
```

### Token 特性

| 特性 | 说明 |
|------|------|
| 有效期 | 30 天 |
| 自动延期 | 每次请求自动重置过期时间（30天） |
| 多设备 | 同一账号可同时拥有多个有效 Token |
| 退出 | 仅删除当前 Token，不影响其他设备 |
| 生成 | `bin2hex(random_bytes(32))` → 64 字符，不可预测 |

### 关键函数

| 函数 | 位置 | 说明 |
|------|------|------|
| `getTokenFromRequest()` | api_helpers.php:67 | 从 GET/POST/JSON body 提取 token |
| `validateToken($token)` | api_helpers.php:88 | 验证+延期，返回 user_id |
| `requireLogin()` | api_helpers.php:39 | 未登录中断返回 401 |
| `getCurrentUserId()` | api_helpers.php:54 | 可能为 null（给游客用） |

---

## 7. 前端架构

### 7.1 页面路由（前端 SPA）

前端是纯客户端 SPA，通过 `navigateTo(page)` 切换页面：

| 页面 | 路由标识 | 渲染函数 | 说明 |
|------|----------|----------|------|
| 主页 | `home` | `renderHome()` | 动态信息流 |
| 信息 | `messages` | `renderConversationList()` | 会话列表 |
| 聊天详情 | `chat` | `renderConversationDetail(id)` | 消息面板 |
| 我的 | `profile` | `renderProfile()` | 个人主页（自己） |
| 他人主页 | `user` | `renderUserProfile(id)` | 浏览他人 |
| 发现 | `explore` | `renderExplore()` | 介绍 + 音乐广场 |

### 7.2 核心状态对象

```javascript
const state = {
    user,              // 当前登录用户对象（null 表示未登录）
    posts,             // 当前动态列表
    page,              // 分页页码
    hasMore,           // 是否还有更多动态
    loading,           // 加载中
    currentPage,       // 当前路由
    viewUserId,        // 正在查看的用户 ID
    music,             // 音乐广场列表
    editingMusicId,    // 正在编辑的音乐 ID（null=添加模式）
    commentPostId,     // 评论对话框关联的动态 ID
    selectedImages,    // 待上传图片
    conversations,     // 会话列表
    currentConvId,     // 当前打开的会话 ID
    conversationMessages, // { convId: [messages] }
};
```

### 7.3 对话框清单

| dialog id | 用途 |
|-----------|------|
| `#auth-dialog` | 登录/注册 |
| `#composer-dialog` | 发布动态 |
| `#notif-dialog` | 通知列表 |
| `#comment-dialog` | 评论 |
| `#image-viewer-dialog` | 图片查看 |
| `#create-group-dialog` | 创建群聊 |
| `#add-music-dialog` | 添加/编辑音乐 |

### 7.4 API 请求封装

```javascript
// 统一 api() 函数自动处理 token 传递
async function api(method, path, body = null)
// GET 无 body → token 拼到 URL
// POST/PUT JSON → token 合并到 body
// FormData → token 作为字段追加
```

### 7.5 关键文件函数索引（app.js）

| 函数 | 行号范围 | 说明 |
|------|---------|------|
| `api()` | ~130 | 通用 API 请求 |
| `dialogOpen()` / `dialogClose()` | ~196 | 对话框控制 |
| `switchAuthMode()` | ~239 | 切换登录/注册 |
| `handleAuthSubmit()` | ~252 | 登录/注册提交 |
| `updateAuthUI()` | ~311 | 更新导航栏用户状态 |
| `navigateTo()` | ~372 | 页面路由 |
| `renderHome()` | ~395 | 渲染主页 |
| `loadPosts()` | ~422 | 加载动态列表 |
| `renderPostCard()` | ~558 | 单条动态卡片渲染 |
| `handleLike()` | ~621 | 点赞/取消 |
| `renderProfile()` | ~952 | 个人主页渲染 |
| `renderExplore()` | ~1237 | 发现页渲染 |
| `loadMusic()` | ~1284 | 加载音乐列表 |
| `renderMusicList()` | ~1297 | 渲染音乐广场 |
| `openAddMusicDialog()` | ~1395 | 打开添加/编辑音乐对话框 |
| `handleAddMusic()` | ~1420 | 添加/编辑音乐提交 |
| `formatTime()` | ~2243 | 时间格式化 |
| `escapeHtml()` | ~2260 | HTML 转义 |
| `init()` | ~2268 | 应用初始化 |

---

## 8. 音乐广场模块

### 8.1 数据流

```
用户添加音乐
  → 前端 POST /music {title, music_url, lrc_url, bg_url?, lrc_pos?}
  → 后端验证 → INSERT music → 返回 success
  → 前端刷新列表 loadMusic()

用户播放音乐
  → 点击卡片 → window.open('/crmusic.php?参数')
  → crmusic.php 渲染播放页
  → 前端 JS 监听 audio.play 事件 → POST /music/{id}/play
```

### 8.2 crmusic.php 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 音乐 ID（传了才统计播放量） |
| `music` | 是 | 音频直链 |
| `lrc` | 是 | 歌词文件直链 |
| `bg` | 否 | 背景图片直链 |
| `lrc_pos` | 否 | 歌词位置：left/center(默认)/right |

### 8.3 歌词位置实现

```
.left  → text-align: left;   padding-left: 5%;
.center→ text-align: center;
.right → text-align: right;  padding-right: 5%;
```

- 小屏幕（<768px）强制居中
- 当前歌词：`font-size: 1.35em` + `font-weight: 700`（不用 transform scale，避免对齐和动画问题）
- 过渡动画：`transition: font-size 0.4s ease, text-shadow 0.4s ease`

### 8.4 播放量统计

- 前端监听 `<audio>` 的 `play` 事件
- 每次播放开始（含循环重播）发送 `POST /music/{id}/play`
- `play` 事件在 audio 从暂停→播放时触发，loop 结束重播也会触发

### 8.5 编辑/删除

- 仅音乐上传者可见编辑/删除按钮
- 编辑：复用添加对话框，预填数据，调用 `PUT /music/{id}`
- 删除：confirm 确认后调用 `DELETE /music/{id}`

---

## 9. 聊天模块

### 9.1 架构

- 私聊：`conversations.type = 'private'`，自动创建/复用
- 群聊：`conversations.type = 'group'`，需创建并添加成员
- 消息通过轮询获取（30 秒间隔）
- `last_read_at` 跟踪已读位置

### 9.2 页面层级

```
会话列表（renderConversationList）
  └ 点击 → 聊天详情（renderConversationDetail）
      ├ 消息列表（含图片、撤回）
      └ 输入框 → doSend()
```

### 9.3 关键函数

| 函数 | 说明 |
|------|------|
| `loadConversations()` | 加载会话列表 |
| `renderConversationDetail(convId)` | 进入聊天界面 |
| `doSend()` | 发送消息 |
| `startPolling(convId)` | 开始轮询新消息 |
| `stopPolling(convId)` | 停止轮询 |

---

## 10. 通知机制

### 10.1 触发规则

| 用户行为 | 接收者 | 通知 type |
|----------|--------|-----------|
| 评论他人动态 | 动态作者 | `comment` |
| 回复他人评论 | 原评论作者 | `reply` |
| 点赞他人动态 | 动态作者 | `like` |

> 自己操作自己 → 不触发通知（`createNotification` 中跳过）

### 10.2 前端轮询

```javascript
// 登录后每 30 秒检查
setInterval(checkUnread, 30000);
// checkUnread 请求 /notifications/unread
// 有未读 → 显示红点 #notif-badge
```

---

## 11. 关键实现细节

### 11.1 头像处理

- 上传：`POST /user/avatar`（multipart），覆盖保存为 `{user_id}.jpg`
- 默认：`/uploads/avatars/default.svg`（SVG 占位图）
- 前端 onerror 回退：动态生成首字母 SVG

### 11.2 动态图片

- 发动态时通过 multipart `images[]` 字段上传（最多 9 张）
- 存储路径：`/uploads/posts/{year}/{month}/{random}.jpg`
- 删除动态时同时删除物理文件
- 撤回时限：**24 小时**（从 8 分钟调整）

### 11.3 前端主题切换

- 支持亮/暗模式
- 用户手动选择 → 保存到 localStorage
- 未选择 → 跟随系统 `prefers-color-scheme`
- 系统主题变化时自动跟随（仅当用户没手动选过）

### 11.4 MWC 兼容处理

```javascript
// 按钮中文 padding 修复
function fixButtonPadding() { ... }

// Dialog margin 修复（MWC shadow DOM 继承链问题）
dialog.style.margin = 'auto';
```

### 11.5 对话框遮罩管理

```javascript
let dialogCount = 0;
// 打开 +1，关闭 -1
// dialogCount > 0 → body.dialog-open（禁止滚动）
// 监听 dialog close 事件（处理 Escape 键关闭）
```

### 11.6 辅助函数

| 函数 | 说明 |
|------|------|
| `formatTime(dateStr)` | 智能时间显示：刚刚/X分钟前/今天 HH:mm/日期 |
| `formatTimeShort(dateStr)` | 简短版（聊天用） |
| `formatChatTime(dateStr)` | 聊天时间戳 |
| `escapeHtml(str)` | XSS 防护 |

---

## 12. 常见问题

**Q: 访问 API 返回 404？**
A: 检查 `.htaccess` 或 `nginx.conf` 是否正确配置 URL 重写。如果主机不支持重写，使用 `/api.php?route=/xxx` 方式。

**Q: 动态图片上传失败？**
A: 检查 `uploads/posts/` 目录是否有写入权限（PHP 需要）。

**Q: 音乐播放没有统计播放量？**
A: 检查 `crmusic.php` URL 中是否包含 `id` 参数，只有传了 `id` 才会发送 `POST /music/{id}/play`。

**Q: 歌词位置 left/right 不生效？**
A: 手机屏幕（<768px）强制居中，请在平板或桌面端测试。

**Q: 如何清空所有通知？**
A: 前端支持「全部已读」按钮，调用 `PUT /notifications/read`。

**Q: PHP 版本兼容问题？**
A: 本项目使用 `str_contains()`、`match()` 等 PHP 8.0+ 特性，PHP 7.x 无法运行。

**Q: 新增数据库表后需要做什么？**
A: 修改 `api_schema.sql`（参考用），然后手动执行 ALTER TABLE。后端新建 `api_xxx.php` 文件，在 `api_index.php` 中 require + 注册路由。

**Q: 前端如何新增一个页面？**
A: 在 `navigateTo()` 中添加 case，编写对应的 `renderXxx()` 函数，在导航栏或按钮中调用 `navigateTo('xxx')`。
