# CRMoment · 轻量社交动态分享平台

<p align="center">
  <img src="web/crmomentlogo.png" alt="CRMoment" width="360">
</p>

<p align="center">
  <strong>轻量的社交动态分享平台 · 附带音乐广场与即时聊天</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PHP-8.0%2B-777BB4?logo=php" alt="PHP 8.0+">
  <img src="https://img.shields.io/badge/MySQL-5.7%2B-4479A1?logo=mysql" alt="MySQL 5.7+">
  <img src="https://img.shields.io/badge/前端-Vanilla%20JS%20SPA-F7DF1E?logo=javascript" alt="Vanilla JS SPA">
  <img src="https://img.shields.io/badge/MWC-Material%20Web%20Components-6200EE?logo=materialdesign" alt="Material Web Components">
  <img src="https://img.shields.io/badge/主题-Blue%20Archive-4a9fc7" alt="Blue Archive Theme">
</p>

---

## 📖 简介

**CRMoment** 是一个轻量级社交动态分享平台，支持发布图文/视频动态、点赞评论、私聊群聊，还内置了**音乐广场**模块，用户可以上传和分享音乐。前端采用 Material Web Components 构建的 SPA，无构建步骤，部署简单，特别适合个人或小团队搭建专属社交空间。

> 项目名称灵感来源于 "Customer Relationship" 与 "Moment" 的结合，意在记录和分享每一个珍贵时刻。

---

## ✨ 功能特性

### 🏠 社交动态
- 发布图文/视频动态，支持最多 9 张图片
- 点赞 & 取消点赞
- 评论 & 回复评论
- 24 小时内可撤回自己的动态
- 动态置顶功能

### 👤 用户系统
- 注册 / 登录 / 退出（Token 认证）
- 个人资料：昵称、头像、简介
- 个人主页，展示用户所有动态
- 支持亮色 / 暗色主题切换（跟随系统或手动设置）

### 🔔 通知系统
- 评论、回复、点赞实时通知
- 未读红点提示
- 一键全部已读

### 💬 即时聊天
- 私聊（一对一）
- 群聊（多人）
- 消息轮询（30 秒间隔）
- 会话列表 + 未读计数

### 🎵 音乐广场
- 上传分享音乐（支持歌词、背景图/视频）
- 歌词位置（左/中/右）与颜色（亮/暗）自定义
- 播放量统计
- 用户自定义歌单
- 多平台音乐源支持（网易云、酷狗、QQ 音乐）

### 🎨 前端特色
- Material Web Components (MWC) 构建的 SPA
- Blue Archive 主题风格
- 响应式设计，PC 与移动端自适应
- 免构建，纯 CDN 加载

---

## 🛠️ 技术栈

| 层 | 技术 | 版本要求 |
|----|------|----------|
| 后端 | PHP | 8.0+（需 pdo_mysql, fileinfo） |
| 数据库 | MySQL / MariaDB | 5.7+ / 10.3+ |
| 前端 | 原生 JavaScript (ES Modules) | 现代浏览器 |
| UI 框架 | Material Web Components (MWC) | CDN 加载 |
| 图标 | Material Symbols | CDN 加载 |
| 音乐引擎 | Meting (MKOnlineMusicPlayer 优化版) | 内置 |
| 部署 | 任意支持 PHP 的虚拟主机 | 无需 URL 重写 |

---

## 🚀 快速开始

### 环境要求

- PHP 8.0+
- PDO MySQL 扩展 (`pdo_mysql`)
- `fileinfo` 扩展（图片上传验证）
- `json` 扩展（默认开启）
- MySQL 5.7+ 或 MariaDB 10.3+

### 安装步骤

#### 1. 创建数据库

```bash
mysql -u root -p < api_schema.sql
```

或通过 phpMyAdmin 导入 `api_schema.sql`。

#### 2. 修改配置

编辑 `api_config.php`：

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', '你的数据库名');
define('DB_USER', '你的用户名');
define('DB_PASS', '你的密码');
define('SITE_URL', 'https://你的域名');  // 可选，结尾不要斜杠
```

#### 3. 上传文件

将整个项目上传到网站根目录（如 `public_html/` 或 `www/`）。

#### 4. 设置目录权限

确保以下目录 PHP 可写入：

```
uploads/avatars/
uploads/posts/
```

#### 5. 验证安装

| 访问地址 | 说明 |
|----------|------|
| `https://你的域名/` | 站点首页，引导进入 Web 版 |
| `https://你的域名/web/` | Web 前端 SPA |
| `https://你的域名/api.php` | API 根路径，返回版本信息 |
| `https://你的域名/api.php?route=/posts` | 动态列表 API |

---

## 📁 项目结构

```
crmoment/
├── api.php                  # 唯一 API 入口（?route=/xxx 路由）
├── api_index.php            # 路由分发
├── api_config.php           # 数据库连接 & 全局常量
├── api_helpers.php          # 工具函数（JSON 响应、Token 验证）
├── api_auth.php             # 注册 / 登录 / 退出
├── api_user.php             # 用户信息 / 头像 / 简介 / 昵称
├── api_posts.php            # 动态 CRUD / 点赞
├── api_comments.php         # 评论 CRUD
├── api_notifications.php    # 通知列表 / 未读计数
├── api_conversations.php    # 私聊 / 群聊
├── api_upload.php           # 图片 / 视频上传
├── api_music.php            # 音乐广场（列表 / 添加 / 播放）
├── api_schema.sql           # 数据库建表脚本
│
├── index.html               # 站点首页
├── web/                     # Web 前端 SPA
│   ├── index.html           # 入口 HTML
│   ├── app.js               # 应用逻辑
│   └── style.css            # Material Design 3 样式
│
├── crmusic.html             # 音乐播放页（独立页面）
├── crmusic/                 # 音乐播放器资源（MxuePlay）
│
├── blockweb/                # BlockWeb 实验性玩具（非主站）
├── phpMyAdmin4.8.5/         # 内置 phpMyAdmin
│
├── uploads/
│   ├── avatars/             # 用户头像
│   └── posts/               # 动态图片（按年月归档）
│
├── docs/
│   ├── deployment.md        # 详细开发文档
│   └── todo202606070826.md  # 早期设计稿
│
├── migrations/              # 数据库迁移脚本
├── .htaccess                # Apache 缓存优化配置
├── nginx.conf               # Nginx 配置参考
└── README.md                # 本文件
```

---

## 📡 API 概览

所有 API 基地址：`/api.php?route=`

**示例：** `GET /api.php?route=/posts&page=1`

### 统一响应格式

```json
// 成功
{ "code": 0, "message": "ok", "data": { ... } }

// 失败
{ "code": 1, "message": "错误原因" }
```

### 认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/auth/register` | POST | 注册（username, nickname, password） |
| `/auth/login` | POST | 登录（支持用户名或昵称） |
| `/auth/logout` | POST | 退出 |

### 动态

| 接口 | 方法 | 说明 |
|------|------|------|
| `/posts` | GET | 动态列表（分页） |
| `/posts` | POST | 发布动态 |
| `/posts/{id}` | GET | 动态详情 |
| `/posts/{id}` | DELETE | 删除动态（24h 内） |
| `/posts/{id}/like` | POST/DELETE | 点赞 / 取消点赞 |

### 评论

| 接口 | 方法 | 说明 |
|------|------|------|
| `/posts/{id}/comments` | GET | 评论列表 |
| `/posts/{id}/comments` | POST | 发表评论 |
| `/comments/{id}` | DELETE | 删除评论 |

### 聊天

| 接口 | 方法 | 说明 |
|------|------|------|
| `/conversations` | GET | 会话列表 |
| `/conversations` | POST | 创建会话 |
| `/conversations/{id}/messages` | GET | 消息列表 |
| `/conversations/{id}/messages` | POST | 发送消息 |

### 音乐

| 接口 | 方法 | 说明 |
|------|------|------|
| `/music` | GET | 音乐列表（支持搜索） |
| `/music` | POST | 添加音乐 |
| `/music/{id}` | PUT/DELETE | 修改 / 删除 |
| `/music/{id}/play` | POST | 播放量 +1 |

### 通知

| 接口 | 方法 | 说明 |
|------|------|------|
| `/notifications` | GET | 通知列表 |
| `/notifications/unread` | GET | 未读计数 |
| `/notifications/read` | PUT | 全部标记已读 |

> 详细 API 文档请参阅 [docs/deployment.md](docs/deployment.md)

---

## 🔐 认证机制

使用 **Token 认证**（非 Session），适合跨设备 / 无状态场景。

- 注册 / 登录后返回 64 字符随机 Token
- 前端存入 `localStorage`，键名 `crmoment-token`
- 后续请求通过 GET 参数、POST Body 或 FormData 字段传递
- Token 有效期 30 天，每次请求自动续期
- 同一账号可同时拥有多个有效 Token（多设备）
- 退出仅删除当前 Token，不影响其他设备

---

## 🎵 音乐播放器

音乐播放页 `crmusic.html` 为独立页面，支持以下 URL 参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 音乐 ID（传了才统计播放量） |
| `music` | 是 | 音频直链 |
| `lrc` | 是 | 歌词文件直链（LRC 格式） |
| `bg` | 否 | 背景图片直链 |
| `video` | 否 | 背景视频直链 |
| `lrc_pos` | 否 | 歌词位置：left / center（默认）/ right |
| `lrc_color` | 否 | 歌词颜色：light（默认）/ dark |

示例：`/crmusic.html?music=https://...&lrc=https://...&lrc_pos=center&lrc_color=light`

---

## 🖥️ 部署到生产环境

### Apache

`.htaccess` 已包含静态资源缓存优化配置，无需额外修改。

### Nginx

参考 `nginx.conf` 配置，主要包含：

- API 路由重写
- 静态资源缓存
- SPA 回退到 `web/index.html`
- 保护 `.sql` / `.md` 等敏感文件

### 内置 phpMyAdmin

项目内含 `phpMyAdmin 4.8.5`，访问 `/phpMyAdmin4.8.5/` 即可使用。  
**建议生产环境删除或限制访问该目录。**

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交改动：`git commit -m 'feat: add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 开发规范

- 后端新增 API：创建 `api_xxx.php` → 在 `api_index.php` 中 `require` + 注册路由
- 前端新增页面：在 `navigateTo()` 中添加 case → 编写 `renderXxx()` 函数
- 数据库变更：修改 `api_schema.sql`（参考用）并手动执行 `ALTER TABLE`

---

## 📄 许可证

本项目仅供学习交流使用，请勿用于商业用途。

---

## 🙏 致谢

- [MKOnlineMusicPlayer](https://github.com/mengkunsoft/MKOnlineMusicPlayer) - 音乐播放器原型
- [MxuePlay](https://github.com/mxue12138/MKOnlineMusicPlayer) - 音乐播放器优化版
- [Material Web Components](https://github.com/material-components/material-web) - UI 组件库
- [Material Symbols](https://fonts.google.com/icons) - 图标库

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/LGCR837">LGCR837</a></sub>
</p>