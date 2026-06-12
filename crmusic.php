<?php
$music_id = isset($_GET['id'])    ? (int)$_GET['id'] : 0;
$music_url = isset($_GET['music']) ? trim($_GET['music']) : '';
$lrc_url   = isset($_GET['lrc'])   ? trim($_GET['lrc'])   : '';
$bg_url    = isset($_GET['bg'])    ? trim($_GET['bg'])    : '';
$lrc_pos   = isset($_GET['lrc_pos']) ? trim($_GET['lrc_pos']) : 'center';
$lrc_color = isset($_GET['lrc_color']) ? trim($_GET['lrc_color']) : 'light';
if (!in_array($lrc_pos, ['left', 'center', 'right'], true)) $lrc_pos = 'center';
if (!in_array($lrc_color, ['light', 'dark'], true)) $lrc_color = 'light';

if (empty($music_url) || empty($lrc_url)) {
    http_response_code(400);
    exit('错误：缺少必要参数。请提供 music 和 lrc 参数。');
}

$music_url_esc = htmlspecialchars($music_url, ENT_QUOTES, 'UTF-8');
$lrc_url_esc   = htmlspecialchars($lrc_url,   ENT_QUOTES, 'UTF-8');
$bg_url_esc    = htmlspecialchars($bg_url,    ENT_QUOTES, 'UTF-8');
$music_js    = json_encode($music_url);
$lrc_js      = json_encode($lrc_url);
$bg_js       = json_encode($bg_url);
$music_id_js = json_encode($music_id);

// 是否有图片背景
$has_bg  = !empty($bg_url);
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <title>CRMusic</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            --bg-color: #000000;
            --text-color: #f5f5f5;
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: var(--bg-color);<?php if ($has_bg): ?>
            background-image: url('<?php echo $bg_url_esc; ?>');
            background-size: cover;
            background-position: center center;
            background-attachment: fixed;
            background-repeat: no-repeat;<?php endif; ?>
            color: var(--text-color);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            position: relative;
        }

        /* 深色歌词 */
        body.dark-lrc {
            --text-color: #222222;
            text-shadow: 0 1px 3px rgba(255, 255, 255, 0.3);
        }
        body.dark-lrc li.active {
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
        }

        div.container {
            width: 100%;
            height: 100vh;
            overflow: hidden;
            padding-bottom: 100px;
            box-sizing: border-box;
        }

        .audio-wrapper {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 10;
            display: flex;
            justify-content: center;
            background: linear-gradient(transparent, rgba(0,0,0,0.6));
            padding: 12px 0 8px;
        }

        /* 歌词位置 */
        .container-left { text-align: left; padding-left: 5%; }
        .container-left li { text-align: left; }
        .container-center { text-align: center; }
        .container-right { text-align: right; padding-right: 5%; }
        .container-right li { text-align: right; }
        /* 小屏幕强制居中（手机 < 768px） */
        @media (max-width: 767px) {
            .container-left, .container-right {
                text-align: center;
                padding: 0;
            }
            .container-left li, .container-right li {
                text-align: center;
            }
        }

        .container ul {
            transition: transform 0.3s ease-out;
            will-change: transform;
        }

        audio {
            display: block;
            width: 85%;
            max-width: 500px;
            min-height: 54px;
            outline: none;
            transition: opacity 0.2s ease;
        }

        audio.audio-hidden {
            opacity: 0;
            pointer-events: none;
        }

        li {
            padding: 10px 16px;
            text-align: center;
            color: var(--text-color);
            transition: font-size 0.4s ease, text-shadow 0.4s ease;
            list-style: none;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            white-space: normal;
            word-break: break-word;
            max-width: 90vw;
            margin: 0 auto;
        }

        /* 高亮歌词：去掉 transform scale（会导致对齐和动画问题），改用 font-size */
        li.active {
            font-size: 1.35em;
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
            font-weight: 700;
        }

        .container::-webkit-scrollbar { width: 0; background: transparent; }
    </style>
</head>
<body class="<?php echo $lrc_color === 'dark' ? 'dark-lrc' : ''; ?>">
    <div class="container container-<?php echo htmlspecialchars($lrc_pos, ENT_QUOTES, 'UTF-8'); ?>"><ul></ul></div>
    <div class="audio-wrapper">
        <audio controls src="<?php echo $music_url_esc; ?>" autoplay loop></audio>
    </div>

    <script>
        const MUSIC_ID  = <?php echo $music_id_js; ?>;
        const MUSIC_URL = <?php echo $music_js; ?>;
        const LRC_URL   = <?php echo $lrc_js; ?>;
        const BG_URL    = <?php echo $bg_js; ?>;
        if (BG_URL) document.body.style.backgroundImage = `url('${BG_URL}')`;

        const doms = {
            ul: document.querySelector("ul"),
            audio: document.querySelector("audio"),
            container: document.querySelector(".container"),
            wrapper: document.querySelector(".audio-wrapper")
        };
        let lrcObj = null, liHeight = 0, containerHeight = 0;

        // 强制单曲循环（确保 loop 属性生效）
        doms.audio.loop = true;

        // 尝试自动播放（若浏览器策略阻止则静默失败）
        doms.audio.play().catch(e => console.log("自动播放被阻止:", e));

        // ===== 播放量统计 =====
        // 每次音频开始播放时（包括循环重新开始），向后台发送播放+1 请求
        if (MUSIC_ID > 0) {
            doms.audio.addEventListener("play", () => {
                fetch('/api.php?route=/music/' + MUSIC_ID + '/play', { method: 'POST' })
                    .catch(e => console.log("播放量统计失败:", e));
            });
        }

        function parseLRC(lrc) {
            let result = [];
            lrc.split("\n").forEach(line => {
                let arr = line.split("]");
                if (!arr[1]) return;
                let timeParts = arr[0].substring(1).split(":");
                let time = +timeParts[0] * 60 + +timeParts[1];
                result.push({ time: time, text: arr[1] });
            });
            return result;
        }

        function createElement(obj) {
            let frag = document.createDocumentFragment();
            obj.forEach(item => {
                let li = document.createElement("li");
                li.textContent = item.text;
                frag.appendChild(li);
            });
            doms.ul.appendChild(frag);
        }

        function findIndex(lrcObj) {
            let adjustedTime = doms.audio.currentTime + 0.3;
            if (adjustedTime < lrcObj[0].time) return 0;
            if (adjustedTime > lrcObj[lrcObj.length - 1].time) return lrcObj.length - 1;
            for (let i = 0; i < lrcObj.length; i++) {
                if (adjustedTime < lrcObj[i].time) return i - 1;
            }
            return 0;
        }

        function setOffset() {
            if (!lrcObj) return;
            let index = findIndex(lrcObj);
            index = Math.max(0, Math.min(index, lrcObj.length - 1));
            let offset = containerHeight / 2 - (index + 0.5) * liHeight;
            doms.ul.style.transform = `translateY(${offset}px)`;
            let active = document.querySelector(".active");
            if (active) active.classList.remove("active");
            let currentLi = doms.ul.children[index];
            if (currentLi) currentLi.classList.add("active");
        }

        function initAutoHide() {
            const audio = doms.audio;
            const wrapper = doms.wrapper;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            if (!isMobile) {
                audio.classList.remove('audio-hidden');
                wrapper.addEventListener('mouseenter', () => audio.classList.remove('audio-hidden'));
                wrapper.addEventListener('mouseleave', () => audio.classList.add('audio-hidden'));
            } else {
                let hideTimer;
                const show = () => {
                    audio.classList.remove('audio-hidden');
                    clearTimeout(hideTimer);
                    hideTimer = setTimeout(() => audio.classList.add('audio-hidden'), 5000);
                };
                show();
                ['touchstart', 'touchmove', 'touchend'].forEach(ev => {
                    document.addEventListener(ev, show, { passive: true });
                });
            }
        }

        async function loadLRC() {
            try {
                const resp = await fetch(LRC_URL);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const lrcText = await resp.text();
                lrcObj = parseLRC(lrcText);
                createElement(lrcObj);
                if (lrcObj[0]?.text.trim()) document.title = lrcObj[0].text.trim();
                containerHeight = doms.container.clientHeight;
                liHeight = doms.ul.children[0].clientHeight;
                setOffset();
                doms.audio.addEventListener("timeupdate", setOffset);
                initAutoHide();
            } catch (error) {
                console.error("加载歌词失败:", error);
                doms.ul.innerHTML = '<li style="color:#ff8888;">歌词加载失败，请检查网络或稍后重试。</li>';
            }
        }

        window.addEventListener('DOMContentLoaded', loadLRC);
    </script>
</body>
</html>