/// CRMoment API 封装 — 极简调用，一行初始化即可使用。
///
/// ```dart
/// void main() {
///   CRMomentApi.baseUrl = 'https://crmoment.ccwu.cc';
///   CRMomentApi.token = '...'; // 登录后设置
/// }
/// ```
library;

import 'dart:convert';
import 'dart:io';

/// 统一 API 响应结构
class CrmResponse {
  final int code;
  final String message;
  final dynamic data;

  CrmResponse(this.code, this.message, this.data);

  /// { "code": 0, "message": "ok", "data": {...} }
  factory CrmResponse.fromJson(Map<String, dynamic> json) => CrmResponse(
        json['code'] as int,
        json['message'] as String? ?? '',
        json['data'],
      );

  bool get ok => code == 0;
}

/// ====== 数据模型 ======

class User {
  final int id;
  final String username;
  final String? nickname;
  final String? avatar;
  final String? bio;
  final String? createdAt;
  final int? postsCount;

  User({
    required this.id,
    required this.username,
    this.nickname,
    this.avatar,
    this.bio,
    this.createdAt,
    this.postsCount,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as int,
        username: j['username'] as String,
        nickname: j['nickname'] as String?,
        avatar: j['avatar'] as String?,
        bio: j['bio'] as String?,
        createdAt: j['created_at'] as String?,
        postsCount: j['posts_count'] as int?,
      );

  String get displayName => nickname ?? username;
}

class Post {
  final int id;
  final int userId;
  final String username;
  final String? nickname;
  final String? avatar;
  final String content;
  final List<String> images;
  final int likesCount;
  final int commentsCount;
  final String createdAt;
  final bool isLiked;

  Post({
    required this.id,
    required this.userId,
    required this.username,
    this.nickname,
    this.avatar,
    required this.content,
    required this.images,
    required this.likesCount,
    required this.commentsCount,
    required this.createdAt,
    this.isLiked = false,
  });

  factory Post.fromJson(Map<String, dynamic> j) => Post(
        id: j['id'] as int,
        userId: j['user_id'] as int,
        username: j['username'] as String,
        nickname: j['nickname'] as String?,
        avatar: j['avatar'] as String?,
        content: j['content'] as String? ?? '',
        images: (j['images'] as List?)?.cast<String>() ?? [],
        likesCount: j['likes_count'] as int? ?? 0,
        commentsCount: j['comments_count'] as int? ?? 0,
        createdAt: j['created_at'] as String? ?? '',
        isLiked: j['is_liked'] as bool? ?? false,
      );

  String get authorName => nickname ?? username;
}

class Comment {
  final int id;
  final int userId;
  final String username;
  final String? nickname;
  final String? avatar;
  final String content;
  final int? parentId;
  final String createdAt;

  Comment({
    required this.id,
    required this.userId,
    required this.username,
    this.nickname,
    this.avatar,
    required this.content,
    this.parentId,
    required this.createdAt,
  });

  factory Comment.fromJson(Map<String, dynamic> j) => Comment(
        id: j['id'] as int,
        userId: j['user_id'] as int,
        username: j['username'] as String,
        nickname: j['nickname'] as String?,
        avatar: j['avatar'] as String?,
        content: j['content'] as String? ?? '',
        parentId: j['parent_id'] as int?,
        createdAt: j['created_at'] as String? ?? '',
      );
}

class Notification {
  final int id;
  final String type;
  final int actorId;
  final String actorName;
  final int? postId;
  final bool isRead;
  final String createdAt;

  Notification({
    required this.id,
    required this.type,
    required this.actorId,
    required this.actorName,
    this.postId,
    required this.isRead,
    required this.createdAt,
  });

  factory Notification.fromJson(Map<String, dynamic> j) => Notification(
        id: j['id'] as int,
        type: j['type'] as String,
        actorId: j['actor_id'] as int,
        actorName: j['actor_name'] as String? ?? '',
        postId: j['post_id'] as int?,
        isRead: (j['is_read'] as int? ?? 0) == 1,
        createdAt: j['created_at'] as String? ?? '',
      );
}

class Conversation {
  final int id;
  final String type;
  final String? name;
  final String? displayName;
  final String? displayAvatar;
  final int unreadCount;
  final String? updatedAt;
  final int? lastMsgId;
  final String? lastMsgContent;

  Conversation({
    required this.id,
    required this.type,
    this.name,
    this.displayName,
    this.displayAvatar,
    this.unreadCount = 0,
    this.updatedAt,
    this.lastMsgId,
    this.lastMsgContent,
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        id: j['id'] as int,
        type: j['type'] as String? ?? 'private',
        name: j['name'] as String?,
        displayName: j['display_name'] as String?,
        displayAvatar: j['display_avatar'] as String?,
        unreadCount: j['unread_count'] as int? ?? 0,
        updatedAt: j['updated_at'] as String?,
        lastMsgId: j['last_msg_id'] as int?,
        lastMsgContent: j['last_msg_content'] as String?,
      );
}

class Message {
  final int id;
  final int userId;
  final String username;
  final String? nickname;
  final String? avatar;
  final String content;
  final String createdAt;

  Message({
    required this.id,
    required this.userId,
    required this.username,
    this.nickname,
    this.avatar,
    required this.content,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> j) => Message(
        id: j['id'] as int,
        userId: j['user_id'] as int,
        username: j['username'] as String? ?? '',
        nickname: j['nickname'] as String?,
        avatar: j['avatar'] as String?,
        content: j['content'] as String? ?? '',
        createdAt: j['created_at'] as String? ?? '',
      );
}

class MusicItem {
  final int id;
  final int userId;
  final String title;
  final String musicUrl;
  final String lrcUrl;
  final String? bgUrl;
  final String? lrcPos;
  final String? lrcColor;
  final int playsCount;
  final String createdAt;
  final String uploaderName;

  MusicItem({
    required this.id,
    required this.userId,
    required this.title,
    required this.musicUrl,
    required this.lrcUrl,
    this.bgUrl,
    this.lrcPos,
    this.lrcColor,
    required this.playsCount,
    required this.createdAt,
    required this.uploaderName,
  });

  factory MusicItem.fromJson(Map<String, dynamic> j) => MusicItem(
        id: j['id'] as int,
        userId: j['user_id'] as int,
        title: j['title'] as String? ?? '',
        musicUrl: j['music_url'] as String? ?? '',
        lrcUrl: j['lrc_url'] as String? ?? '',
        bgUrl: j['bg_url'] as String?,
        lrcPos: j['lrc_pos'] as String?,
        lrcColor: j['lrc_color'] as String?,
        playsCount: j['plays_count'] as int? ?? 0,
        createdAt: j['created_at'] as String? ?? '',
        uploaderName: (j['nickname'] ?? j['username'] ?? '') as String,
      );

  /// 生成 crmusic.html 播放页 URL
  String get playUrl {
    final p = {'id': '$id', 'music': musicUrl, 'lrc': lrcUrl};
    if (bgUrl != null) p['bg'] = bgUrl!;
    if (lrcPos != null && lrcPos != 'center') p['lrc_pos'] = lrcPos!;
    if (lrcColor != null && lrcColor != 'light') p['lrc_color'] = lrcColor!;
    final q = p.entries.map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}').join('&');
    return '/crmusic.html?$q';
  }
}

/// ====== API 封装 ======

class CRMomentApi {
  /// 服务器地址，如 `https://crmoment.ccwu.cc`（必设）
  static String baseUrl = '';

  /// 登录后设置此 token，后续请求自动附带
  static String? token;

  static String get _api => '$baseUrl/api.php?route=';

  // ---- 底层请求 ----

  static Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse('$_api$path').replace(queryParameters: query);
    final client = HttpClient();
    try {
      final req = await client.openUrl(method, uri);
      req.headers.contentType = ContentType.json;
      if (token != null) {
        if (method == 'GET' || method == 'DELETE') {
          // token 拼到 URL
          final newUri = uri.replace(queryParameters: {...?query, 'token': token});
          // 重新创建请求
          final newReq =
              await client.openUrl(method, newUri);
          newReq.headers.contentType = ContentType.json;
          if (body != null) newReq.write(jsonEncode(body));
          final resp = await newReq.close();
          return _handleResponse(resp);
        }
        body ??= {};
        body!['token'] = token;
      }
      if (body != null) req.write(jsonEncode(body));
      final resp = await req.close();
      return _handleResponse(resp);
    } finally {
      client.close();
    }
  }

  static Future<Map<String, dynamic>> _handleResponse(HttpClientResponse resp) async {
    final body = await resp.transform(utf8.decoder).join();
    final json = jsonDecode(body) as Map<String, dynamic>;
    final r = CrmResponse.fromJson(json);
    if (!r.ok) throw Exception(r.message);
    return json;
  }

  // ---- Auth ----

  /// 注册
  static Future<Map<String, dynamic>> register(String username, String nickname, String password) async {
    final r = await _request('POST', '/auth/register', body: {
      'username': username,
      'nickname': nickname,
      'password': password,
    });
    return r['data'];
  }

  /// 登录，返回 {id, username, nickname, avatar, bio, token}
  static Future<Map<String, dynamic>> login(String username, String password) async {
    final r = await _request('POST', '/auth/login', body: {
      'username': username,
      'password': password,
    });
    final data = r['data'];
    token = data['token'];
    return data;
  }

  /// 退出
  static Future<void> logout() async {
    try {
      await _request('POST', '/auth/logout');
    } finally {
      token = null;
    }
  }

  // ---- User ----

  /// 当前用户信息
  static Future<User> getMe() async {
    final r = await _request('GET', '/user/me');
    return User.fromJson(r['data']);
  }

  /// 获取用户公开信息
  static Future<User> getUser(int userId) async {
    final r = await _request('GET', '/user/$userId');
    return User.fromJson(r['data']);
  }

  /// 修改简介
  static Future<void> updateBio(String bio) async {
    await _request('POST', '/user/bio', body: {'bio': bio});
  }

  /// 修改昵称
  static Future<void> updateNickname(String nickname) async {
    await _request('POST', '/user/nickname', body: {'nickname': nickname});
  }

  // ---- Posts ----

  /// 动态列表
  static Future<List<Post>> getPosts({int page = 1, int size = 20}) async {
    final r = await _request('GET', '/posts', query: {'page': '$page', 'size': '$size'});
    return (r['data']['list'] as List).map((e) => Post.fromJson(e)).toList();
  }

  /// 动态详情（含前 10 条评论）
  static Future<Map<String, dynamic>> getPost(int postId) async {
    final r = await _request('GET', '/posts/$postId');
    return r['data'];
  }

  /// 发布动态
  static Future<void> createPost(String content, {List<String>? imageUrls}) async {
    // 图片需要先通过 uploadImage 上传拿到 URL，这里暂用 JSON body 方式
    await _request('POST', '/posts', body: {'content': content, 'images': imageUrls});
  }

  /// 删除动态（24 小时内可撤回）
  static Future<void> deletePost(int postId) async {
    await _request('DELETE', '/posts/$postId');
  }

  /// 点赞
  static Future<void> likePost(int postId) async {
    await _request('POST', '/posts/$postId/like');
  }

  /// 取消点赞
  static Future<void> unlikePost(int postId) async {
    await _request('DELETE', '/posts/$postId/like');
  }

  // ---- Comments ----

  /// 评论列表
  static Future<List<Comment>> getComments(int postId) async {
    final r = await _request('GET', '/posts/$postId/comments');
    return (r['data']['list'] as List?)?.map((e) => Comment.fromJson(e)).toList() ?? [];
  }

  /// 发表评论
  static Future<void> createComment(int postId, String content, {int? parentId}) async {
    await _request('POST', '/posts/$postId/comments', body: {
      'content': content,
      if (parentId != null) 'parent_id': parentId,
    });
  }

  /// 删除评论
  static Future<void> deleteComment(int commentId) async {
    await _request('DELETE', '/comments/$commentId');
  }

  // ---- Notifications ----

  /// 通知列表
  static Future<List<Notification>> getNotifications() async {
    final r = await _request('GET', '/notifications');
    return (r['data']['list'] as List?)?.map((e) => Notification.fromJson(e)).toList() ?? [];
  }

  /// 未读计数
  static Future<int> getUnreadCount() async {
    final r = await _request('GET', '/notifications/unread');
    return r['data']['count'] as int? ?? 0;
  }

  /// 全部标记已读
  static Future<void> markAllRead() async {
    await _request('PUT', '/notifications/read');
  }

  // ---- Conversations ----

  /// 会话列表
  static Future<List<Conversation>> getConversations() async {
    final r = await _request('GET', '/conversations');
    return (r['data']['list'] as List?)?.map((e) => Conversation.fromJson(e)).toList() ?? [];
  }

  /// 创建会话（私聊或群聊）
  static Future<Map<String, dynamic>> createConversation(
    String type, {
    String? name,
    required List<int> memberIds,
  }) async {
    final r = await _request('POST', '/conversations', body: {
      'type': type,
      if (name != null) 'name': name,
      'member_ids': memberIds,
    });
    return r['data'];
  }

  /// 未读会话计数
  static Future<int> getUnreadConversations() async {
    final r = await _request('GET', '/conversations/unread');
    return r['data']['count'] as int? ?? 0;
  }

  /// 获取消息列表
  static Future<List<Message>> getMessages(int convId, {int? beforeId}) async {
    final q = <String, String>{};
    if (beforeId != null) q['before_id'] = '$beforeId';
    final r = await _request('GET', '/conversations/$convId/messages', query: q);
    return (r['data']['list'] as List?)?.map((e) => Message.fromJson(e)).toList() ?? [];
  }

  /// 发送消息
  static Future<void> sendMessage(int convId, String content) async {
    await _request('POST', '/conversations/$convId/messages', body: {'content': content});
  }

  /// 标记会话已读
  static Future<void> markConversationRead(int convId) async {
    await _request('POST', '/conversations/$convId/read');
  }

  /// 获取会话成员
  static Future<List<User>> getMembers(int convId) async {
    final r = await _request('GET', '/conversations/$convId/members');
    return (r['data']['list'] as List?)?.map((e) => User.fromJson(e)).toList() ?? [];
  }

  /// 添加群成员
  static Future<void> addMembers(int convId, List<int> userIds) async {
    await _request('POST', '/conversations/$convId/members', body: {'user_ids': userIds});
  }

  // ---- Music ----

  /// 音乐列表
  static Future<List<MusicItem>> getMusicList({int page = 1, int size = 50, String? query}) async {
    final q = <String, String>{'page': '$page', 'size': '$size'};
    if (query != null && query.isNotEmpty) q['q'] = query;
    final r = await _request('GET', '/music', query: q);
    return (r['data']['list'] as List?)?.map((e) => MusicItem.fromJson(e)).toList() ?? [];
  }

  /// 添加音乐
  static Future<void> addMusic({
    required String title,
    required String musicUrl,
    required String lrcUrl,
    String? bgUrl,
    String lrcPos = 'center',
    String lrcColor = 'light',
  }) async {
    await _request('POST', '/music', body: {
      'title': title,
      'music_url': musicUrl,
      'lrc_url': lrcUrl,
      if (bgUrl != null) 'bg_url': bgUrl,
      'lrc_pos': lrcPos,
      'lrc_color': lrcColor,
    });
  }

  /// 修改音乐
  static Future<void> updateMusic(
    int id, {
    required String title,
    required String musicUrl,
    required String lrcUrl,
    String? bgUrl,
    String lrcPos = 'center',
    String lrcColor = 'light',
  }) async {
    await _request('PUT', '/music/$id', body: {
      'title': title,
      'music_url': musicUrl,
      'lrc_url': lrcUrl,
      if (bgUrl != null) 'bg_url': bgUrl,
      'lrc_pos': lrcPos,
      'lrc_color': lrcColor,
    });
  }

  /// 删除音乐
  static Future<void> deleteMusic(int id) async {
    await _request('DELETE', '/music/$id');
  }

  /// 播放量 +1
  static Future<void> reportPlay(int id) async {
    await _request('POST', '/music/$id/play');
  }

  // ---- Upload ----

  /// 上传图片，返回图片 URL
  static Future<String> uploadImage(File file) async {
    final uri = Uri.parse('$_api/upload/image');
    final client = HttpClient();
    try {
      final req = await client.postUrl(uri);
      final boundary = '----${DateTime.now().millisecondsSinceEpoch}';
      req.headers.set('Content-Type', 'multipart/form-data; boundary=$boundary');
      final bytes = await file.readAsBytes();
      final buf = StringBuffer()
        ..writeln('--$boundary')
        ..writeln('Content-Disposition: form-data; name="image"; filename="${file.path.split(Platform.pathSeparator).last}"')
        ..writeln('Content-Type: application/octet-stream')
        ..writeln()
        ..write(String.fromCharCodes(bytes));
      if (token != null) {
        buf
          ..writeln()
          ..writeln('--$boundary')
          ..writeln('Content-Disposition: form-data; name="token"')
          ..writeln()
          ..write(token);
      }
      buf.writeln();
      buf.write('--$boundary--');
      req.write(buf.toString());
      final resp = await req.close();
      final body = await resp.transform(utf8.decoder).join();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final r = CrmResponse.fromJson(json);
      if (!r.ok) throw Exception(r.message);
      return r.data['url'] as String;
    } finally {
      client.close();
    }
  }
}
