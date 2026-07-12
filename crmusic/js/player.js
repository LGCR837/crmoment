/**************************************************
 * CRMusicNeo - Player Core Module
 * Based on MKOnlinePlayer v2.41 by mengkun
 *************************************************/
// 播放器功能配置
var mkPlayer = {
    api: "api.php", // api地址
    loadcount: 20,  // 搜索结果一次加载多少条
    comments: false, // 关闭歌曲评论功能
    method: "POST",     // 数据传输方式(POST/GET)
    dataType: "json",   // 服务器返回的数据格式(json/jsonp)
    defaultlist: 3,    // 默认要显示的播放列表编号
    autoplay: false,    // 是否自动播放(true/false)
    coverbg: true,      // 是否开启封面背景(true/false)
    mcoverbg: true,     // 是否开启[移动端]封面背景(true/false)
    dotshine: true,    // 是否开启播放进度条的小点闪动效果
    mdotshine: false,   // 是否开启[移动端]播放进度条的小点闪动效果
    placard: false,   // 关闭公告弹窗
    volume: 0.75,        // 默认音量值(0~1之间)
    version: "v3.0",    // 播放器当前版本号
    debug: false   // 是否开启调试模式(true/false)
};


/*******************************************************
 * 播放器核心文件
 ******************************************************/

// 存储全局变量
var rem = [];

// 默认单曲循环
rem.order = 1;

// 音频错误处理函数
function audioErr() {
    if(rem.playlist === undefined) return true;

    if(rem.errCount > 10) {
        layer.msg('似乎出了点问题~播放已停止');
        rem.errCount = 0;
    } else {
        rem.errCount++;
        if(rem.order === 1) {
            layer.msg('当前歌曲播放失败');
        } else {
            layer.msg('当前歌曲播放失败，自动播放下一首');
            nextMusic();
        }
    }
}

// 点击暂停按钮的事件
function pause() {
    if(rem.paused === false) {
        rem.audio[0].pause();
    } else {
        if(rem.playlist === undefined) {
            rem.playlist = rem.dislist;
            musicList[1].item = musicList[rem.playlist].item;
            playerSavedata('playing', musicList[1].item);
            listClick(0);
        }
        rem.audio[0].play();
    }
}

// 循环顺序切换 - 默认单曲循环(1)
function orderChange() {
    var orderDiv = $(".btn-order");
    switch(rem.order) {
        case 1:     // 单曲循环 -> 列表循环
            // 隐藏单曲循环图标，显示列表循环图标
            orderDiv.find('.icon-order-single').hide();
            orderDiv.find('.icon-order-list').show();
            orderDiv.attr("title", "列表循环");
            layer.msg("列表循环");
            rem.order = 2;
            break;
            
        case 2:     // 列表循环 -> 随机播放
            orderDiv.find('.icon-order-list').hide();
            orderDiv.find('.icon-order-random').show();
            orderDiv.attr("title", "随机播放");
            layer.msg("随机播放");
            rem.order = 3;
            break;
            
        case 3:     // 随机播放 -> 单曲循环
        default:
            orderDiv.find('.icon-order-random').hide();
            orderDiv.find('.icon-order-single').show();
            orderDiv.attr("title", "单曲循环");
            layer.msg("单曲循环");
            rem.order = 1;
    }
}

// 播放状态回调
function audioPlay() {
    rem.paused = false;
    refreshList();
    // 切换为暂停图标
    $(".btn-play .icon-play-svg").hide();
    $(".btn-play .icon-pause-svg").show();
    
    if((mkPlayer.dotshine === true && !rem.isMobile) || (mkPlayer.mdotshine === true && rem.isMobile)) {
        $("#music-progress .mkpgb-dot").addClass("dot-move");
    }
    
    var music = musicList[rem.playlist].item[rem.playid];
    // 静态标题：播放时显示 "歌曲名 - 歌手 - CRMusic Neo"
    document.title = music.name + " - " + music.artist + " - CRMusic Neo";
    // 更新右侧歌曲名显示
    $("#now-playing-title").text(music.name);
    $("#now-playing-artist").text(music.artist);
}

function audioPause() {
    rem.paused = true;
    $(".list-playing").removeClass("list-playing");
    // 切换为播放图标
    $(".btn-play .icon-play-svg").show();
    $(".btn-play .icon-pause-svg").hide();
    $("#music-progress .dot-move").removeClass("dot-move");

    // 静态标题：暂停时恢复默认
    document.title = "CRMusic Neo";
    // 暂停时不改变歌曲名和歌手，保持当前显示（同歌词行为）
}

function prevMusic() {
    playList(rem.playid - 1);
}

function nextMusic() {
    switch (rem.order ? rem.order : 1) {
        case 1,2: 
            playList(rem.playid + 1);
        break;
        case 3: 
            if (musicList[1] && musicList[1].item.length) {
                var id = parseInt(Math.random() * musicList[1].item.length);
                playList(id);
            }
        break;
        default:
            playList(rem.playid + 1); 
        break;
    }
}

function autoNextMusic() {
    if(rem.order && rem.order === 1) {
        playList(rem.playid);
    } else {
        nextMusic();
    }
}

function updateProgress(){
    if(rem.paused !== false) return true;
    music_bar.goto(rem.audio[0].currentTime / rem.audio[0].duration);
    scrollLyric(rem.audio[0].currentTime);
}

function listClick(no) {
    var tmpid = no;

    // 判断点击的歌曲是否正在播放，是则跳过
    if(rem.playlist !== undefined && rem.playid !== undefined) {
        var clickMusic = musicList[rem.dislist].item[no];
        var playMusic = musicList[rem.playlist].item[rem.playid];
        if(clickMusic && playMusic && clickMusic.id == playMusic.id && clickMusic.source == playMusic.source) {
            if(mkPlayer.debug) {
                console.log("歌曲正在播放，跳过：" + clickMusic.name);
            }
            return false;
        }
    }

    if(mkPlayer.debug) {
        console.log("点播了列表中的第 " + (no + 1) + " 首歌 " + musicList[rem.dislist].item[no].name);
    }

    // 立即显示歌曲信息（不等音频加载）
    var previewMusic = musicList[rem.dislist].item[no];
    $("#now-playing-title").text(previewMusic.name);
    $("#now-playing-artist").text(previewMusic.artist);

    // 立即高亮列表项
    $(".list-playing").removeClass("list-playing");
    $(".list-item[data-no='" + no + "']").addClass("list-playing");

    if(rem.dislist === 0) {
        if(rem.playlist === undefined) {
            rem.playlist = 1;
            rem.playid = musicList[1].item.length - 1;
        }

        var tmpMusic = musicList[0].item[no];

        for(var i=0; i<musicList[1].item.length; i++) {
            if(musicList[1].item[i].id == tmpMusic.id && musicList[1].item[i].source == tmpMusic.source) {
                tmpid = i;
                playList(tmpid);
                return true;
            }
        }

        musicList[1].item.splice(rem.playid + 1, 0, tmpMusic);
        tmpid = rem.playid + 1;
        playerSavedata('playing', musicList[1].item);
    } else {
        if((rem.dislist !== rem.playlist && rem.dislist !== 1) || rem.playlist === undefined) {
            rem.playlist = rem.dislist;
            musicList[1].item = musicList[rem.playlist].item;
            playerSavedata('playing', musicList[1].item);
            refreshSheet();
        }
    }

    playList(tmpid);
    return true;
}

function playList(id) {
    if(rem.playlist === undefined) {
        pause();
        return true;
    }
    
    if(musicList[1].item.length <= 0) return true;
    
    if(id >= musicList[1].item.length) id = 0;
    if(id < 0) id = musicList[1].item.length - 1;
    
    rem.playid = id;
    musicList[1].item[id].url = "";

    if(musicList[1].item[id].url === null || musicList[1].item[id].url === "") {
        ajaxUrl(musicList[1].item[id], play);
    } else {
        play(musicList[1].item[id]);
    }
}

function initAudio() {
    rem.audio = $('<audio></audio>').appendTo('body');
    rem.audio[0].volume = volume_bar.percent;
    rem.audio[0].addEventListener('timeupdate', updateProgress);
    rem.audio[0].addEventListener('play', audioPlay);
    rem.audio[0].addEventListener('pause', audioPause);
    $(rem.audio[0]).on('ended', autoNextMusic);
    rem.audio[0].addEventListener('error', audioErr);
}

function play(music) {
    if(mkPlayer.debug) {
        console.log('开始播放 - ' + music.name);
    }
    
    if(music.url == "err") {
        audioErr();
        return false;
    }
    
    addHis(music);
    
    if(rem.dislist == 2 && rem.playlist !== 2) {
        loadList(2);
    } else {
        refreshList();
    }
    
    try {
        // 评论功能已关闭
        rem.audio[0].pause();
        rem.audio.attr('src', music.url);
        rem.audio[0].play();
    } catch(e) {
        audioErr();
        return;
    }
    
    rem.errCount = 0;
    music_bar.goto(0);
    changeCover(music);
    ajaxLyric(music, lyricCallback);
    music_bar.lock(false);
}

function mBcallback(newVal) {
    var newTime = rem.audio[0].duration * newVal;
    rem.audio[0].currentTime = newTime;
    refreshLyric(newTime);
}

function vBcallback(newVal) {
    if(rem.audio[0] !== undefined) {
        rem.audio[0].volume = newVal;
    }

    var $btn = $(".btn-quiet");

    if(newVal === 0) {
        $btn.addClass("btn-state-quiet");
        $btn.find('.icon-volume-on').hide();
        $btn.find('.icon-volume-off').show();
    } else {
        $btn.removeClass("btn-state-quiet");
        $btn.find('.icon-volume-on').show();
        $btn.find('.icon-volume-off').hide();
    }

    playerSavedata('volume', newVal);
}

var initProgress = function(){  
    music_bar = new mkpgb("#music-progress", 0, mBcallback);
    music_bar.lock(true);
    var tmp_vol = playerReaddata('volume');
    tmp_vol = (tmp_vol != null)? tmp_vol: (rem.isMobile? 1: mkPlayer.volume);
    if(tmp_vol < 0) tmp_vol = 0;
    if(tmp_vol > 1) tmp_vol = 1;
    if(tmp_vol == 0) $(".btn-quiet").addClass("btn-state-quiet");
    volume_bar = new mkpgb("#volume-progress", tmp_vol, vBcallback);
};  

mkpgb = function(bar, percent, callback){  
    this.bar = bar;
    this.percent = percent;
    this.callback = callback;
    this.locked = false;
    this.init();  
};

mkpgb.prototype = {
    init : function(){  
        var mk = this,mdown = false;
        $(mk.bar).html('<div class="mkpgb-bar"></div><div class="mkpgb-cur"></div><div class="mkpgb-dot"></div>');
        mk.minLength = $(mk.bar).offset().left; 
        mk.maxLength = $(mk.bar).width() + mk.minLength;
        $(window).resize(function(){
            mk.minLength = $(mk.bar).offset().left; 
            mk.maxLength = $(mk.bar).width() + mk.minLength;
        });
        $(mk.bar + " .mkpgb-dot").mousedown(function(e){
            e.preventDefault();
        });
        $(mk.bar).mousedown(function(e){
            if(!mk.locked) mdown = true;
            barMove(e);
        });
        $("html").mousemove(function(e){
            barMove(e);
        });
        $("html").mouseup(function(e){
            mdown = false;
        });
        $(mk.bar).on("touchstart", function(e){
            if(!mk.locked) mdown = true;
            barMove(e);
        });
        $("html").on("touchmove", function(e){
            if(mdown) barMove(e);
        });
        $("html").on("touchend", function(e){
            mdown = false;
        });

        function barMove(e) {
            if(!mdown) return;
            var clientX;
            if(e.originalEvent && e.originalEvent.touches) {
                clientX = e.originalEvent.touches[0].clientX;
            } else {
                clientX = e.clientX;
            }
            var percent = 0;
            if(clientX < mk.minLength){ 
                percent = 0; 
            }else if(clientX > mk.maxLength){ 
                percent = 1;
            }else{  
                percent = (clientX - mk.minLength) / (mk.maxLength - mk.minLength);
            }
            mk.callback(percent);
            mk.goto(percent);
            return true;
        }
        
        mk.goto(mk.percent);
        return true;
    },
    goto : function(percent) {
        if(percent > 1) percent = 1;
        if(percent < 0) percent = 0;
        this.percent = percent;
        $(this.bar + " .mkpgb-dot").css("left", (percent*100) +"%"); 
        $(this.bar + " .mkpgb-cur").css("width", (percent*100)+"%");
        return true;
    },
    lock : function(islock) {
        if(islock) {
            this.locked = true;
            $(this.bar).addClass("mkpgb-locked");
        } else {
            this.locked = false;
            $(this.bar).removeClass("mkpgb-locked");
        }
        return true;
    }
};  

// 快捷键
document.onkeydown = function showkey(e) {
    var key = e.keyCode || e.which || e.charCode;
    var ctrl = e.ctrlKey || e.metaKey;
    var isFocus = $('input').is(":focus");  
    if (ctrl && key == 37 && !isFocus) playList(rem.playid - 1);
    if (ctrl && key == 39 && !isFocus) playList(rem.playid + 1);
    if (key == 32 && !isFocus) pause();
}
