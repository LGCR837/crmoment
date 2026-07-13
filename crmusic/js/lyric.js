/**************************************************
 * CRMusic Neo - 歌词解析及滚动模块 (v2)
 * 基于 crmusic.html 的流畅滚动体验重构
 *************************************************/

var lyricArea = $("#lyric");
var lyricContainer = $(".lyric");

var lrcData = [];
var lastLyricIndex = -1;
var isManualScroll = false;
var wasManualScroll = false;
var scrollTimer = null;
var scrollAnim = null;
var programmaticUntil = 0;
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
var SCROLL_RESUME = isMobile ? 5000 : 3000;

function lyricTip(str) {
    lyricArea.html("<li class='lyric-tip'>" + str + "</li>");
}

function lyricCallback(str, id) {
    if (id !== musicList[rem.playlist].item[rem.playid].id) return;

    rem.lyric = parseLyric(str);

    if (rem.lyric === '') {
        lyricTip('没有歌词');
        return false;
    }

    lrcData = [];
    for (var k in rem.lyric) {
        lrcData.push({ time: parseInt(k), text: rem.lyric[k] });
    }
    lrcData.sort(function(a, b) { return a.time - b.time; });

    lyricArea.html('');
    lyricArea.scrollTop(0);

    lastLyricIndex = -1;
    isManualScroll = false;
    wasManualScroll = false;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < lrcData.length; i++) {
        var li = document.createElement("li");
        li.className = "lrc-item";
        li.dataset.no = i;
        li.dataset.time = lrcData[i].time;
        li.textContent = lrcData[i].text || "\u00A0";
        frag.appendChild(li);
    }
    lyricArea[0].appendChild(frag);
}

function refreshLyric(time) {
    if (lrcData.length === 0) return false;
    var index = findLyricIndex(time);
    scrollToIndex(index, false);
}

function findLyricIndex(time) {
    if (lrcData.length === 0) return 0;
    var adjusted = time + 0.1;
    if (adjusted < lrcData[0].time) return 0;
    if (adjusted > lrcData[lrcData.length - 1].time) return lrcData.length - 1;
    for (var i = 0; i < lrcData.length; i++) {
        if (adjusted < lrcData[i].time) return i - 1;
    }
    return 0;
}

function smoothScrollTo(targetTop, duration) {
    if (scrollAnim) cancelAnimationFrame(scrollAnim);
    var container = lyricArea[0];
    var startTop = container.scrollTop;
    var dist = targetTop - startTop;
    if (Math.abs(dist) < 1) { container.scrollTop = targetTop; return; }
    var startTime = null;
    programmaticUntil = Date.now() + duration + 50;
    function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var ease = 1 - Math.pow(1 - progress, 3);
        container.scrollTop = startTop + dist * ease;
        if (progress < 1) scrollAnim = requestAnimationFrame(step);
        else scrollAnim = null;
    }
    scrollAnim = requestAnimationFrame(step);
}

function scrollToIndex(index, animated) {
    if (index < 0 || index >= lrcData.length) return;

    var items = lyricArea.children('.lrc-item');
    if (items.length === 0) return;

    var prev = lyricArea.children('.lplaying');
    prev.removeClass('lplaying');

    var active = items.eq(index);
    if (!active.hasClass('lplaying')) {
        active.addClass('lplaying');
    }

    if (lastLyricIndex === index) return;
    lastLyricIndex = index;

    if (!isManualScroll) {
        var containerHeight = lyricContainer.height();
        var liTop = active[0].offsetTop;
        var liHeight = active[0].offsetHeight;
        var target = liTop + liHeight / 2 - containerHeight / 2;

        if (animated !== false) {
            smoothScrollTo(target, 600);
        } else {
            lyricArea[0].scrollTop = target;
        }
    }
}

function scrollLyric(time) {
    if (lrcData.length === 0) return false;
    var index = findLyricIndex(time);
    scrollToIndex(index);
}

function parseLyric(lrc) {
    if (lrc === '') return '';
    var lyrics = lrc.split("\n");
    var lrcObj = {};
    for (var i = 0; i < lyrics.length; i++) {
        var lyric = decodeURIComponent(lyrics[i]);
        var timeReg = /\[\d*:\d*((\.|\:)\d*)*\]/g;
        var timeRegExpArr = lyric.match(timeReg);
        if (!timeRegExpArr) continue;
        var clause = lyric.replace(timeReg, '');
        for (var k = 0, h = timeRegExpArr.length; k < h; k++) {
            var t = timeRegExpArr[k];
            var min = Number(String(t.match(/\[\d*/i)).slice(1)),
                sec = Number(String(t.match(/\:\d*/i)).slice(1));
            var time = min * 60 + sec;
            lrcObj[time] = clause;
        }
    }
    return lrcObj;
}

function enterManualMode() {
    isManualScroll = true;
    wasManualScroll = false;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
        isManualScroll = false;
        wasManualScroll = true;
        var time = rem.audio && rem.audio[0] ? rem.audio[0].currentTime : 0;
        var index = findLyricIndex(time);
        scrollToIndex(index);
    }, SCROLL_RESUME);
}

lyricArea.on('click', '.lrc-item', function(e) {
    var li = $(this);
    var time = parseFloat(li.data('time'));
    if (isNaN(time)) return;
    if (rem.audio && rem.audio[0]) {
        rem.audio[0].currentTime = time;
    }
    isManualScroll = false;
    wasManualScroll = false;
    clearTimeout(scrollTimer);
    var index = findLyricIndex(time);
    scrollToIndex(index);
});

if (!isMobile) {
    lyricArea.on('wheel', function() { enterManualMode(); });
} else {
    lyricArea.on('touchmove', function() { enterManualMode(); });
}
