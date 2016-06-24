(function(){
    define("load-script-inline", function(){
        var _loadScript = {
            load: function (src) {
                var deferred = new $.Deferred();
                var script = document.createElement('script');
                script.onload = script.onreadystatechange = function (e) {
                    this.parentNode.removeChild(this);
                    deferred.resolve(e);
                };
                script.onerror = function (e) {
                        deferred.reject(e);
                };

                //This is to catch for a single case where we are loading a string variable (ie var foo = '...') JSON
                //array of youtube urls instead of a js file local to the whole project
                //never do this again if you can help it
                if(src.indexOf('var') > -1){
                    script.textContent = src;
                } else {
                    script.src = chrome.extension.getURL(src);
                }

                (document.head || document.documentElement).appendChild(script);
                return deferred.promise();
            }
        }
        return _loadScript;
    });

})();