//This file is a substitute to the original gamehighlighplayer.js developed by Valve. It adds youtube playing functionality and fixes some not obvious behaviours.

var g_player = null;
var y_players = {};


function OnMovieComplete()
{
    if ( g_player )
    {
        var activeItem = gPlayer.m_activeItem;
        setTimeout( function() { g_player.OnMovieComplete( activeItem ) }, 2000 );
    }
}

function mute_session( bMuted )
{
    SetGameHighlightAudioEnabled( !bMuted );
}

function auto_play( bEnabled )
{
    SetGameHighlightAutoplayEnabled( bEnabled );
}

function volume_session( flVolume )
{
    SetGameHighlightPlayerVolume( flVolume );
}

function BIsUserGameHighlightAutoplayEnabled()
{
    //the cookie is stored as the inverse
    var rgMatches = document.cookie.match( /(^|; )bGameHighlightAutoplayDisabled=([^;]*)/ );
    return !( rgMatches && rgMatches[2] == "true" );
}

function BIsUserGameHDEnabled()
{
    //the cookie is stored as the inverse
    var rgMatches = document.cookie.match( /(^|; )bGameHDDisabled=([^;]*)/ );

    if (!rgMatches) return false

    return !( rgMatches && rgMatches[2] == "true" );
}

function SetGameHighlightAutoplayEnabled( bEnabled )
{
    var dateExpires = new Date();
    dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * 365 * 10 );
    document.cookie = 'bGameHighlightAutoplayDisabled=' + (!bEnabled ? 'true' : 'false') + '; expires=' + dateExpires.toGMTString() + ';path=/';
}

function SetGameHDEnabled( bEnabled )
{
    var dateExpires = new Date();
    dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * 365 * 10 );
    document.cookie = 'bGameHDDisabled=' + (!bEnabled ? 'true' : 'false') + '; expires=' + dateExpires.toGMTString() + ';path=/';
}


var g_bUserSelectedTrailer = false;
function BIsUserGameHighlightAudioEnabled()
{
    if ( g_bUserSelectedTrailer )
    {
        return true;
    }
    else
    {
        var rgMatches = document.cookie.match(/(^|; )bGameHighlightAudioEnabled=([^;]*)/);
        return ( rgMatches && rgMatches[2] == "true" );
    }
}

function SetGameHighlightAudioEnabled( bEnabled )
{
    document.cookie = 'bGameHighlightAudioEnabled=' + (bEnabled ? 'true' : 'false') + '; path=/';
}

function GetGameHighlightPlayerVolume()
{
    var rgMatches = document.cookie.match( /(^|; )flGameHighlightPlayerVolume=([^;]*)/ );

    var flValue = rgMatches && rgMatches[2] ? rgMatches[2] : -1;

    return flValue >= 0 && flValue <= 100 ? flValue : -1;
}

function SetGameHighlightPlayerVolume( flVolume )
{
    var dateExpires = new Date();
    dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * 365 * 10 );
    document.cookie = 'flGameHighlightPlayerVolume=' + flVolume + '; path=/';
}

function HighlightPlayer( args )
{
    if (typeof(YT) == 'undefined' || typeof(YT.Player) == 'undefined') {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    this.m_elemPlayerArea = $JFromIDOrElement(args.elemPlayerArea);
    this.m_elemStrip = $JFromIDOrElement(args.elemStrip);
    this.m_elemStripScroll = $JFromIDOrElement(args.elemStripScroll);
    this.m_rgMovieFlashvars = args.rgMovieFlashvars || new Array();
    this.m_rgScreenshotURLs = args.rgScreenshotURLs || new Array();
    this.m_rgYoutubeURLs = args.rgYoutubeURLs || new Array();
    this.m_rgDefaultMovieFlashvars = args.rgDefaultMovieFlashvars || {};
    this.m_bVideoOnlyMode = args.bVideoOnlyMode;
    this.m_bUseHTMLPlayer = args.bUseHTMLPlayer;


    //make all the strip items clickable
    var thisClosure = this;
    this.m_elemStrip.find( '.highlight_strip_item' ).each(
        function() {
            var $Thumbnail = $J(this);
            $Thumbnail.click( function() { thisClosure.HighlightItem( $Thumbnail, true ); } );
        }
    );

    this.m_elemSelector = this.m_elemStrip.find('.highlight_selector');

    var elemSlider = $JFromIDOrElement(args.elemSlider);

    var _this = this;
    $J(window ).on('resize.GameHighlightPlayer', function() {
        var nSliderWidth = _this.m_elemStripScroll.width() - _this.m_elemStrip.width();
        if ( nSliderWidth > 0 )
        {
            if ( !_this.slider )
            {
                _this.slider = new CSlider( elemSlider, elemSlider.find('.handle'), {
                    min: 0,
                    max: nSliderWidth,
                    fnOnChange: $J.proxy( _this.SliderOnChange, _this )
                });
            }
            else
                _this.slider.SetRange( 0, nSliderWidth );

            elemSlider.show();
        }
        else
        {
            elemSlider.hide();
        }
    } ).trigger('resize.GameHighlightPlayer');

    var cItems = this.m_elemPlayerArea.find( '.highlight_player_item' ).length;
    if ( cItems == 1 )
    {
        this.m_elemStrip.hide();
    }

    this.m_elemContainer = args.elemContainer ? $JFromIDOrElement(args.elemContainer) : this.m_elemPlayerArea.parents('.highlight_ctn');
    this.m_elemContainer.on( 'mouseover', $J.proxy( this.mouseOver, this ) );
    this.m_elemContainer.on( 'mouseout', $J.proxy( this.mouseOut, this ) );

    var firstItem = args.firstItem ? $JFromIDOrElement(args.firstItem) : this.m_elemPlayerArea.find( '.highlight_player_item' ).first();

    if ( !this.m_bVideoOnlyMode && !BIsUserGameHighlightAutoplayEnabled() &&  Object.keys(this.m_rgYoutubeURLs).length==0)
    {
        firstItem = this.m_elemPlayerArea.find( '.highlight_screenshot').first();
    }

    this.HighlightItem( firstItem );

    RegisterSteamOnWebPanelShownHandler( $J.proxy( this.OnWebPanelShown, this ) );
    RegisterSteamOnWebPanelHiddenHandler( $J.proxy( this.OnWebPanelHidden, this ) );

    var _this = this;
    if ( $J(document.body).hasClass( 'v6' ) )
    {
        var $ScreenshotsLinks = $J(this.m_elemPlayerArea).find('.highlight_player_item.highlight_screenshot a.highlight_screenshot_link');

        $ScreenshotsLinks.click( function( event ) {
            _this.OnScreenshotClick( event, this );
        } );
    }

    $J(this.m_elemPlayerArea).find('.highlight_player_item.highlight_screenshot img').on('load', function() {
        var $Img = $J(this);
        var $Ctn = $Img.parents('.highlight_player_item');

        var bIsHidden = !$Ctn.is(':visible');
        if ( bIsHidden )
            $Ctn.css('visibility','hidden' ).show();

        if ( $Img.height() > $Ctn.height() )
        {
            $Ctn.addClass('tall');
        }
        else
        {
            $Ctn.removeClass('tall');
        }

        if ( bIsHidden )
            $Ctn.css('visibility','' ).hide();
    });

    g_player = this;
}


HighlightPlayer.prototype.HighlightItem = function( elem, bUserAction )
{
    $Elem = $JFromIDOrElement( elem );
    if ( this.BIsMovie( $Elem ) )
        this.HighlightMovie( this.GetMovieId( $Elem ), bUserAction );
    else if (this.BIsScreenshot($Elem))
        this.HighlightScreenshot( this.GetScreenshotId( $Elem ) );
    else
        this.HighlightYoutube(this.GetYoutubeId( $Elem ), bUserAction )

    // preload the next screenshot in-order
    var nextItem = this.m_activeItem.next( '.highlight_player_item' );
    if ( nextItem && this.BIsScreenshot( nextItem ) )
        this.LoadScreenshot( this.GetScreenshotId( nextItem ) );
}

HighlightPlayer.prototype.HighlightMovie = function( id, bUserAction )
{
    if ( this.m_activeItem && this.BIsMovie( this.m_activeItem )
        && this.GetMovieId( this.m_activeItem ) == id )
        return;

    if( this.m_bUseHTMLPlayer )
        this.LoadHTML5Movie( id, bUserAction );
    else
        this.LoadMovie( id, bUserAction );


    this.TransitionTo( $JFromIDOrElement('highlight_movie_' + id ) );
    this.HighlightStripItem( 'thumb_movie_' + id );
}

HighlightPlayer.prototype.HighlightYoutube = function( id, bUserAction )
{
    if ( this.m_activeItem && this.BIsYoutube( this.m_activeItem )
        && this.GetYoutubeId( this.m_activeItem ) == id )
        return;

    this.LoadYoutubeMovie( id, bUserAction )

    this.TransitionTo( $JFromIDOrElement('highlight_youtube_' + id ) );
    this.HighlightStripItem( 'thumb_youtube_' + id );
}

HighlightPlayer.prototype.HighlightScreenshot = function( id, bSkipAnimation )
{
    this.LoadScreenshot( id );

    this.TransitionTo( $JFromIDOrElement('highlight_screenshot_' + id), bSkipAnimation );
    this.HighlightStripItem( 'thumb_screenshot_' + id, bSkipAnimation );

    //after showing at least one screenshot, show only screenshots from that point onward
    this.bScreenshotsOnly = true;
    this.StartTimer();
}

HighlightPlayer.prototype.LoadHTML5Movie = function( id, bUserAction )
{
    var strTarget = 'movie_' + id;
    var $Target = $JFromIDOrElement( strTarget );

    // Not the best logic here. use the global to tell the player that it should unmute this video is bad
    //g_bUserSelectedTrailer = bUserAction;

    if( $Target.length > 0 && $Target[0].play )
    {
        bIsHD = BIsUserGameHDEnabled()

        if(bIsHD)
        {
            $Target[0].setAttribute('data-default-src', $Target[0].src);
            $Target[0].src = $Target[0].getAttribute('data-hd-src');
        }

        $Target[0].load();
        $Target[0].play();

        $Target.on( 'ended', $J.proxy( this.Transition, this) );
    }
}

HighlightPlayer.prototype.LoadYoutubeMovie = function( id, bUserAction )
{
    var strTarget = 'youtube_' + id;

    // Not the best logic here. use the global to tell the player that it should unmute this video is bad
    //g_bUserSelectedTrailer = bUserAction;

    videoID = this.m_rgYoutubeURLs[ id ]

    if(y_players[id]) return

    if (typeof(YT) == 'undefined' || typeof(YT.Player) == 'undefined')
    {
        //What is the answer to life the universe and everything? setTimeout!

        setTimeout( function() {  g_player.LoadYoutubeMovie( id ) }, 2000 );
        return
    }


    yPlayer = new YT.Player(strTarget, {
        height: '338',
        width: '600',
        videoId: videoID,
        showinfo: 0,
        modestbranding: 1,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

    y_players[id] = yPlayer

    function onPlayerReady(event) {
        if(!BIsUserGameHighlightAutoplayEnabled()) return;
        if(!g_player.BIsYoutube( g_player.m_activeItem )) return

        var youtubeID = g_player.GetYoutubeId( g_player.m_activeItem );
        yPlayer = y_players[youtubeID]

        if(!yPlayer) return
        if (yPlayer != event.target) return

        if (!BIsUserGameHighlightAudioEnabled())
        {
            event.target.mute();
        } else
        {
            var flVolume = GetGameHighlightPlayerVolume();

            if ( flVolume != -1 )
                event.target.setVolume(flVolume);
        }


        event.target.playVideo();
    }

    function onPlayerStateChange(event) {
        if (event.data != YT.PlayerState.ENDED && event.data != YT.PlayerState.PAUSED)
        {
            if(!g_player.BIsYoutube( g_player.m_activeItem)) {event.target.pauseVideo(); return}
            var youtubeID = g_player.GetYoutubeId( g_player.m_activeItem );
            yPlayer = y_players[youtubeID]

            if(!yPlayer || yPlayer != event.target) {event.target.pauseVideo(); return}
        }

        if (event.data == YT.PlayerState.ENDED) {
            g_player.Transition()
        }

    }
}

HighlightPlayer.prototype.LoadMovie = function( id, bUserAction )
{
    var strTarget = 'movie_' + id;
    var $Target = $JFromIDOrElement(strTarget);
    var rgFlashVars = $J.extend( {}, this.m_rgDefaultMovieFlashvars, this.m_rgMovieFlashvars[ 'movie_' + id ] );

    if ( !this.m_bVideoOnlyMode )
    {
        //if ( BIsUserGameHighlightAutoplayEnabled() )
        //rgFlashVars.CHECKBOX_AUTOPLAY_CHECKED = 'true';
        //if ( !BIsUserGameHighlightAudioEnabled() && !bUserAction ) // - because this logic is kinda stupid and unclear. sorry
        if ( !BIsUserGameHighlightAudioEnabled())
            rgFlashVars.START_MUTE = 'true';
        var flVolume = GetGameHighlightPlayerVolume();
        if ( flVolume != -1 )
            rgFlashVars.SAVED_VOLUME = flVolume;
    }

    if ( $Target.length && $Target[0].tagName == 'DIV' )
    {
        var strRequiredVersion = "9";
        if ( typeof( g_bIsOnMac ) != 'undefined' && g_bIsOnMac ) strRequiredVersion = "10.1.0";
        swfobject.embedSWF( "http://store.akamai.steamstatic.com/public/swf/videoPlayer.swf?v=10", strTarget, rgFlashVars['STAGE_WIDTH'], rgFlashVars['STAGE_HEIGHT'], strRequiredVersion, false, rgFlashVars, {wmode: "opaque", allowScriptAccess: "always", allowFullScreen: "true" } );

        // is the element still around?
        $Target = $JFromIDOrElement(strTarget);
        if ( $Target.length && $Target[0].tagName == 'DIV' )
        {
            //looks like the user doesn't have flash, show this message
            $Target.show();
        }
    }
}

HighlightPlayer.prototype.LoadScreenshot = function( id )
{
    var $Target = $JFromIDOrElement( 'highlight_screenshot_' + id );
    if ( $Target.length )
    {
        var url = this.GetScreenshotURL( id, '600x338' );
        var $Img = $Target.find('img');
        if ( $Img.attr( 'src' ) != url )
            $Img.attr( 'src', url );

    }
}

HighlightPlayer.prototype.GetScreenshotURL = function( id, size )
{
    return this.m_rgScreenshotURLs[ id ].replace( /_SIZE_/g, size ? '.' + size : '' );
}

HighlightPlayer.prototype.TransitionTo = function( elem, bSkipAnimation )
{
    var $Elem = $JFromIDOrElement( elem );
    if ( this.m_activeItem )
    {
        if ( this.BIsMovie( this.m_activeItem ) )
        {
            //stop movies
            var movieid = this.GetMovieId( this.m_activeItem );
            var $Container = $JFromIDOrElement('highlight_movie_' + movieid);

            if( this.m_bUseHTMLPlayer)
            {
                var $Video = $JFromIDOrElement('movie_' + movieid);
                $Video.trigger( 'pause' );
            }
            else
            {
                if ( $Container.find('.flash_ctn').length )
                    $Container = $Container.find('.flash_ctn');
                var strTarget = 'movie_' + movieid;
                $Container.html( '<div id="' + strTarget + '"></div>' );
            }
            this.m_activeItem.hide();

        }
        else if ( this.BIsYoutube( this.m_activeItem ) )
        {
            var youtubeID = this.GetYoutubeId( this.m_activeItem );

            yPlayer = y_players[youtubeID]
            if(yPlayer)
                try {
                    if(yPlayer.getPlayerState()== YT.PlayerState.PLAYING || yPlayer.getPlayerState()== YT.PlayerState.BUFFERING)
                        yPlayer.pauseVideo()


                    var flVolume = yPlayer.getVolume();

                    SetGameHighlightPlayerVolume(flVolume);
                    SetGameHighlightAudioEnabled( !yPlayer.isMuted() )
                } catch(e) {}

            this.m_activeItem.hide();
        } else
        {
            //(cross) fade screenshots
            this.m_activeItem.stop();

            if ( bSkipAnimation )
                this.m_activeItem.hide();
            else
                this.m_activeItem.fadeOut( 400 );
        }
    }

    if ( this.BIsMovie( $Elem ) || this.BIsYoutube($Elem))
    {
        $Elem.show();
        this.bScreenshotsOnly = false;
    }
    else
    {
        $Elem.stop();

        if ( bSkipAnimation )
            $Elem.show();
        else
            $Elem.fadeTo( 400, 1.0 );
    }

    this.m_activeItem = $Elem;
}

HighlightPlayer.prototype.HighlightStripItem = function( elem, bSkipAnimation )
{
    var $Elem = $JFromIDOrElement(elem);
    if ( $Elem.length == 0 )
    {
        return;
    }
    $Elem.siblings().removeClass( 'focus' );
    $Elem.addClass( 'focus' );

    //
    var nStripWidth = this.m_elemStrip.width();
    var nTotalStripWidth = this.m_elemStripScroll.width();
    var nScrollOffset = this.m_elemStripScroll.position().left;

    var nThumbRightEdge = $Elem.position().left + $Elem.width()  + 2;
    var nThumbLeftEdge = $Elem.position().left;

    var nTargetScrollOffset = null;
    var bNeedScroll = false;

    if ( nThumbRightEdge + nScrollOffset > nStripWidth )
    {
        bNeedScroll = true;
        nTargetScrollOffset = nThumbLeftEdge;
    }
    else if ( nThumbLeftEdge < -nScrollOffset )
    {
        bNeedScroll = true;
        // if we're scrolling to the left, try to scroll all the way
        //   back to the start if that will work, otherwise scroll such
        //   that the left edge is in view
        if ( nThumbRightEdge < nStripWidth )
            nTargetScrollOffset = 0;
        else
            nTargetScrollOffset = Math.max( 0, nThumbLeftEdge );
    }

    this.m_elemSelector.css( 'left', nThumbLeftEdge + 'px' );
    nTargetScrollOffset = Math.min( nTargetScrollOffset, nTotalStripWidth - nStripWidth );

    if ( bNeedScroll && this.slider )
    {
        this.m_elemStripScroll.stop();
        this.m_elemStripScroll.animate( {left: (-nTargetScrollOffset) + 'px'}, bSkipAnimation ? 0 : 500 );
        this.slider.SetValue( nTargetScrollOffset, bSkipAnimation ? 0 : 500 );
    }
}

HighlightPlayer.prototype.BIsMovie = function ( $Elem )
{
    return $Elem.hasClass( 'highlight_movie' ) || $Elem.hasClass( 'highlight_strip_movie' );
}

HighlightPlayer.prototype.BIsYoutube = function ( $Elem )
{
    return $Elem.hasClass( 'highlight_youtube' ) || $Elem.hasClass( 'highlight_strip_youtube' );
}

HighlightPlayer.prototype.BIsScreenshot = function ( $Elem )
{
    return $Elem.hasClass( 'highlight_screenshot' ) || $Elem.hasClass( 'highlight_strip_screenshot' );
}

HighlightPlayer.prototype.GetMovieId = function( $Elem )
{
    return $Elem.attr( 'id' ).replace( /(highlight|thumb)_movie_/, '' );
}

HighlightPlayer.prototype.GetYoutubeId = function( $Elem )
{
    return $Elem.attr( 'id' ).replace( /(highlight|thumb)_youtube_/, '' );
}

HighlightPlayer.prototype.GetScreenshotId = function( $Elem )
{
    return $Elem.attr( 'id' ).replace( /(highlight|thumb)_screenshot_/, '' );
}

HighlightPlayer.prototype.Transition = function( bUserAction )
{
    var isFullscreen = document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen;

    if( isFullscreen || this.m_bScreenshotModalActive )
        return;

    var className = '.highlight_player_item';
    if ( this.bScreenshotsOnly && !bUserAction )
        className = '.highlight_screenshot';

    var $NextItem = this.m_activeItem.next( className );
    if ( !$NextItem.length )
    {
        $NextItem = this.m_elemPlayerArea.find( className ).first();
    }
    if ( $NextItem.length )
    {
        this.HighlightItem( $NextItem );
    }
}

HighlightPlayer.prototype.TransitionBack = function( bUserAction )
{
    var className = '.highlight_player_item';
    if ( this.bScreenshotsOnly && !bUserAction )
        className = '.highlight_screenshot';

    var $NextItem = this.m_activeItem.prev( className );
    if ( !$NextItem.length )
    {
        $NextItem = this.m_elemPlayerArea.find( className).last();
    }
    if ( $NextItem.length )
    {
        this.HighlightItem( $NextItem );
    }
}

HighlightPlayer.prototype.StartTimer = function()
{
    this.ClearInterval();
    this.interval = window.setTimeout( $J.proxy( this.Transition, this ), 5000 );
}

HighlightPlayer.prototype.ClearInterval = function()
{
    if ( this.interval )
    {
        window.clearInterval( this.interval );
        this.interval = false;
    }
}

HighlightPlayer.prototype.SliderOnChange = function( value, bInDrag )
{
    this.m_elemStripScroll.css( 'left', -value + 'px' );
}

HighlightPlayer.prototype.StopCycle = function()
{
    this.ClearInterval();
}

HighlightPlayer.prototype.StartCycle = function()
{
    if ( !this.BIsMovie( this.m_activeItem ) &&  !this.BIsYoutube( this.m_activeItem ))
        this.StartTimer();
}

HighlightPlayer.prototype.OnMovieComplete = function( movieItem )
{
    if ( this.m_activeItem.is( movieItem ) )
    {
        var movieid = this.GetMovieId( this.m_activeItem );
        this.Transition();

        if ( this.m_bVideoOnlyMode || BIsUserGameHighlightAudioEnabled() )
        {
            this.RecordView( movieid );
        }
    }
}

HighlightPlayer.prototype.OnWebPanelHidden = function()
{
    this.StopCycle();
    if ( this.m_activeItem && this.BIsMovie( this.m_activeItem ) )
    {
        var id = this.GetMovieId( this.m_activeItem );
        var $Movie = $JFromIDOrElement('movie_' + id);
        if(this.m_bUseHTMLPlayer)
            $Movie.trigger( 'pause' );
        else
            $Movie.trigger( 'callPauseVideo' );
    }
}

HighlightPlayer.prototype.OnWebPanelShown = function()
{
    this.StartCycle();
}

HighlightPlayer.prototype.mouseOver = function( event )
{
    this.StopCycle();
}

HighlightPlayer.prototype.mouseOut = function( event )
{
    var reltarget = $J( event.relatedTarget );
    if ( reltarget.length && $J.contains( this.m_elemContainer[0], reltarget[0] ) )
        return;

    this.StartCycle();
};

HighlightPlayer.prototype.RecordView = function( movieid )
{
    if ( typeof g_AccountID != 'undefined' && g_AccountID )
    {
        $J.get( 'http://store.steampowered.com/videoview/' + movieid + '/' );
    }
};

HighlightPlayer.prototype.OnScreenshotClick = function( event, element )
{
    if ( !this.m_bScreenshotModalActive )
    {
        var $Link = $J(element);
        var screenshotid = $Link.data('screenshotid');
        this.ShowScreenshotPopup( screenshotid );
    }

    event.preventDefault();
};

HighlightPlayer.prototype.ShowScreenshotPopup = function( screenshotid )
{
    var rgScreenshotIDs = [];
    for( var id in this.m_rgScreenshotURLs )
    {
        rgScreenshotIDs.push( id );
    }
    var iCurIndex = -1;
    for ( var i=0; i < rgScreenshotIDs.length; i++ )
    {
        if ( rgScreenshotIDs[i] == screenshotid )
        {
            iCurIndex = i;
            break;
        }
    }

    if ( iCurIndex == -1 )
        return;

    this.m_bScreenshotModalActive = true;

    var $Modal = $J('<div/>', {'class': 'screenshot_popup_modal' } );

    var $Title = $J('<a/>' );
    if ( Steam.BIsUserInSteamClient() )
        $Title.text( 'View full-size version in browser' );
    else
        $Title.text( 'Download full-size version' );
    $Title.append( ' ', $J('<img/>', {src: 'http://store.akamai.steamstatic.com/public/images/v5/ico_external_link.gif' } ) );

    var $TitleCtn = $J('<div/>', {'class': 'screenshot_popup_modal_title'} ).append( $Title );

    var $Img = $J('<img/>', {'src': this.GetScreenshotURL( screenshotid, '600x338' ) } );
    var $ImgPreload = $J('<img/>', {'src': 'http://store.akamai.steamstatic.com/public/images/blank.gif', 'style': 'display: none;' } );
    var $ImgCtn = $J('<div/>', {'class': 'screenshot_img_ctn'}).append( $Img, $ImgPreload );

    var $Footer =  $J('<div/>', {'class': 'screenshot_popup_modal_footer' } );
    var $ScreenshotCount = $J('<div/>');
    $Footer.append( $ScreenshotCount );

    var $BtnPrev = $J('<div/>', {'class': 'btnv6_blue_hoverfade btn_medium previous'}).append( $J('<span/>').text( 'Prev' ) );
    var $BtnNext = $J('<div/>', {'class': 'btnv6_blue_hoverfade btn_medium next'}).append( $J('<span/>').text( 'Next' ) );

    $Footer.append( $ScreenshotCount, $BtnPrev, $BtnNext );


    $Modal.append( $J('<div/>', {'class': 'screenshot_popup_modal_content'} ).append(
        $TitleCtn,
        $ImgCtn,
        $Footer
    ));

    var Modal = new CModal( $Modal );
    Modal.SetRemoveContentOnDismissal( true );
    var bModalShown = false;

    // if loading the 1920x1080 screenshot takes a while, show the popup earlier with a smaller screenshot
    //	so that the user knows we've responded to their input
    window.setTimeout( function() {
        if ( !bModalShown )
        {
            Modal.Show();
            bModalShown = true;
        }
    }, 75 );

    $Img.load( function() {
        $ImgCtn.css( 'min-width', '' );
        $ImgCtn.css( 'min-height', '' );
        $Img.stop();
        $Img.fadeTo( 'fast', 1.0 );
        if ( !bModalShown )
        {
            Modal.Show();
            bModalShown = true;
        }
        Modal.AdjustSizing();

        if ( iCurIndex + 1 < rgScreenshotIDs.length )
            $ImgPreload.attr( 'src', GameHighlightPlayer.GetScreenshotURL( rgScreenshotIDs[iCurIndex+1], '1920x1080' ) );
    } );

    var GameHighlightPlayer = this;
    var fnUpdateFooter = function()
    {
        if ( iCurIndex > 0 )
            $BtnPrev.show();
        else
            $BtnPrev.hide();

        if ( iCurIndex < rgScreenshotIDs.length - 1 )
            $BtnNext.show();
        else
            $BtnNext.hide();

        $ScreenshotCount.text( '%1$s of %2$s screenshots'.replace( /%1\$s/, iCurIndex + 1 ).replace( /%2\$s/, rgScreenshotIDs.length ) );
    };
    var fnShowScreenshot = function( screenshotid )
    {
        var strFullURL = GameHighlightPlayer.GetScreenshotURL( screenshotid );
        $Title.attr('href', strFullURL );
        Steam.LinkInNewWindow( $Title );

        $ImgCtn.css( 'min-width', $ImgCtn.width() );
        $ImgCtn.css( 'min-height', $ImgCtn.height() );
        $Img.stop();
        $Img.fadeTo( 'fast', 0.3 );
        $Img.attr( 'src', GameHighlightPlayer.GetScreenshotURL( screenshotid, '1920x1080' ) );
    };
    var fnNextScreenshot = function() {
        if ( iCurIndex < rgScreenshotIDs.length - 1 )
        {
            iCurIndex++;
            fnShowScreenshot( rgScreenshotIDs[iCurIndex] );
            fnUpdateFooter();
        }
    };
    var fnPrevScreenshot = function() {
        if ( iCurIndex > 0 )
        {
            iCurIndex--;
            fnShowScreenshot( rgScreenshotIDs[iCurIndex] );
            fnUpdateFooter();
        }
    };
    $BtnNext.click( fnNextScreenshot );
    $BtnPrev.click( fnPrevScreenshot );
    $Img.click( fnNextScreenshot );

    $J(document).on('keydown.GameHighlightScreenshots', function( event ) {
        if ( event.which == 37 /* left */ || event.which == 38 /* up */ )
        {
            fnPrevScreenshot();
            event.preventDefault();
        }
        else if ( event.which == 39 /* right */ || event.which == 40 /* down */ || event.which == 32 /* spacebar */ )
        {
            fnNextScreenshot();
            event.preventDefault();
        }
    });

    Modal.OnResize( function( nMaxWidth, nMaxHeight ) {
        $Img.css( 'max-width', nMaxWidth );
        $Img.css( 'max-height', nMaxHeight - 74 );
    } );

    Modal.OnDismiss( function() {
        GameHighlightPlayer.HighlightScreenshot( rgScreenshotIDs[iCurIndex], true );
        GameHighlightPlayer.m_bScreenshotModalActive = false;
        $J(document).off('keydown.GameHighlightScreenshots');
    } );

    fnShowScreenshot( screenshotid );
    fnUpdateFooter();
};

(function( $ ){
    var settings = {};


    $.fn.videoControls = function( options ) {

        settings = $.extend( {
            'trailer': false
        }, options);

        var overlaySrc = '<div class="html5_video_overlay">' +
            '<div class="play_button play"></div>' +
            '<div class="control_container">' +
            '<div class="fullscreen_button"></div>' +
            '<div class="time"></div>' +
            '<div class="volume_icon"></div>' +
            '<div class="volume_slider">' +
            '<div class="volume_handle"></div>' +
            '</div>' +
            '<div class="autoplay_checkbox"></div>' +
            '<div class="autoplay_label">Autoplay videos</div>' +
            '<div class="hd_checkbox"></div>' +
            '<div class="hd_label">HD</div>' +
            '</div>' +
            '<div class="progress_bar_wrapper">' +
            '<div class="progress_bar_container">' +
            '<div class="progress_bar_background"></div>' +
            '<div class="progress_bar"></div>' +
            '</div>' +
            '</div>' +
            '</div>';


        return this.each(function() {

            var wrapper = this.parentNode;
            var video = $(this); // jQuery wrapped version.
            var videoControl = this;
            var mouseoutEvent = false;
            var length = 0;
            var bIsFullscreen = false;
            var bIsHD = false;

            var bIsDraggingVolume = false;

            if ( $(wrapper).css('position') == 'static' )
                $(wrapper).css({'position': 'relative'});
            var overlay = $(overlaySrc);
            $(wrapper).append(overlay);

            function setup()
            {
                video.bind({
                    'mouseenter': function() { show(); clearTimeout(mouseoutEvent); },
                    'mouseleave': function(event) {
                        var relTarget = (event.relatedTarget) ? event.relatedTarget : event.toElement;
                        if ( overlay.get(0) == relTarget || $.contains( overlay.get(0),  relTarget  ) )
                            return;

                        hide();
                    },
                    'timeupdate': function() { timeUpdate(); },
                    'playing': function() { eventPlay(); },
                    'click': function() { playPause(); }
                });
                overlay.bind({
                    'mouseleave': function(event) {
                        var relTarget = (event.relatedTarget) ? event.relatedTarget : event.toElement;
                        if ( videoControl == relTarget )
                            return;
                        hide();
                    },
                    'mouseenter': function() { clearTimeout(mouseoutEvent); }
                });
                $('.play_button',overlay).bind('click', function() { playPause(); });
                $('.volume_slider',overlay).bind('click', function(e) { volumeClick(e, this); });
                $('.volume_slider',overlay).bind('mousedown', function(e) { volumeStartDrag(e, this); });
                $('.volume_slider',overlay).bind('mouseup', function(e) { volumeStopDrag(e, this); });
                $('.volume_slider',overlay).bind('mouseleave', function(e) { volumeStopDrag(e, this); });

                $('.volume_icon',overlay).bind('click', function(e) { toggleMute(e, this); });
                $('.autoplay_checkbox',overlay).bind('click', function(e) { toggleAutoplay(); });
                $('.hd_checkbox',overlay).bind('click', function(e) { toggleHD(); });
                $('.fullscreen_button',overlay).bind('click', function(e) { toggleFullscreen(); });
                $('.progress_bar_container',overlay).bind('click', function(e) { progressClick(e, this); });

                updateVolume();
            }

            // Overlay visibility

            function show()
            {
                // TODO: Cool slidey animation would give us parity with flash except chrome barfs hard. re-enable when
                // chrome learns how to animate stuff in <video> properly.
                overlay.stop().animate({'bottom': '0px'}, 200);
                //overlay.show();
                var maxWidth = $('.progress_bar_container', overlay).width();
                var progress = maxWidth * ( videoControl.currentTime / videoControl.duration);

                var nEnd = 0;
                for(var i=0; i<videoControl.buffered.length; i++)
                    nEnd = videoControl.buffered.end(i) > nEnd ? videoControl.buffered.end(i) : nEnd;

                var loaded = maxWidth * ( nEnd  / videoControl.duration);

                $('.progress_bar', overlay).stop().css({'width': progress + 'px'}, 200);
                $('.progress_bar_background', overlay).stop().css({'width': loaded + 'px'}, 200);

                var timeString = SecondsToTime(videoControl.currentTime) + " / " + SecondsToTime(videoControl.duration);

                $('.time', overlay).text(timeString);
            }

            function hide()
            {
                clearTimeout(mouseoutEvent);
                mouseoutEvent = setTimeout( function(){
                    overlay.stop().animate({'bottom': '-35px'}, 200);
                    $('.volume_slider',overlay).unbind('mousemove');
                }, 1000 );
                // TODO: Cool slidey animation would give us parity with flash except chrome barfs hard. re-enable when
                // chrome learns how to animate stuff in <video> properly.

                //overlay.hide();
            }

            // We need to call this every time we start playback so changes between tabs and instances are always in sync.
            function updateVolume()
            {
                if( settings.trailer )
                {
                    videoControl.muted = false;
                    setVolume( GetGameHighlightPlayerVolume() / 100);
                }
                else
                {
                    setVolume( GetGameHighlightPlayerVolume() / 100);

                    if( !BIsUserGameHighlightAudioEnabled() )
                    {
                        videoControl.muted = true;
                        $('.volume_icon',overlay).addClass('muted');
                        $('.volume_handle', overlay).css({'left': "0"});
                    }
                    else
                    {
                        videoControl.muted = false;
                        $('.volume_icon',overlay).removeClass('muted');
                    }

                    if( BIsUserGameHighlightAutoplayEnabled() )
                    {
                        $('.autoplay_checkbox',overlay).addClass("checked");
                    }
                }
            }


            // HTML5 callbacks

            function timeUpdate(e)
            {
                var maxWidth = $('.progress_bar_container', overlay).width();
                var progress = maxWidth * ( videoControl.currentTime / videoControl.duration);

                var nEnd = 0;
                for(var i=0; i<videoControl.buffered.length; i++)
                    nEnd = videoControl.buffered.end(i) > nEnd ? videoControl.buffered.end(i) : nEnd;

                var loaded = maxWidth * (  nEnd / videoControl.duration);

                $('.progress_bar', overlay).stop().animate({'width': progress + 'px'}, 200);
                $('.progress_bar_background', overlay).stop().animate({'width': loaded + 'px'}, 200);

                var timeString = SecondsToTime(videoControl.currentTime) + " / " + SecondsToTime(videoControl.duration);

                $('.time', overlay).text(timeString);
            }

            function eventPlay()
            {
                $('.play_button',overlay).removeClass('play');
                $('.play_button',overlay).addClass('pause');

                if( BIsUserGameHDEnabled() )
                {
                    $('.hd_checkbox',overlay).addClass("checked");
                }

                updateVolume();
            }

            // Control functions
            function playPause()
            {
                if( videoControl.paused )
                {
                    videoControl.play();
                } else {
                    videoControl.pause();
                    $('.play_button',overlay).addClass('play');
                    $('.play_button',overlay).removeClass('pause');
                }
            }

            function volumeClick(e, ele)
            {
                var parentOffset = $(ele).offset();
                var relX = e.pageX - parentOffset.left;
                var volume =  relX / 80 ;

                setVolume(volume);
                SetGameHighlightPlayerVolume(100 * volume);

                if( videoControl.muted )
                    toggleMute();
            }

            function setVolume( volume )
            {
                volume = Math.min(Math.max(volume, 0), 100);
                videoControl.volume = volume;
                var sliderX = volume * 80 - 2;
                $('.volume_handle', overlay).css({'left': sliderX + "px"});
            }

            function volumeStartDrag(e, ele)
            {
                $('.volume_slider',overlay).bind('mousemove', function(e) { volumeClick(e, this); });
                e.originalEvent.preventDefault();
                SetGameHighlightAudioEnabled( true );
            }

            function volumeStopDrag(e, ele)
            {
                $('.volume_slider',overlay).unbind('mousemove');
            }

            function toggleMute(e, ele )
            {
                videoControl.muted = !videoControl.muted;
                SetGameHighlightAudioEnabled( !videoControl.muted );

                if( videoControl.muted )
                {
                    $('.volume_icon',overlay).addClass('muted');
                    $('.volume_handle', overlay).css({'left': "0px"});
                } else {
                    $('.volume_icon',overlay).removeClass('muted');
                    setVolume( GetGameHighlightPlayerVolume() / 100);
                }
            }

            function progressClick( e, ele )
            {
                var parentOffset = $(ele).offset();
                var barWidth = $(ele).innerWidth();
                var relX = e.pageX - parentOffset.left;
                var percent =  relX / barWidth;

                videoControl.currentTime = percent * videoControl.duration;
            }

            function toggleFullscreen()
            {
                var eleContainer = videoControl.parentNode;
                var isFullscreen = document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen;

                if( !isFullscreen )
                {
                    if( eleContainer.requestFullscreen )
                        eleContainer.requestFullscreen();
                    else if( eleContainer.webkitRequestFullScreen )
                        eleContainer.webkitRequestFullScreen();
                    else if( eleContainer.mozRequestFullScreen )
                        eleContainer.mozRequestFullScreen();
                } else {
                    if( document.cancelFullscreen )
                        document.cancelFullscreen();
                    else if( document.webkitCancelFullScreen )
                        document.webkitCancelFullScreen();
                    else if( document.mozCancelFullScreen )
                        document.mozCancelFullScreen();
                }
            }

            function toggleAutoplay()
            {
                var bAutoplay = !BIsUserGameHighlightAutoplayEnabled();
                SetGameHighlightAutoplayEnabled( bAutoplay );

                if( bAutoplay )
                    $('.autoplay_checkbox',overlay).addClass("checked");
                else
                    $('.autoplay_checkbox',overlay).removeClass("checked");
            }

            function toggleHD()
            {
                var bIsHD = !BIsUserGameHDEnabled();

                SetGameHDEnabled( bIsHD );

                if( bIsHD )
                    $('.hd_checkbox',overlay).addClass("checked");
                else
                    $('.hd_checkbox',overlay).removeClass("checked");


                var videoPosition = videoControl.currentTime;
                videoControl.pause();
                videoControl.preload = "metadata";

                $(videoControl).bind('loadedmetadata', function() {
                    console.log("loadedmetadata");
                    this.currentTime = videoPosition;
                    videoControl.play();
                    $(videoControl).unbind('loadedmetadata')
                });
                if( bIsHD )
                {
                    // Switch to HD video
                    videoControl.setAttribute('data-default-src', videoControl.src);
                    videoControl.src = $(videoControl).data('hd-src');
                    videoControl.load();
                }
                else
                {
                    // Switch back from HD video
                    videoControl.src = $(videoControl).data('default-src');
                    videoControl.load();
                }

            }

            setup();
            hide();
        });

    };

})( jQuery );

function SecondsToTime( seconds )
{

    var hours = Math.floor(seconds / (60 * 60) );
    var minutes = Math.floor(seconds / 60 ) % 59;
    var seconds = Math.floor( seconds ) % 59;
    if( seconds < 10 )
        seconds = "0" + seconds;
    var out = (hours > 0 ) ? hours + ":" : "";
    return out + minutes + ":" + seconds;
}

function BDoesUserPreferHTML5()
{
    var rgMatches = document.cookie.match( /(^|; )bShouldUseHTML5=([^;]*)/ );
    return ( rgMatches && rgMatches[2] == 1 );
}

function BCanPlayWebm()
{
    var ele = document.createElement('video');

    return ele.canPlayType('video/webm; codecs="vp8, vorbis"') == "probably"; // Eh, I dunno, probably.

}

function SetUserPrefersHTML5( bEnabled )
{
    var dateExpires = new Date();
    dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * 365 * 10 );
    document.cookie = 'bShouldUseHTML5=' + bEnabled + '; expires=' + dateExpires.toGMTString() + ';path=/';
}

