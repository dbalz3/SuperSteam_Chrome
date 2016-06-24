(function () {
  var $ = require('jquery');
  var localization = require('localization');

  var totalRequests = 0;
  var processedRequests = 0;
  var language = localization.getLanguage();
  var assetUrlHash;

  define('supersteam-asset', function () {
    return {
      get: function getSuperSteamAsset(url, callback) {

        totalRequests += 1;
        $("#es_progress").attr({
          "max": 100,
          "title": language.ready.loading
        });
        $("#es_progress").removeClass("complete");

        var reqDeffered = $.ajax({
          url: url,
        })
        .done(() => {
          processedRequests += 1;
          var complete_percentage = (processedRequests / totalRequests) * 100;
          $("#es_progress").val(complete_percentage);
          if (complete_percentage == 100) {
            $("#es_progress")
              .addClass("complete")
              .attr("title", language.ready.ready);
          }
        })
        .fail(() => {
          $("#es_progress")
            .val(100)
            .addClass("error")
            .attr({
              "title":language.ready.errormsg,
              "max":1
            });
        });

        // register the stupid, antiquated callback:
        //Need to determine if this method of registering the callback prevents returning json as a string
        //pull function out of callback reference so that we can stringify the result--or just call stringify on all other
        //responses from this function
        if (callback) reqDeffered.done(callback);

        return reqDeffered.promise();
      },
      getAssetUrlHash: function getAssetUrlHash() {
        var def = $.Deferred();
        if (assetUrlHash) {
          def.resolve(assetUrlHash)
        }
        else {
          $.ajax({
            url: chrome.extension.getURL("data/assetUrls.json"),
            dataType: 'json',
          })
          .done((data) => {
            var keys = Object.keys(data);
            assetUrlHash = keys.reduce((hash, k) => {
              hash[k] = chrome.extension.getURL(data[k]);
              return hash;
            }, {});

            def.resolve(assetUrlHash);
          });
        }

        return def.promise();
      },
    };
  });
})();
