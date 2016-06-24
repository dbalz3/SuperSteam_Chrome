(function () {
  "use strict";

  var $ = require('jquery');
  var superSteamAsset = require('supersteam-asset');
  var localStorageHelpers = require('local-storage-helpers');

  define('early-access', function () {
    return {
      load: function () {
        var deferred = new $.Deferred();
        if (window.location.protocol != "https:") {
          // is the data cached?
          var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
          var last_updated = expire_time - 1;

          if (last_updated < expire_time) {
            // if no cache exists, pull the data from the website
            superSteamAsset.get("https://steamwatcher.com/boiler/earlyaccess/ea.php", function(data) {
              localStorageHelpers.setValue("ea_appids", data);
              localStorageHelpers.setValue("ea_appids_time", parseInt(Date.now() / 1000, 10));
              deferred.resolve(data);
            });
          } else {
            deferred.resolve(localStorageHelpers.getValue("ea_appids"));
          }

          return deferred.promise();
        } else {
          deferred.resolve();
          return deferred.promise();
        }
      },
    }
  })
})();
