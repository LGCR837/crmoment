/**************************************************
 * CRMusicNeo - UI Functions Module
 * Based on MKOnlinePlayer v2.4 by mengkun
 *************************************************/
// 判断是否是移动设备
var isMobile = {  
    Android: function() { return navigator.userAgent.match(/Android/i) ? true : false; },  
    BlackBerry: function() { return navigator.userAgent.match(/BlackBerry/i) ? true : false; },  
    iOS: function() { return navigator.userAgent.match(/iPhone|iPad|iPod/i) ? true : false; },  
    Windows: function() { return navigator.userAgent.match(/IEMobile/i) ? true : false; }, 
    Screen: function() { return document.documentElement.clientWidth < 900 ? true : false; }, 
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Windows() || isMobile.Screen());  
    }
};

// 初始化layui
var layer;
var form;
layui.use(['layer', 'form'], function(){
    layer = layui.layer;
    form = layui.form;
    // 公告已关闭
});

$(function(){
    if(mkPlayer.debug) {
        console.warn('播放器调试模式已开启');
    }
    
    rem.isMobile  = isMobile.any();
    rem.webTitle  = document.title;
    rem.errCount  = 0;
    rem.userAgent = navigator.userAgent;
    rem.blurImage = null;
    rem._resizeTimer = null;

    window.onresize = function () {
        rem.isMobile = isMobile.any();
        if (navigator.userAgent !== rem.userAgent) {
            location.reload();
            return;
        }
        if (rem.blurImage && mkPlayer.coverbg && !rem.isMobile) {
            clearTimeout(rem._resizeTimer);
            rem._resizeTimer = setTimeout(function() {
                $("#blur-img").backgroundBlur(rem.blurImage);
            }, 300);
        }
    }

    initProgress();
    initAudio();
    
    if(rem.isMobile) {
        rem.sheetList = $("#sheet");
        rem.mainList = $("#main-list");
    } else {
        $("#main-list,#sheet").mCustomScrollbar({
            theme:"minimal",
            advanced:{
                updateOnContentResize: true
            }
        });
        rem.sheetList = $("#sheet .mCSB_container");
        rem.mainList = $("#main-list .mCSB_container");  
    }
    
    addListhead();
    addListbar("loading");
    
    // 顶部按钮点击处理
    $(".btn").click(function(){
        switch($(this).data("action")) {
            case "player":
                dataBox("player");
            break;
            case "playing":
                loadList(1);
            break;
            case "sheet":
                dataBox("sheet");
            break;
            case "search":
                loadList(0);
                $(".btn[data-action='search']").show();
            break;
        }
    });
    
    // ========== 内联搜索框逻辑 ==========
    var isComposing = false;
    $('#search-wd-inline').on('compositionstart', function() {
        isComposing = true;
    }).on('compositionend', function() {
        isComposing = false;
        // 中文输入法确认后，如果有值则自动搜索
        var val = $(this).val().trim();
        if (val.length > 0) {
            doSearch();
        }
    });
    $('#search-wd-inline').on('keydown', function(e) {
        if (e.keyCode === 13) {  // 回车搜索（PC端和手机端搜索键）
            e.preventDefault();
            // 等待 compositionend 处理（中文输入法场景）
            if (!isComposing) {
                doSearch();
            }
        }
    });
    $('#source-inline').on('change', function() {
        var wd = $('#search-wd-inline').val().trim();
        if (wd) {
            doSearch();
        }
    });
    
    function doSearch() {
        var wd = $('#search-wd-inline').val().trim();
        if (!wd) return;
        rem.source = $('#source-inline').val();
        rem.loadPage = 1;
        rem.wd = wd;
        ajaxSearch();
    }
    
    // 文字溢出悬浮提示
    var $tooltip = $("#list-tooltip");
    var tipTimer = null;
    $(document).on("mouseenter", ".music-name-cult, .auth-name, .music-album, .sheet-name", function(e) {
        var $el = $(this);
        var text = $el.text();
        // 检查是否溢出
        if($el[0].scrollWidth > $el[0].clientWidth + 2 && text) {
            clearTimeout(tipTimer);
            tipTimer = setTimeout(function() {
                $tooltip.text(text);
                $tooltip.css({
                    left: Math.min(e.clientX + 10, window.innerWidth - 420) + "px",
                    top: (e.clientY + 10) + "px"
                }).fadeIn(150);
            }, 300);
        }
    }).on("mousemove", ".music-name-cult, .auth-name, .music-album, .sheet-name", function(e) {
        if($tooltip.is(":visible")) {
            $tooltip.css({
                left: Math.min(e.clientX + 10, window.innerWidth - 420) + "px",
                top: (e.clientY + 10) + "px"
            });
        }
    }).on("mouseleave", ".music-name-cult, .auth-name, .music-album, .sheet-name", function() {
        clearTimeout(tipTimer);
        $tooltip.fadeOut(100);
    });

    // 搜索框清空按钮
    var $searchInput = $('#search-wd-inline');
    var $clearBtn = $('#search-clear-btn');
    $searchInput.on('input', function() {
        if($(this).val().length > 0) {
            $clearBtn.show();
        } else {
            $clearBtn.hide();
        }
    });
    $clearBtn.on('click', function() {
        $searchInput.val('').focus();
        $(this).hide();
        $(".btn[data-action='search']").hide();
    });

    // 列表项单击播放（整行点击）
    $(".music-list").on("click",".list-item", function(e) {
        // 忽略菜单按钮区域的点击（下载、分享）
        if($(e.target).closest('.icon-download,.icon-share,.list-mobile-menu').length) return false;
        var num = parseInt($(this).data("no"));
        if(isNaN(num)) return false;
        listClick(num);
    });
    
    // 列表鼠标移过显示对应的操作按钮（SVG 图标）
    $(".music-list").on("mousemove",".list-item", function() {
        var num = parseInt($(this).data("no"));
        if(isNaN(num)) return false;
        if(!$(this).data("loadmenu")) {
            var target = $(this).find(".music-name");
            var isLoggedIn = !!localStorage.getItem('crmoment-token');
            var isOwnerPlaylist = isLoggedIn && rem.dislist !== undefined && musicList[rem.dislist] && musicList[rem.dislist].userPlaylist;
            var addPlaylistBtn = isLoggedIn ?
                '<span class="list-icon icon-add-playlist" data-function="addPlaylist" title="添加到歌单">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                '</span>' : '';
            var deleteBtn = isOwnerPlaylist ?
                '<span class="list-icon icon-remove-track" data-function="removeTrack" title="从歌单删除">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' +
                '</span>' : '';
            var html = '<span class="music-name-cult">' +
            target.html() +
            '</span>' +
            '<div class="list-menu" data-no="' + num + '">' +
                '<span class="list-icon icon-download" title="下载">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                '</span>' +
                addPlaylistBtn +
                deleteBtn +
                '<span class="list-icon icon-share" data-function="share" title="分享">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
                '</span>' +
            '</div>';
            target.html(html);
            $(this).data("loadmenu", true);
        }
    });
    
    // 列表中的菜单点击
    $(".music-list").on("click",".icon-download,.icon-share,.icon-add-playlist,.icon-remove-track", function() {
        var num = parseInt($(this).parent().data("no"));
        if(isNaN(num)) return false;
        switch($(this).data("function")) {
            case "share":
                ajaxUrl(musicList[rem.dislist].item[num], ajaxShare);
            break;
            case "addPlaylist":
                var music = musicList[rem.dislist].item[num];
                if (typeof userPlaylists !== 'undefined') {
                    userPlaylists.showAddModal(music);
                }
            break;
            case "removeTrack":
                var track = musicList[rem.dislist].item[num];
                var playlist = musicList[rem.dislist];
                layer.open({
                    title: '确认删除',
                    shade: [0.3,'rgba(0,0,0,0.3)'],
                    shadeClose: true,
                    closeBtn: 0,
                    anim: 0,
                    isOutAnim: true,
                    content: '确定要将 <b>' + track.name + '</b> 从歌单中移除吗？',
                    btn: ['移除', '取消'],
                    yes: function(idx){
                        if (typeof userPlaylists !== 'undefined') {
                            var crmid = track.crmid || (track.source.charAt(0).toUpperCase() + track.id);
                            userPlaylists.removeTrack(playlist.id, crmid, function(){
                                playlist.item.splice(num, 1);
                                loadList(rem.dislist);
                                layer.msg('已移除');
                            });
                        }
                        layer.close(idx);
                    }
                });
            break;
        }
        return true;
    });
    
    // 点击加载更多
    $(".music-list").on("click",".list-loadmore", function() {
        $(".list-loadmore").removeClass('list-loadmore');
        $(".list-loadmore").html('加载中...');
        ajaxSearch();
    });
    
    // 点击专辑显示专辑歌曲
    $("#sheet").on("click",".sheet-cover,.sheet-name", function() {
        var num = parseInt($(this).parent().data("no"));
        if(musicList[num].userPlaylist) {
            // 用户自定义歌单 - 从服务器加载
            if(musicList[num].item.length === 0) {
                layer.msg('列表读取中...', {icon: 16,shade: [0.25,,'#000'],shadeClose: true,time: 500});
                if (typeof userPlaylists !== 'undefined') {
                    userPlaylists.loadTracks(num, loadList);
                }
                return true;
            }
        } else if(musicList[num].item.length === 0 && musicList[num].id) {
            layer.msg('列表读取中...', {icon: 16,shade: [0.25,,'#000'],shadeClose: true,time: 500});
            ajaxPlayList(musicList[num].id, num, loadList);
            return true;
        }
        loadList(num);
    });
    
    // 歌曲信息按钮
    $("#music-info").click(function(){
        if(rem.playid === undefined) {
            layer.msg('请先播放歌曲');
            return false;
        }
        musicInfo(rem.playlist, rem.playid);
    });
    
    // 播放、暂停
    $(".btn-play").click(function(){
        pause();
    });
    
    // 循环顺序
    $(".btn-order").click(function(){
        orderChange();
    });
    // 上一首
    $(".btn-prev").click(function(){
        prevMusic();
    });
    // 下一首
    $(".btn-next").click(function(){
        nextMusic();
    });
    
    // 静音
    $(".btn-quiet").click(function(e){
        e.stopPropagation();
        if(rem.isMobile) {
            var $vol = $(this).closest('.vol').find('.volume');
            $vol.toggleClass('volume-show');
            return;
        }
        var oldVol;
        if($(this).is('.btn-state-quiet')) {
            oldVol = $(this).data("volume");
            oldVol = oldVol? oldVol: mkPlayer.volume;
            $(this).removeClass("btn-state-quiet");
            $(this).find('.icon-volume-on').show();
            $(this).find('.icon-volume-off').hide();
        } else {
            oldVol = volume_bar.percent;
            $(this).addClass("btn-state-quiet");
            $(this).data("volume", oldVol);
            oldVol = 0;
            $(this).find('.icon-volume-on').hide();
            $(this).find('.icon-volume-off').show();
        }
        playerSavedata('volume', oldVol);
        volume_bar.goto(oldVol);
        if(rem.audio[0] !== undefined) rem.audio[0].volume = oldVol;
    });

    // 移动端点击外部关闭音量弹窗
    $(document).on('click', function(){
        if(rem.isMobile) {
            $('.volume-show').removeClass('volume-show');
        }
    });

    // 封面背景
    if((mkPlayer.coverbg === true && !rem.isMobile) || (mkPlayer.mcoverbg === true && rem.isMobile)) {
        if(rem.isMobile) {
            $('#blur-img').html('<div class="blured-img" id="mobile-blur"></div>');
        } else {
            $('#blur-img').backgroundBlur({
                blurAmount : 40,
                imageClass : 'blured-img',
                endOpacity : 1
            });
        }
    }
    
    // 图片加载失败处理
    $('img').error(function(){
        $(this).attr('src', 'images/music.svg');
    });
    
    setInterval(function () {
        $('.audio-time').text(getAudioTime());
    }, 1000);

    if (localStorage.getItem('crmoment-token')) {
        cloudSyncLoad(function() { initList(); });
    } else {
        initList();
    }
});

// 播放时长处理函数
function getAudioTime () {
    var audio = $('audio')[0];
    var duration = audio.duration;
    var currentTime = audio.currentTime;
    if (duration && currentTime) {
        return (formatTime(currentTime) + '/' + formatTime(duration));
    } else {
        return '00:00/00:00';
    }
};

// 歌曲信息
function musicInfo(list, index) {
    var music = musicList[list].item[index];
    var tempStr = '<span class="info-title">歌名：</span>' + music.name +
    '<br><span class="info-title">歌手：</span>' + music.artist +
    '<br><span class="info-title">专辑：</span>' + music.album;
    if (typeof CRMID !== 'undefined') {
        var crmid = CRMID.toCrmid(music.source, music.id);
        if (crmid) tempStr += '<br><span class="info-title">CRMID：</span>' + crmid;
    }
    
    if(list == rem.playlist && index == rem.playid) {
        tempStr += '<br><span class="info-title">时长：</span>' + formatTime(rem.audio[0].duration);
    }
    
    tempStr += '<br><span class="info-title">操作：</span>' + 
    '<span class="info-btn" onclick="thisDownload(this)" data-list="' + list + '" data-index="' + index + '">下载</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisDownloadLrc(this)" data-list="' + list + '" data-index="' + index + '">下载歌词</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisDownloadPic(this)" data-list="' + list + '" data-index="' + index + '">下载封面</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisShare(this)" data-list="' + list + '" data-index="' + index + '">外链</span>';
    
    layer.open({
        type: 0,
        shade: [0.3,'rgba(0,0,0,0.3)'],
        shadeClose: true,
        title: false,
        btn: false,
        closeBtn: 0,
        anim: 0,
        isOutAnim: true,
        content: tempStr
    });
}

// 搜索提交（内联搜索已替代弹窗，此函数供兼容调用）
function searchSubmit() {
    var wd = $("#search-wd-inline").val().trim();
    if(!wd) {
        layer.msg('搜索内容不能为空', {anim:6, offset: 't'});
        $("#search-wd-inline").focus();
        return false;
    }
    rem.source = $("#source-inline").val();
    rem.loadPage = 1;
    rem.wd = wd;
    ajaxSearch();
    return false;
}

// 下载
function thisDownload(obj) {
    ajaxUrl(musicList[$(obj).data("list")].item[$(obj).data("index")], download);
}

// 下载封面
function thisDownloadPic (obj) {
    var music = musicList[$(obj).data("list")].item[$(obj).data("index")];
    layer.closeAll();
    if (music.pic) {
        open(music.pic.split('?')[0].split('@')[0]);
    } else {
        $.ajax({ 
            type: mkPlayer.method, 
            url: mkPlayer.api,
            data: "types=pic&id=" + music.pic_id + "&source=" + music.source,
            dataType: mkPlayer.dataType,
            success: function(jsonData){
                if (jsonData.url) {
                    open(jsonData.url.split('?')[0].split('@')[0]);
                } else {
                    layer.msg('没有封面');
                }
            },
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                layer.msg('歌曲封面获取失败 - ' + XMLHttpRequest.status);
            }
        });
    }
}

// 下载歌词
function thisDownloadLrc (obj) {
    var music = musicList[$(obj).data("list")].item[$(obj).data("index")];
    layer.closeAll();
    $.ajax({
        type: mkPlayer.method,
        url: mkPlayer.api,
        data: "types=lyric&id=" + music.lyric_id + "&source=" + music.source,
        dataType: mkPlayer.dataType,
        success: function(jsonData){
            var lyric = jsonData.lyric;
            if (lyric) {
                var artist = music.artist ? ' - ' + music.artist : '';
                var filename = (music.name + artist + '.lrc').replace('/', '&');
                var element = document.createElement('a');
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(lyric));
                element.setAttribute('download', filename);
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
            } else {
                layer.msg('歌词获取失败');
            }
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌词读取失败 - ' + XMLHttpRequest.status);
        }
    });
}

// 分享
function thisShare(obj) {
    ajaxUrl(musicList[$(obj).data("list")].item[$(obj).data("index")], ajaxShare);
}

// 下载歌曲
function download(music) {
    if(music.url == 'err' || music.url == "" || music.url == null) {
        layer.msg('这首歌不支持下载');
        return;
    }
    var loadMsg = layer.msg('正在请求远程服务器，如果10秒后没有开始下载请重试', {
        time: 10000
    });
    var load = layer.load(0, {shade: [0.25,,'#000']});
    var loading = setTimeout(function () {
        layer.close(load);
        layer.close(loadMsg);
        layer.msg('下载请求歌曲链接失败，请检查网络或稍后再试');
    }, 10000);
    $.ajax({ 
        type: mkPlayer.method,
        url: mkPlayer.api,
        data: 'types=download&artist=' + music.artist + '&name=' + music.name + '&source=' + music.source + '&url=' + encodeURIComponent(music.url),
        dataType: 'json',
        timeout: 10000,
        success: function(jsonData){
            layer.closeAll();
            clearInterval(loading);
            if (jsonData.code == 1) {
                if ($('.download').length) {
                    $('.download').remove();
                }
                var downDom = $('<iframe class="download" style="height: 0;width: 0;display: none;"></iframe>');
                downDom[0].src = jsonData.url;
                $('body').append(downDom);
            } else {
                layer.msg(jsonData.msg);
            }
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('下载失败，服务器错误 - ' + XMLHttpRequest.status);
        }
    });
}

// 获取外链的ajax回调
function ajaxShare(music) {
    var crmid = CRMID.toCrmid(music.source, music.id);
    if (!crmid) {
        layer.msg('该来源暂不支持分享');
        return;
    }
    var shareUrl = CRMID.getShareUrl(crmid);
    var tmpHtml = '<p>' + music.artist + ' - ' + music.name + '</p>' +
    '<p style="margin:6px 0;font-size:13px;color:#8a9db0">CRMID: ' + crmid + '</p>' +
    '<input class="share-url" onmouseover="this.focus();this.select()" value="' + shareUrl + '">' +
    '<p class="share-tips">* 复制链接分享给好友，打开即可自动播放。</p>';

    layer.open({
        title: '分享歌曲',
        shade: [0.3,'rgba(0,0,0,0.3)'],
        shadeClose: true,
        closeBtn: 0,
        anim: 0,
        isOutAnim: true,
        content: tmpHtml
    });
}

// 改变右侧封面图像
function changeCover(music) {
    var img = music.pic;

    if(!img) {
        ajaxPic(music, changeCover);
        img = "err";
    }

    if(img == "err") {
        img = "images/music.svg";
    }

    $("#music-cover").attr("src", img);
    $(".sheet-item[data-no='1'] .sheet-cover").attr('src', img);

    if(img != "images/music.svg") {
        adaptTextForCover(img);
    }

    // 更新模糊背景
    var blurApplied = false;
    function applyBlur() {
        if(blurApplied) return;
        blurApplied = true;
        if(mkPlayer.mcoverbg === true && rem.isMobile) {
            $("#mobile-blur").css('background-image', 'url("' + img + '")');
        } else if(mkPlayer.coverbg === true && !rem.isMobile) {
            rem.blurImage = img;
            $("#blur-img").animate({opacity: "0.2"}, 300, function(){
                $("#blur-img").backgroundBlur(img);
                $("#blur-img").animate({opacity: "1"}, 1500);
            });
        }
    }

    // 5秒超时降级：封面未加载完成则先用默认背景
    var blurTimer = setTimeout(function(){
        if(!blurApplied) {
            rem.blurImage = "images/music.svg";
            if(mkPlayer.coverbg === true && !rem.isMobile) {
                $("#blur-img").backgroundBlur("images/music.svg");
            }
        }
    }, 5000);

    var coverImg = document.getElementById('music-cover');
    if(coverImg && coverImg.complete) {
        clearTimeout(blurTimer);
        applyBlur();
    } else {
        $("#music-cover").one('load', function(){
            clearTimeout(blurTimer);
            applyBlur();
        });
    }
}

// 根据封面图亮度自动切换文字颜色（无遮罩）
function adaptTextForCover(imgUrl) {
    var root = document.documentElement;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        try {
            var c = document.createElement('canvas');
            var ctx = c.getContext('2d');
            c.width = 40; c.height = 40;
            ctx.drawImage(img, 0, 0, 40, 40);
            var d = ctx.getImageData(0, 0, 40, 40).data;
            var r = 0, g = 0, b = 0, n = d.length / 4;
            for(var i = 0; i < d.length; i += 4) {
                r += d[i]; g += d[i+1]; b += d[i+2];
            }
            r /= n; g /= n; b /= n;
            var lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if(lum > 110) {
                root.style.setProperty('--text-primary', '#000000');
                root.style.setProperty('--text-secondary', '#222222');
                root.style.setProperty('--text-muted', '#000000');
                root.style.setProperty('--accent', '#2196F3');
            } else {
                root.style.setProperty('--text-primary', '#ffffff');
                root.style.setProperty('--text-secondary', '#eeeeee');
                root.style.setProperty('--text-muted', '#ffffff');
                root.style.setProperty('--accent', '#64B5F6');
            }
        } catch(e) {
            // CORS 拒绝像素读取，保持 CSS 默认颜色
        }
    };
    img.src = imgUrl;
}

// 加载播放列表
function loadList(list) {
    if(musicList[list].isloading === true) {
        layer.msg('列表读取中...', {icon: 16,shade: [0.25,,'#000'],time: 500});
        return true;
    }

    // 如果是用户自定义歌单且歌曲为空，先从服务器加载
    if(musicList[list].userPlaylist && musicList[list].item.length === 0 && musicList[list].id) {
        if (typeof userPlaylists !== 'undefined') {
            userPlaylists.loadTracks(list, function(loadedIndex) {
                loadList(loadedIndex);
            });
            return true;
        }
    }

    rem.dislist = list;
    dataBox("list");

    if(mkPlayer.debug) {
        if(musicList[list].id) {
            console.log('加载播放列表 ' + list + ' - ' + musicList[list].name);
        }
    }

    rem.mainList.html('');
    addListhead();

    // 用户歌单添加拖拽类
    if (musicList[list].userPlaylist) {
        rem.mainList.addClass('user-playlist-track');
    } else {
        rem.mainList.removeClass('user-playlist-track');
    }

    if(musicList[list].item.length == 0) {
        addListbar("nodata");
    } else {
        for(var i=0; i<musicList[list].item.length; i++) {
            var tmpMusic = musicList[list].item[i];
            addItem(i + 1, tmpMusic.name, tmpMusic.artist, tmpMusic.album);
            if(list == 1 || list == 2) tmpMusic.url = "";
        }

        if(list == 1) {
            addListbar("clear");
        }

        if(rem.playlist === undefined) {
            if(mkPlayer.autoplay == true) pause();
        } else {
            refreshList();
        }

        listToTop();
    }

    // 用户歌单启用拖拽排序
    if (musicList[list].userPlaylist && typeof userPlaylists !== 'undefined') {
        userPlaylists.enableDragSort();
    }
}

function listToTop() {
    if(rem.isMobile) {
        $("#main-list").animate({scrollTop: 0}, 200);
    } else {
        $("#main-list").mCustomScrollbar("scrollTo", 0, "top");
    }
}

function addListhead() {
    var html = '<div class="list-item list-head">' +
    '    <span class="music-album">专辑</span>' +
    '    <span class="auth-name">歌手</span>' +
    '    <span class="music-name">歌曲</span>' +
    '</div>';
    rem.mainList.append(html);
}

function addItem(no, name, auth, album) {
    var html = '<div class="list-item" data-no="' + (no - 1) + '">' +
    '    <span class="list-num">' + no + '</span>' +
    '    <span class="list-mobile-menu"></span>' +
    '    <span class="music-album">' + album + '</span>' +
    '    <span class="auth-name">' + auth + '</span>' +
    '    <span class="music-name">' + name + '</span>' +
    '</div>'; 
    rem.mainList.append(html);
}

function addListbar(types) {
    var html;
    switch(types) {
        case "more":
            html = '<div class="list-item text-center list-loadmore list-clickable" title="点击加载更多数据" id="list-foot">点击加载更多...</div>';
        break;
        case "nomore":
            html = '<div class="list-item text-center" id="list-foot">全都加载完了</div>';
        break;
        case "loading":
            html = '<div class="list-item text-center" id="list-foot">播放列表加载中...</div>';
        break;
        case "nodata":
            html = '<div class="list-item text-center" id="list-foot">这里什么也没有...</div>';
        break;
        case "clear":
            html = '<div class="list-item text-center list-clickable" id="list-foot" onclick="clearDislist();">清空列表</div>';
        break;
    }
    rem.mainList.append(html);
}

function formatTime(time){    
    var hour,minute,second;
    hour = String(parseInt(time/3600,10));
    if(hour.length == 1) hour='0' + hour;
    minute=String(parseInt((time%3600)/60,10));
    if(minute.length == 1) minute='0'+minute;
    second=String(parseInt(time%60,10));
    if(second.length == 1) second='0'+second;
    if(hour > 0) {
        return hour + ":" + minute + ":" + second;
    } else {
        return minute + ":" + second;
    }
}

function urlEncode(String) {
    return encodeURIComponent(String).replace(/'/g,"%27").replace(/"/g,"%22");  
}

function updateMinfo(music) {
    if(!music.id) return false;
    for(var i=0; i<musicList.length; i++) {
        for(var j=0; j<musicList[i].item.length; j++) {
            if(musicList[i].item[j].id == music.id && musicList[i].item[j].source == music.source) {
                musicList[i].item[j] == music;
                j = musicList[i].item.length;
            }
        }
    }
}

function refreshList() {
    if(rem.playlist === undefined) return true;
    $(".list-playing").removeClass("list-playing");
    if(rem.paused !== true) {
        for(var i=0; i<musicList[rem.dislist].item.length; i++) {
            if((musicList[rem.dislist].item[i].id !== undefined) && 
              (musicList[rem.dislist].item[i].id == musicList[1].item[rem.playid].id) && 
              (musicList[rem.dislist].item[i].source == musicList[1].item[rem.playid].source)) {
                $(".list-item[data-no='" + i + "']").addClass("list-playing");
                return true;
            }
        }
    }
}

function addSheet(no, name, cover) {
    if(!cover) cover = "images/music.svg";
    if(!name) name = "读取中...";
    var html = '<div class="sheet-item" data-no="' + no + '">' +
    '    <img class="sheet-cover" src="' +cover+ '">' +
    '    <p class="sheet-name">' +name+ '</p>' +
    '</div>'; 
    rem.sheetList.append(html);
}

function clearSheet() {
    rem.sheetList.html('');
}

function dataBox(choose) {
    $('.btn-box .active').removeClass('active');
    switch(choose) {
        case "list":
            if($(".btn[data-action='player']").css('display') !== 'none') {
                $("#player").hide();
            } else if ($("#player").css('display') == 'none') {
                $("#player").fadeIn();
            }
            $("#main-list").fadeIn();
            $("#sheet").fadeOut();
            if(rem.dislist == 1 || rem.dislist == rem.playlist) {
                $(".btn[data-action='playing']").addClass('active');
            } else if(rem.dislist == 0) {
                $(".btn[data-action='search']").addClass('active');
            }
            // 搜索模式下显示搜索按钮
            if(rem.wd && rem.wd.trim() !== '') {
                $(".btn[data-action='search']").show();
            } else {
                $(".btn[data-action='search']").hide();
            }
        break;
        case "sheet":
            if($(".btn[data-action='player']").css('display') !== 'none') {
                $("#player").hide();
            } else if ($("#player").css('display') == 'none') {
                $("#player").fadeIn();
            }
            $("#sheet").fadeIn();
            $("#main-list").fadeOut();
            $(".btn[data-action='sheet']").addClass('active');
        break;
        case "player":
            $("#player").fadeIn();
            $("#sheet").fadeOut();
            $("#main-list").fadeOut();
            $(".btn[data-action='player']").addClass('active');
        break;
    }
}

function addHis(music) {
    if(rem.playlist == 2) return true;
    if(musicList[2].item.length > 50) musicList[2].item.length = 49;
    if(music.id !== undefined && music.id !== '') {
        for(var i=0; i<musicList[2].item.length; i++) {
            if(musicList[2].item[i].id == music.id && musicList[2].item[i].source == music.source) {
                musicList[2].item.splice(i, 1);
                i = musicList[2].item.length;
            }
        }
    }
    musicList[2].item.unshift(music);
    playerSavedata('his', musicList[2].item);
}

function initList() {
    for(var i=1; i<musicList.length; i++) {
        if(i == 1) {
            var tmp_item = playerReaddata('playing');
            if(tmp_item) {
                musicList[1].item = tmp_item;
                mkPlayer.defaultlist = 1;
            }
        } else if(i == 2) {
            var tmp_item = playerReaddata('his');
            if(tmp_item) {
                musicList[2].item = tmp_item;
            }
        } else if(musicList[i].item == undefined || (i>2 && musicList[i].item.length == 0)) {
            musicList[i].item = [];
        }
        addSheet(i, musicList[i].name, musicList[i].cover);
    }

    if(mkPlayer.defaultlist >= musicList.length) mkPlayer.defaultlist = 1;
    if(musicList[mkPlayer.defaultlist].isloading !== true) loadList(mkPlayer.defaultlist);

    // 加载用户自定义歌单
    if (typeof userPlaylists !== 'undefined') {
        userPlaylists.load();
    }
}

function clearDislist() {
    layer.open({
        title: '确认清空',
        shade: [0.3,'rgba(0,0,0,0.3)'],
        shadeClose: true,
        closeBtn: 0,
        anim: 0,
        isOutAnim: true,
        content: '确定要清空当前列表吗？此操作不可撤销。',
        btn: ['确定清空', '取消'],
        yes: function(index){
            musicList[rem.dislist].item.length = 0;
            if(rem.dislist == 1) {
                playerSavedata('playing', '');
                $(".sheet-item[data-no='1'] .sheet-cover").attr('src', 'images/music.svg');
            } else if(rem.dislist == 2) {
                playerSavedata('his', '');
            }
            layer.msg('列表已被清空');
            dataBox("sheet");
            layer.close(index);
        }
    });
}

function refreshSheet() {
    if(mkPlayer.debug) {
        console.log("开始播放列表 " + musicList[rem.playlist].name + " 中的歌曲");
    }
    $(".sheet-playing").removeClass("sheet-playing");
    $(".sheet-item[data-no='" + rem.playlist + "']").addClass("sheet-playing");
}

function playerSavedata(key, data) {
    var rawKey = key;
    key = 'mkPlayer2_' + key;
    var raw = JSON.stringify(data);
    if (window.localStorage) {
        localStorage.setItem(key, raw);
    }
    if (['his', 'playing', 'volume'].indexOf(rawKey) !== -1) {
        cloudSyncSave(rawKey, data);
    }
}

function playerReaddata(key) {
    if(!window.localStorage) return '';
    key = 'mkPlayer2_' + key;
    return JSON.parse(localStorage.getItem(key));
}

var _cloudSyncTimers = {};
function cloudSyncSave(key, data) {
    if (!localStorage.getItem('crmoment-token')) return;
    if (_cloudSyncTimers[key]) clearTimeout(_cloudSyncTimers[key]);
    _cloudSyncTimers[key] = setTimeout(function() {
        var syncData = data;
        if ((key === 'his' || key === 'playing') && Array.isArray(data)) {
            syncData = data.map(function(item) {
                var clean = {};
                for (var k in item) {
                    if (k !== 'url') clean[k] = item[k];
                }
                return clean;
            });
        }
        $.ajax({
            url: 'api_music_sync.php',
            method: 'POST',
            data: { action: 'save', key: key, data: JSON.stringify(syncData), token: localStorage.getItem('crmoment-token') },
            dataType: 'json'
        });
    }, 2000);
}

function cloudSyncLoad(callback) {
    var token = localStorage.getItem('crmoment-token');
    if (!token) { callback(); return; }
    var keys = ['his', 'playing', 'volume'];
    var pending = keys.length;
    var done = function() { if (--pending <= 0) callback(); };
    keys.forEach(function(key) {
        $.ajax({
            url: 'api_music_sync.php',
            method: 'GET',
            data: { action: 'read', key: key, token: token },
            dataType: 'json',
            success: function(res) {
                if (res.code === 0 && res.data) {
                    var localRaw = localStorage.getItem('mkPlayer2_' + key);
                    var localData = localRaw ? JSON.parse(localRaw) : null;
                    var cloudValue = res.data.value;
                    if (key === 'volume') {
                        if (cloudValue !== null && cloudValue !== undefined) {
                            localStorage.setItem('mkPlayer2_' + key, JSON.stringify(cloudValue));
                        }
                    } else {
                            if (cloudValue && Array.isArray(cloudValue)) {
                            var merged = cloudValue.slice();
                            if (localData && Array.isArray(localData)) {
                                localData.forEach(function(item) {
                                    var exists = merged.some(function(m) {
                                        return m.id === item.id && m.source === item.source;
                                    });
                                    if (!exists) merged.push(item);
                                });
                            }
                            if (key === 'his' && merged.length > 50) merged.length = 50;
                            localStorage.setItem('mkPlayer2_' + key, JSON.stringify(merged));
                        }
                    }
                }
                done();
            },
            error: function() { done(); }
        });
    });
}

function checkLoginStatus() {
    const token = localStorage.getItem('crmoment-token');
    const cachedUser = localStorage.getItem('crmoment-user');
    const loginLink = document.getElementById('login-link');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');

    if (token) {
        loginLink.style.display = 'none';
        
        if (cachedUser) {
            try {
                const user = JSON.parse(cachedUser);
                userName.textContent = user.nickname || user.username;
                userInfo.style.display = 'inline';
            } catch (e) {}
        }
        
        fetch('api_checktoken.php?token=' + encodeURIComponent(token))
            .then(res => res.json())
            .then(data => {
                if (data.code === 0) {
                    const user = data.data;
                    userName.textContent = user.nickname || user.username;
                    userInfo.style.display = 'inline';
                    localStorage.setItem('crmoment-user', JSON.stringify(user));
                } else {
                    localStorage.removeItem('crmoment-token');
                    localStorage.removeItem('crmoment-user');
                    loginLink.style.display = 'inline';
                    userInfo.style.display = 'none';
                }
            })
            .catch(() => {
                if (!cachedUser) {
                    loginLink.style.display = 'inline';
                    userInfo.style.display = 'none';
                }
            });
    } else {
        loginLink.style.display = 'inline';
        userInfo.style.display = 'none';
    }
}

function handleLoginClick() {
    const loginLink = document.getElementById('login-link');
    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            const redirectUrl = window.location.protocol + '//' + window.location.host + '/readtoken.php';
            const authUrl = 'https://crmoment.ccwu.cc/auth.php?url=' + encodeURIComponent(redirectUrl);
            window.location.href = authUrl;
        });
    }
}

function processTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (token) {
        localStorage.setItem('crmoment-token', token);
        if (userParam) {
            try {
                const user = JSON.parse(decodeURIComponent(userParam));
                localStorage.setItem('crmoment-user', JSON.stringify(user));
            } catch (e) {}
        }
        urlParams.delete('token');
        urlParams.delete('user');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, document.title, newUrl);
    }
}

$(document).ready(function() {
    processTokenFromUrl();
    checkLoginStatus();
    handleLoginClick();
    if (typeof CRMID !== 'undefined') {
        setTimeout(function() { CRMID.handleHash(); }, 500);
    }
});
