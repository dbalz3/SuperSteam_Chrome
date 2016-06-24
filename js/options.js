(function () {
  "use strict";

  var $ = require('jquery');
  var userPrefs = require('user-prefs-utils');

  var setUserPrefsInUi = function (prefs) {
    $("input[name='highlight-owned-games']")
      .prop("checked", prefs.highlightOwnedGames);
    $("input[name='owned-games-color']")
      .prop("value", prefs.ownedGamesColor);
    $("input[name='highlight-wishlist-games']")
      .prop("checked", prefs.highlightWishlistGames);
    $("input[name='wishlist-games-color']")
      .prop("value", prefs.wishlistGamesColor);
    $("input[name='show-price-history']")
      .prop("checked", prefs.showPriceHistory);
    $("input[name='hide-steam-install-button']")
      .prop("checked", prefs.hideInstallSteamButton);
    $("input[name='hide-about-menu']")
      .prop("checked", prefs.hideAboutMenu);
    $("input[name='show-3rd-party-drm-warnings']")
      .prop("checked", prefs.show3rdPartyDrmWarnings);
    $("input[name='show-x-origin-trading-prohibited']")
      .prop("checked", prefs.showXOriginTradingProhibited);
    $("input[name='show-metacritic-scores']")
      .prop("checked", prefs.showMetaCriticScores);
    $("input[name='show-steamdb-links']")
      .prop("checked", prefs.showSteamDbLinks);
    $("input[name='show-widescreen-info']")
      .prop("checked", prefs.showWidescreenInfo);
    $("input[name='show-howlongtobeat-info']")
      .prop("checked", prefs.showHowLongToBeatInfo);
    $("input[name='show-steamcharts-info']")
      .prop("checked", prefs.showSteamChartsInfo);
    $("input[name='show-pcgamingwiki-links']")
      .prop("checked", prefs.showPcGamingWikiLinks);
    $("input[name='show-astats-links']")
      .prop("checked", prefs.showAStatsLinks);
    $("input[name='enable-search-infinite-scroll']")
      .prop("checked", prefs.enableSearchResultsInfinteScroll);
    $("input[name='show-app-description']")
      .prop("checked", prefs.showAppDescription);
    $("input[name='show-total-spent']")
      .prop("checked", prefs.showTotalSpent);
    $("input[name='replace-steam-greenlight-banner']")
      .prop("checked", prefs.replaceSteamGreenlightBanner);
    $("input[name='show-external-profile-links']")
      .prop("checked", prefs.showExternalProfileLinks);
    $("input[name='show-steamrep-status']")
      .prop("checked", prefs.showSteamRepStatus);
    $("input[name='show-compare-links']")
      .prop("checked", prefs.showCompareLinks);
    $("input[name='show-transaction-summary']")
      .prop("checked", prefs.showTransactionSummary);
    $("input[name='show-all-achievements']")
      .prop("checked", prefs.showAllAchievements);
    $("input[name='show-regional-price-comparisons']")
      .prop("checked", prefs.showRegionalPriceComparisons);
    $("input[name='show-youtube-video']")
        .prop("checked", prefs.showYoutubeVideo);
    $("#country-list-1").val(prefs.region1);
    $("#country-list-2").val(prefs.region2);
    $("#country-list-3").val(prefs.region3);
    $("#country-list-4").val(prefs.region4);
    $("#country-list-5").val(prefs.region5);
    $("#country-list-6").val(prefs.region6);
    $("#country-list-7").val(prefs.region7);
    $("#country-list-8").val(prefs.region8);
    $("#country-list-9").val(prefs.region9);
    $("input[name='show-steamspy-info']").prop("checked", prefs.showSteamSpyInfo);
  };

  var getUserPrefsFromUi = function () {
    return {
      highlightOwnedGames: $("input[name='highlight-owned-games']").prop("checked"),
      ownedGamesColor: $("input[name='owned-games-color']").prop("value"),
      highlightWishlistGames: $("input[name='highlight-wishlist-games']").prop("checked"),
      wishlistGamesColor: $("input[name='wishlist-games-color']").prop("value"),
      showPriceHistory: $("input[name='show-price-history']").prop("checked"),
      hideInstallSteamButton: $("input[name='hide-steam-install-button']").prop("checked"),
      hideAboutMenu: $("input[name='hide-about-menu']").prop("checked"),
      show3rdPartyDrmWarnings: $("input[name='show-3rd-party-drm-warnings']").prop("checked"),
      showXOriginTradingProhibited: $("input[name='show-x-origin-trading-prohibited']").prop("checked"),
      showMetaCriticScores: $("input[name='show-metacritic-scores']").prop("checked"),
      showSteamDbLinks: $("input[name='show-steamdb-links']").prop("checked"),
      showWidescreenInfo: $("input[name='show-widescreen-info']").prop("checked"),
      showHowLongToBeatInfo: $("input[name='show-howlongtobeat-info']").prop("checked"),
      showSteamChartsInfo: $("input[name='show-steamcharts-info']").prop("checked"),
      showPcGamingWikiLinks: $("input[name='show-pcgamingwiki-links']").prop("checked"),
      showAStatsLinks: $("input[name='show-astats-links']").prop("checked"),
      enableSearchResultsInfinteScroll: $("input[name='enable-search-infinite-scroll']").prop("checked"),
      showAppDescription: $("input[name='show-app-description']").prop("checked"),
      showTotalSpent: $("input[name='show-total-spent']").prop("checked"),
      replaceSteamGreenlightBanner: $("input[name='replace-steam-greenlight-banner']").prop("checked"),
      showExternalProfileLinks: $("input[name='show-external-profile-links']").prop("checked"),
      showSteamRepStatus: $("input[name='show-steamrep-status']").prop("checked"),
      showCompareLinks: $("input[name='show-compare-links']").prop("checked"),
      showTransactionSummary: $("input[name='show-transaction-summary']").prop("checked"),
      showAllAchievements: $("input[name='show-all-achievements']").prop("checked"),
      showSteamSpyInfo: $("input[name='show-steamspy-info']").prop("checked"),
      showRegionalPriceComparisons: $("input[name='show-regional-price-comparisons']").prop("checked"),
      showYoutubeVideo: $("input[name='show-youtube-video']").prop("checked"),
      region1: $("#country-list-1 option:selected").val(),
      region2: $("#country-list-2 option:selected").val(),
      region3: $("#country-list-3 option:selected").val(),
      region4: $("#country-list-4 option:selected").val(),
      region5: $("#country-list-5 option:selected").val(),
      region6: $("#country-list-6 option:selected").val(),
      region7: $("#country-list-7 option:selected").val(),
      region8: $("#country-list-8 option:selected").val(),
      region9: $("#country-list-9 option:selected").val()
    };
  };

  var init = function () {
    console.log("Initializing...");


    $.when(
      userPrefs.getAsync()
    )
    .done((userPrefsResult) => {

      setUserPrefsInUi(userPrefsResult);

      $("ul.options").on("change", () => {
        userPrefs.saveAsync(getUserPrefsFromUi())
          .done((r) => console.log("preferences saved: ", r));
      });
    });
  };

  init();
})();
