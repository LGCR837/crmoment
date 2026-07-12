/**************************************************
 * CRMusicNeo - 用户自定义歌单模块
 *************************************************/

var userPlaylists = {
    // 用户歌单在 musicList 中的起始 index
    startIndex: 3,
    
    // 加载用户歌单列表
    load: function(callback) {
        var token = localStorage.getItem('crmoment-token');
        if (!token) {
            if (callback) callback();
            return;
        }
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists',
            method: 'GET',
            data: { token: token },
            dataType: 'json',
            success: function(res) {
                if (res.code !== 0 || !res.data || !res.data.list) {
                    if (callback) callback();
                    return;
                }
                
                // 先清除之前加载的自定义歌单（从 startIndex 开始）
                var existingCount = musicList.length - userPlaylists.startIndex;
                if (existingCount > 0) {
                    musicList.splice(userPlaylists.startIndex, existingCount);
                }
                
                // 将歌单添加到 musicList
                var list = res.data.list;
                for (var i = 0; i < list.length; i++) {
                    var playlist = {
                        id: list[i].id,
                        name: list[i].name,
                        cover: list[i].cover || 'images/music.svg',
                        creatorName: '',
                        creatorAvatar: '',
                        item: [],
                        userPlaylist: true,
                        trackCount: list[i].track_count
                    };
                    musicList.push(playlist);
                    addSheet(userPlaylists.startIndex + i, playlist.name, playlist.cover);
                }
                
                if (callback) callback();
            },
            error: function() {
                if (callback) callback();
            }
        });
    },
    
    // 加载歌单中的歌曲
    loadTracks: function(playlistIndex, callback) {
        var playlist = musicList[playlistIndex];
        if (!playlist || !playlist.userPlaylist) return;
        
        var token = localStorage.getItem('crmoment-token');
        if (!token) return;
        
        var loading = layer.msg('加载中...', { icon: 16, shade: [0.25, '#000'], time: 5000 });
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists/' + playlist.id,
            method: 'GET',
            data: { token: token },
            dataType: 'json',
            success: function(res) {
                layer.close(loading);
                if (res.code !== 0 || !res.data) {
                    layer.msg('歌单加载失败');
                    return;
                }
                
                playlist.item = [];
                var tracks = res.data.tracks || [];
                for (var i = 0; i < tracks.length; i++) {
                    var t = tracks[i];
                    playlist.item.push({
                        id: t.track_id,
                        name: t.name,
                        artist: t.artist || '未知',
                        album: t.album || '未知',
                        source: t.source,
                        url_id: t.track_id,
                        pic_id: null,
                        lyric_id: t.track_id,
                        pic: null,
                        url: null,
                        crmid: t.crmid
                    });
                }
                playlist.trackCount = tracks.length;
                
                // 更新 sheet 显示
                $(".sheet-item[data-no='" + playlistIndex + "'] .sheet-name").text(playlist.name);
                
                if (callback) callback(playlistIndex);
            },
            error: function() {
                layer.close(loading);
                layer.msg('歌单加载失败');
            }
        });
    },
    
    // 显示"添加到歌单"弹窗
    showAddModal: function(music) {
        var token = localStorage.getItem('crmoment-token');
        if (!token) {
            layer.msg('请先登录');
            return;
        }
        
        var crmid = music.source.charAt(0).toUpperCase() + music.id;
        if (typeof CRMID !== 'undefined') {
            crmid = CRMID.toCrmid(music.source, music.id);
        }
        
        var loading = layer.msg('加载中...', { icon: 16, shade: [0.25, '#000'], time: 10000 });
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists',
            method: 'GET',
            data: { token: token },
            dataType: 'json',
            success: function(res) {
                layer.close(loading);
                if (res.code !== 0) {
                    layer.msg('获取歌单失败');
                    return;
                }
                
                var playlists = res.data.list || [];
                var html = '<div style="max-height:400px;overflow-y:auto;">';
                
                // 新建歌单区域
                html += '<div style="padding:12px 16px;border-bottom:1px solid rgba(150,170,190,0.2);">';
                html += '<div style="display:flex;gap:8px;">';
                html += '<input type="text" id="new-playlist-name" placeholder="新建歌单名称" style="flex:1;padding:8px 12px;border:2px solid rgba(150,170,190,0.3);border-radius:8px;font-size:13px;outline:none;background:rgba(240,244,250,0.6);">';
                html += '<button id="create-playlist-btn" style="padding:8px 16px;border:none;border-radius:8px;background:#7ec8e3;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;">新建</button>';
                html += '</div>';
                html += '</div>';
                
                // 歌单列表
                if (playlists.length === 0) {
                    html += '<div style="padding:24px;text-align:center;color:#8a9db0;">暂无歌单，请先创建</div>';
                } else {
                    for (var i = 0; i < playlists.length; i++) {
                        var p = playlists[i];
                        html += '<div class="playlist-select-item" data-id="' + p.id + '" data-name="' + userPlaylists.escapeHtml(p.name) + '" style="display:flex;align-items:center;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(150,170,190,0.15);transition:background 0.15s;">';
                        html += '<span style="flex:1;font-size:14px;">' + userPlaylists.escapeHtml(p.name) + '</span>';
                        html += '<span style="font-size:12px;color:#8a9db0;margin-right:8px;">' + (p.track_count || 0) + '首</span>';
                        html += '</div>';
                    }
                }
                html += '</div>';
                
                var index = layer.open({
                    type: 1,
                    title: '添加到歌单',
                    shade: [0.3, 'rgba(0,0,0,0.3)'],
                    shadeClose: true,
                    closeBtn: 0,
                    anim: 0,
                    isOutAnim: true,
                    area: ['360px', 'auto'],
                    content: html,
                    success: function(layero) {
                        // 歌单项 hover 效果
                        layero.find('.playlist-select-item').on('mouseenter', function() {
                            $(this).css('background', 'rgba(126,200,227,0.12)');
                        }).on('mouseleave', function() {
                            $(this).css('background', 'transparent');
                        });
                        
                        // 点击歌单添加歌曲
                        layero.find('.playlist-select-item').on('click', function() {
                            var playlistId = $(this).data('id');
                            var playlistName = $(this).data('name');
                            userPlaylists.addToPlaylist(playlistId, music, crmid, function() {
                                layer.close(index);
                                layer.msg('已添加到歌单 [' + playlistName + ']');
                            });
                        });
                        
                        // 新建歌单
                        layero.find('#create-playlist-btn').on('click', function() {
                            var name = layero.find('#new-playlist-name').val().trim();
                            if (!name) {
                                layer.msg('请输入歌单名称', { anim: 6 });
                                return;
                            }
                            userPlaylists.createPlaylist(name, function(newId) {
                                if (newId) {
                                    userPlaylists.addToPlaylist(newId, music, crmid, function() {
                                        layer.close(index);
                                        layer.msg('已创建歌单 [' + name + '] 并添加歌曲');
                                        // 重新加载歌单列表
                                        userPlaylists.load();
                                    });
                                }
                            });
                        });
                        
                        // 回车创建
                        layero.find('#new-playlist-name').on('keydown', function(e) {
                            if (e.keyCode === 13) {
                                layero.find('#create-playlist-btn').click();
                            }
                        });
                    }
                });
            },
            error: function() {
                layer.close(loading);
                layer.msg('获取歌单失败');
            }
        });
    },
    
    // 创建新歌单
    createPlaylist: function(name, callback) {
        var token = localStorage.getItem('crmoment-token');
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists',
            method: 'POST',
            data: JSON.stringify({ name: name }),
            contentType: 'application/json',
            dataType: 'json',
            headers: { 'X-Auth-Token': token },
            success: function(res) {
                if (res.code !== 0) {
                    layer.msg(res.message || '创建失败');
                    if (callback) callback(null);
                    return;
                }
                if (callback) callback(res.data.id);
            },
            error: function() {
                layer.msg('创建失败');
                if (callback) callback(null);
            }
        });
    },
    
    // 添加歌曲到歌单
    addToPlaylist: function(playlistId, music, crmid, callback) {
        var token = localStorage.getItem('crmoment-token');
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists/' + playlistId + '/tracks',
            method: 'POST',
            data: JSON.stringify({
                crmid: crmid,
                source: music.source,
                track_id: music.id,
                name: music.name,
                artist: music.artist,
                album: music.album
            }),
            contentType: 'application/json',
            dataType: 'json',
            headers: { 'X-Auth-Token': token },
            success: function(res) {
                if (res.code !== 0) {
                    layer.msg(res.message || '添加失败');
                    return;
                }
                if (callback) callback();
            },
            error: function() {
                layer.msg('添加失败');
            }
        });
    },
    
    // 从歌单移除歌曲
    removeTrack: function(playlistId, crmid, callback) {
        var token = localStorage.getItem('crmoment-token');
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists/' + playlistId + '/tracks&crmid=' + encodeURIComponent(crmid),
            method: 'DELETE',
            dataType: 'json',
            headers: { 'X-Auth-Token': token },
            success: function(res) {
                if (res.code !== 0) {
                    layer.msg(res.message || '移除失败');
                    return;
                }
                if (callback) callback();
            },
            error: function() {
                layer.msg('移除失败');
            }
        });
    },
    
    // 保存排序
    saveSort: function(playlistId, orders) {
        var token = localStorage.getItem('crmoment-token');
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists/' + playlistId + '/tracks/sort',
            method: 'PUT',
            data: JSON.stringify({ orders: orders }),
            contentType: 'application/json',
            dataType: 'json',
            headers: { 'X-Auth-Token': token },
            success: function(res) {
                if (res.code !== 0) {
                    layer.msg('排序保存失败');
                }
            },
            error: function() {
                layer.msg('排序保存失败');
            }
        });
    },
    
    // 获取用户歌单
    getPlaylists: function(callback) {
        var token = localStorage.getItem('crmoment-token');
        if (!token) {
            callback([]);
            return;
        }
        
        $.ajax({
            url: 'https://crmoment.ccwu.cc/api.php?route=/music/playlists',
            method: 'GET',
            data: { token: token },
            dataType: 'json',
            success: function(res) {
                if (res.code === 0 && res.data) {
                    callback(res.data.list || []);
                } else {
                    callback([]);
                }
            },
            error: function() {
                callback([]);
            }
        });
    },
    
    // HTML 转义
    escapeHtml: function(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 启用拖拽排序（用于歌单歌曲列表）
    enableDragSort: function() {
        var dragItem = null;
        var dragIndex = -1;

        $(document).off('mousedown', '.user-playlist-track .list-item')
            .on('mousedown', '.user-playlist-track .list-item', function(e) {
                if ($(e.target).closest('.list-icon').length) return;
                dragItem = $(this);
                dragIndex = parseInt(dragItem.data('no'));
            });

        $(document).off('mousemove.userPlaylistsDrag')
            .on('mousemove.userPlaylistsDrag', '.user-playlist-track .list-item', function(e) {
                if (dragItem === null) return;
                var $target = $(this);
                var targetIndex = parseInt($target.data('no'));
                if (targetIndex === dragIndex) return;

                if (targetIndex > dragIndex) {
                    $target.after(dragItem);
                } else {
                    $target.before(dragItem);
                }

                $('.user-playlist-track .list-item').each(function(idx) {
                    $(this).attr('data-no', idx);
                    $(this).find('.list-num').text(idx + 1);
                });

                dragIndex = parseInt(dragItem.data('no'));
            });

        $(document).off('mouseup.userPlaylistsDrag')
            .on('mouseup.userPlaylistsDrag', function() {
                if (dragItem === null) return;
                dragItem = null;
                dragIndex = -1;
                userPlaylists.saveCurrentSort();
            });

        $(document).off('touchstart', '.user-playlist-track .list-item')
            .on('touchstart', '.user-playlist-track .list-item', function(e) {
                if ($(e.target).closest('.list-icon').length) return;
                dragItem = $(this);
                dragIndex = parseInt(dragItem.data('no'));
            });

        $(document).off('touchmove.userPlaylistsDrag')
            .on('touchmove.userPlaylistsDrag', function(e) {
                if (dragItem === null) return;
                var touch = e.originalEvent.touches[0];
                var $target = $(document.elementFromPoint(touch.clientX, touch.clientY)).closest('.list-item');
                if (!$target.length || !$target.hasClass('list-item')) return;

                var targetIndex = parseInt($target.data('no'));
                if (targetIndex === dragIndex) return;

                if (targetIndex > dragIndex) {
                    $target.after(dragItem);
                } else {
                    $target.before(dragItem);
                }

                $('.user-playlist-track .list-item').each(function(idx) {
                    $(this).attr('data-no', idx);
                    $(this).find('.list-num').text(idx + 1);
                });

                dragIndex = parseInt(dragItem.data('no'));
            });

        $(document).off('touchend.userPlaylistsDrag')
            .on('touchend.userPlaylistsDrag', function() {
                if (dragItem === null) return;
                dragItem = null;
                dragIndex = -1;
                userPlaylists.saveCurrentSort();
            });
    },

    // 保存当前列表排序
    saveCurrentSort: function() {
        if (rem.playlist === undefined) return;
        var playlist = musicList[rem.playlist];
        if (!playlist || !playlist.userPlaylist) return;

        var orders = [];
        $('.user-playlist-track .list-item').each(function(idx) {
            var no = parseInt($(this).data('no'));
            if (playlist.item[no]) {
                orders.push({
                    id: playlist.item[no].id,
                    sort_order: idx
                });
            }
        });

        if (orders.length > 0) {
            userPlaylists.saveSort(playlist.id, orders);
        }
    }
};
