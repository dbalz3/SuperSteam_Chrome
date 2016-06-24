(function () {
  var $ = require('jquery');

  define('user-prefs-utils', function () {

    function getDefaultsAsync() {
      var def = $.Deferred();
      var defaultPrefsUri = chrome.extension.getURL("/data/defaultPrefs.json");
      $.ajax({
        url: defaultPrefsUri,
        dataType: "json",
      })
      .done((result) => {
        def.resolve(result)
      })
      .fail((result) => {
        throw new Error(result);
      });

      return def.promise();
    }

    function getSavedAsync() {
      console.log("requesting saved preferences");
      var deferred = $.Deferred();
      chrome.storage.local.get("userPrefs", (result) => {
        deferred.resolve(result);
      });
      return deferred.promise();
    }

    var _prefsUtils = {
      getAsync: function () {
        var def = $.Deferred();
        $.when(getSavedAsync(), getDefaultsAsync())
        .done((savedResult, defaultsResult) => {
          // if savedResult has properties
          if (Object.getOwnPropertyNames(savedResult).length !== 0) {
            // return saved prefs:
            def.resolve(savedResult.userPrefs);
          }
          else {
            // save defaults and return those:
            _prefsUtils.saveAsync(defaultsResult)
            .done(() => {
              def.resolve(defaultsResult)
            })
            .fail((res) => {
              throw new Error(res)
            });
          }
        });
        return def.promise();
      },
      saveAsync: function (prefs) {
        var def = $.Deferred();
        chrome.storage.local.set({userPrefs: prefs}, (result) => {
          def.resolve([result, "success", def.promise()]);
        });
        return def.promise();
      },
    };

    return _prefsUtils;
  });

})();
