# CRMoment 开发文档

## 项目结构

```
crmoment/
├── index.html               # 首页/介绍页（引导访问 /web/）
├── .htaccess                # Apache URL 重写规则
├── nginx.htaccess           # Nginx 配置参考
│
├── web/                     # ← Web 前端（Material Web Components SPA）
│   ├── index.html           #   入口页
│   ├── app.js               #   应用逻辑（路由、认证、动态流）
│   └── style.css            #   Material Design 3 样式
│
├── app/
│   ├── index.php            # 路由入口（Front Controller）
│   ├── config.php           # 数据库 & Session 配置
│   ├── helpers.php          # 工具函数（JSON 响应、认证检查等）
│   ├── db/
│   │   └── schema.sql       # 数据库建表脚本
│   └── handlers/
│       ├── auth.php         # 注册 / 登录 / 退出
│       ├── user.php         # 用户信息 / 头像上传
│       ├── posts.php        # 动态 CRUD / 点赞
│       ├── comments.php     # 评论 CRUD
│       ├── notifications.php # 通知列表 / 未读 / 标记已读
│       └── upload.php       # 单张图片上传
│
├── uploads/
│   ├── avatars/             # 用户头像目录
│   │   └── default.svg      # 默认头像占位图
│   └── posts/               # 动态图片（自动创建）
│
└── docs/
    └── todo202606070826.md  # 需求设计与 API 规范
```

## 部署步骤

### 1. 导入数据库

创建 MySQL 数据库，然后导入 schema：

```bash
mysql -u root -p < api_schema.sql
```

或者通过 phpMyAdmin 导入 `api_schema.sql`。

### 2. 修改配置

编辑 `api_config.php`，修改数据库连接信息：

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'crmoment');
define('DB_USER', '你的数据库用户名');
define('DB_PASS', '你的数据库密码');
define('SITE_URL', 'https://你的域名');
```

### 3. 上传到虚拟主机

将整个项目上传到网站根目录（如 `public_html/` 或 `www/`）。

### 4. 确保目录可写

确保以下目录有写入权限（PHP 需要写入头像和动态图片）：

- `/uploads/avatars/`
- `/uploads/posts/`

### 5. Apache 环境

`.htaccess` 已预配置，Apache 需开启 `mod_rewrite`。

### 6. Nginx 环境

参考 `nginx.conf` 的内容，将其配置到 Nginx 的 `server` 块中。
如果使用宝塔面板或其他管理面板，通常在「网站设置」→「配置文件」中编辑。

### 7. PHP 环境要求

- PHP 8.0+
- PDO MySQL 扩展 (`pdo_mysql`)
- `fileinfo` 扩展（用于图片验证）
- `session` 扩展（默认开启）
- `json` 扩展（默认开启）

## 验证部署

访问 `https://你的域名/index.html`，看到 API 文档页即表示前端部署成功。

访问 `https://你的域名/app/posts`，预期返回：

```json
{ "code": 0, "message": "ok", "data": { "list": [], "total": 0, "page": 1, "size": 20, "has_more": false } }
```

## API 接口列表

完整 API 规范见 [todo202606070826.md](./todo202606070826.md)。

| 接口路径 | 方法 | 需登录 | 说明 |
|---------|------|--------|------|
| `/app/auth/register` | POST | 否 | 注册：`{username, password}` |
| `/app/auth/login` | POST | 否 | 登录：`{username, password}` |
| `/app/auth/logout` | POST | 是 | 退出 |
| `/app/user/me` | GET | 是 | 当前登录者信息 |
| `/app/user/{id}` | GET | 否 | 用户公开信息 |
| `/app/user/avatar` | POST | 是 | 上传头像（multipart: avatar） |
| `/app/posts` | GET | 否 | 动态列表 `?page=1&size=20` |
| `/app/posts` | POST | 是 | 发动态（multipart: content, images[]） |
| `/app/posts/{id}` | GET | 否 | 动态详情（含评论） |
| `/app/posts/{id}` | DELETE | 是(作者) | 删除动态 |
| `/app/posts/{id}/like` | POST | 是 | 点赞 |
| `/app/posts/{id}/like` | DELETE | 是 | 取消点赞 |
| `/app/posts/{id}/comments` | GET | 否 | 评论列表 |
| `/app/posts/{id}/comments` | POST | 是 | 发评论：`{content, parent_id?}` |
| `/app/comments/{id}` | DELETE | 是(作者) | 删除评论 |
| `/app/notifications` | GET | 是 | 通知列表 |
| `/app/notifications/unread` | GET | 是 | 未读数量 |
| `/app/notifications/read` | PUT | 是 | 全部标记已读 |
| `/app/upload/image` | POST | 是 | 上传图片（multipart: image） |

## 统一响应格式

```json
// 成功
{ "code": 0, "message": "ok", "data": {...} }

// 失败
{ "code": 1, "message": "错误原因" }
```

## 认证机制

使用 Token 认证。登录/注册成功后，后端生成一个 64 字符的随机 Token 并返回给前端，前端存储在 `localStorage` 中。每次请求通过 `Authorization: Bearer <token>` 头部携带。

### Token 特性

- 每个账号可以同时拥有多个有效 Token（跨设备/跨浏览器登录）
- Token 有效期：30 天
- 每次请求会自动延期 Token（重置过期时间为 30 天后）
- 退出登录时，该 Token 从服务端删除
- Token 使用 `bin2hex(random_bytes(32))` 生成，不可猜测

### 接口说明

- 需要登录的接口 → 调用 `requireLogin()`，未登录返回 401
- 免登录接口 → 所有游客可访问（如浏览动态列表）
- 动态的"是否已点赞"状态通过 `getCurrentUserId()` 获取当前用户（可能为 null）

## 通知触发规则

- 评论动态 → 给动态作者发 `comment` 通知
- 回复评论 → 给原评论作者发 `reply` 通知
- 点赞动态 → 给动态作者发 `like` 通知
- 自己操作自己 → 不触发通知

前端可通过轮询 `/notifications/unread`（URL重写为 `/api.php?route=/notifications/unread` 或 `/api_index.php`）获取红点数量。

## Web 前端

前端是基于 Material Web Components (MWC) 构建的单页应用（SPA），位置在 `/web/` 目录。

### 访问方式

- 浏览器访问 `https://你的域名/web/` 即可进入 Web 版
- 首页 `https://你的域名/index.html` 是介绍页，包含进入 Web 版的链接

### 核心功能

| 页面 | 路径 | 功能 |
|------|------|------|
| 主页 | `/web/` 默认 | 动态列表（最新在上），未登录可浏览，登录后可发布/点赞/评论 |
| 我的 | 导航栏"我的"按钮 | 个人资料、头像上传、自己的动态列表 |
| 发现 | 导航栏"发现"按钮 | 平台介绍、快速跳转 |

### 未登录状态

- 浏览动态列表 ✅
- 查看评论 ✅
- 点赞 / 评论 / 发布 → 提示登录

### 技术依赖

前端通过 CDN 加载以下资源（无需本地安装）：

- [Material Web Components](https://github.com/material-components/material-web) - Google 官方 Web Components
- [Material Symbols](https://fonts.google.com/icons) - 图标字体
- [Roboto](https://fonts.google.com/specimen/Roboto) - 字体

## 路由说明

所有 `/app/*` 请求通过 `.htaccess` 重写到 `app/index.php`。路由解析流程：

1. Apache/Nginx 将 `/app/posts?page=1` 重写为 `/app/index.php`
2. `index.php` 解析 `$_SERVER['REQUEST_URI']`，提取 `/posts` 路径
3. 根据 HTTP 方法和路径模式匹配合适的处理器函数
4. 处理器返回 JSON 响应

## 常见问题

**Q: 访问 API 返回 404？**  
A: 检查 `.htaccess` 是否正确上传，Apache 是否启用了 `mod_rewrite`。

**Q: 发布动态时图片上传失败？**  
A: 检查 `uploads/posts/` 目录是否有写入权限。

**Q: 登录后仍然提示"请先登录"？**  
A: 检查 PHP Session 配置，确认 Cookie 域名和路径设置正确。
