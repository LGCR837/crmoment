var CRMID = {
    prefixes: { netease: 'N', kugou: 'K', tencent: 'Q' },
    toCrmid: function(source, id) {
        var prefix = this.prefixes[source];
        if (!prefix) return null;
        return prefix + id;
    },
    fromCrmid: function(crmid) {
        if (!crmid || crmid.length < 2) return null;
        var prefix = crmid.charAt(0);
        var id = crmid.substring(1);
        var source = null;
        for (var k in this.prefixes) {
            if (this.prefixes[k] === prefix) { source = k; break; }
        }
        if (!source) return null;
        return { source: source, id: id };
    },
    getShareUrl: function(crmid) {
        var base = window.location.origin + window.location.pathname;
        return base + '#/play/' + crmid;
    },
    playByCrmid: function(crmid) {
        var self = this;
        var info = this.fromCrmid(crmid);
        if (!info) { layer.msg('无效的分享链接'); return; }
        var loading = layer.msg('正在获取歌曲...', {icon: 16, shade: [0.25, '#000'], time: 10000});

        $.ajax({
            type: mkPlayer.method,
            url: mkPlayer.api,
            data: 'types=song&id=' + info.id + '&source=' + info.source,
            dataType: mkPlayer.dataType,
            success: function(jsonData) {
                layer.close(loading);
                if (!jsonData || !jsonData.length) {
                    layer.msg('未找到该歌曲（CRMID: ' + crmid + '）');
                    return;
                }
                var found = jsonData[0];
                var music = {
                    id: found.id, name: found.name, artist: found.artist[0],
                    album: found.album, source: found.source,
                    url_id: found.url_id, pic_id: found.pic_id,
                    lyric_id: found.lyric_id, pic: null, url: null
                };
                if (rem.playlist === undefined) {
                    rem.playlist = 1; rem.dislist = 1;
                }
                musicList[1].item = [music];
                playerSavedata('playing', musicList[1].item);
                loadList(1);
                listClick(0);
            },
            error: function() {
                layer.close(loading);
                layer.msg('歌曲获取失败');
            }
        });
    },
    handleHash: function() {
        var hash = window.location.hash;
        if (hash && hash.indexOf('#/play/') === 0) {
            var crmid = hash.substring(7);
            if (crmid) {
                this.playByCrmid(crmid);
                return true;
            }
        }
        return false;
    }
};
