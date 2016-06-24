chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
        console.log("This is a first install!");
    }else if(details.reason == "update"){
        var thisVersion = chrome.runtime.getManifest().version;
        console.log("Updated from " + details.previousVersion + " to " + thisVersion + "!");
    }
});

//Redirect from Valve's version of gamehighlightplayer.js to our stub file. We need this to prevent errors.
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        console.log('this ran');
        if( details.url.indexOf("gamehighlightplayer.js")>-1){
            return {redirectUrl: "chrome-extension://"+chrome.runtime.id+"/js/gamehighlightplayer_stub.js" };
        }

    },
    {urls: ["*://*.steamstatic.com/*"]},
    ["blocking"]);




