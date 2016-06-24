(function(){
    define('load-youtube', function(){
        var $ = require('jquery');
        var superSteamAsset = require('supersteam-asset');
        var inlineScriptLoader = require("load-script-inline");

        var _youtubeFunctions = {

            loadYoutubePlayer: function(appid){

                var loadUpdatedHighlightPlayerInit = function(){
                    //console.log('loadhighlightplayer init');
                    return inlineScriptLoader.load('js/gamehighlightplayer_updated.js');
                };

                var parseYoutubeInfo = function(){
                    var youtubeAppId = appid;
                    //console.log("this is the app id "+youtubeAppId);
                    var youtubeVideoData = function(data) {
                        //console.log("this is data");
                        //console.log(data);
                        var formated_array = {};
                        var thumb_data = {};
                        var channel_data = {};

                        if (!data['data']) return;

                        videos = data['data']['videos'];
                        rating_change = data['data']['rating_change'];

                        if(videos && videos.length>0){
                            for (var i = videos.length; i--;) {
                                var item = videos[i];
                                var yid = (item.yid).replace(/<[^>]*>?/g, '');

                                formated_array['yv_'+yid] = yid;
                                thumb_data['yv_'+yid] = (item.thumb).replace(/<[^>]*>?/g, '');
                                channel_data['yv_'+yid] = (item.channel).replace(/<[^>]*>?/g, '');
                            }


                            for(key in thumb_data) {
                                var channel_name = channel_data[key].length > 17 ? channel_data[key].substring(0,14)+"..." : channel_data[key];

                                highlight_strip_youtube = '<div class="highlight_strip_item highlight_strip_youtube" id="thumb_youtube_'+ key +'">'+
                                    '<img style="max-width: 100%;max-height:100%;" src="'+thumb_data[key]+'">'+
                                    '<div class="highlight_youtube_marker"></div>'+
                                    '<div class="highlight_channel_marker">'+channel_name+'</div>'+
                                    '</div>';

                                $('.highlight_selector').after(highlight_strip_youtube);

                                highlight_youtube = '<div style="display: none;" class="highlight_player_item highlight_youtube tall" id="highlight_youtube_'+key+'">'+
                                    '<div id="youtube_'+key+'"/>'+

                                    '</div>';

                                $('.highlight_player_area_spacer').after(highlight_youtube);
                            }

                            $('#highlight_strip_scroll').width($('#highlight_strip_scroll').width() + Object.keys(formated_array).length*120);

                            var youtubeUrlCode = 'var rgYoutubeURLs = ' + JSON.stringify(formated_array); + ';';
                            return inlineScriptLoader.load(youtubeUrlCode);
                        }

                    }

                    return superSteamAsset.get("https://steamwatcher.com/boiler/youtube/videoid.php?appid="+youtubeAppId, youtubeVideoData);
                };

                var initializeYTPlayer = function(){
                    return inlineScriptLoader.load('js/playerinit.js');
                };
                //resolve promise when the three functions have run
               return loadUpdatedHighlightPlayerInit().then(parseYoutubeInfo).then(initializeYTPlayer);
            }
        }
        return _youtubeFunctions;
    });
})();