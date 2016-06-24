(function () {

  var superSteamAsset = require('supersteam-asset');
  var $ = require('jquery');
  var user_currency;
  var currencyFormatInfo = {
    "BRL": { places: 2, hidePlacesWhenZero: false, symbolFormat: "R$ ", thousand: ".", decimal: ",", right: false },
    "EUR": { places: 2, hidePlacesWhenZero: false, symbolFormat: "€", thousand: " ", decimal: ",", right: true },
    "GBP": { places: 2, hidePlacesWhenZero: false, symbolFormat: "£", thousand: ",", decimal: ".", right: false },
    "RUB": { places: 2, hidePlacesWhenZero: true,  symbolFormat: " pуб.", thousand: "", decimal: ",", right: true },
    "JPY": { places: 0, hidePlacesWhenZero: false, symbolFormat: "¥ ", thousand: ",", decimal: ".", right: false },
    "MYR": { places: 2, hidePlacesWhenZero: false, symbolFormat: "RM", thousand: ",", decimal: ".", right: false },
    "NOK": { places: 2, hidePlacesWhenZero: false, symbolFormat: " kr", thousand: ".", decimal: ",", right: true },
    "IDR": { places: 0, hidePlacesWhenZero: false, symbolFormat: "Rp ", thousand: " ", decimal: ".", right: false },
    "PHP": { places: 2, hidePlacesWhenZero: false, symbolFormat: "P", thousand: ",", decimal: ".", right: false },
    "SGD": { places: 2, hidePlacesWhenZero: false, symbolFormat: "S$", thousand: ",", decimal: ".", right: false },
    "THB": { places: 2, hidePlacesWhenZero: false, symbolFormat: "฿", thousand: ",", decimal: ".", right: false },
    "VND": { places: 2, hidePlacesWhenZero: false, symbolFormat: "₫", thousand: ",", decimal: ".", right: false },
    "KRW": { places: 2, hidePlacesWhenZero: false, symbolFormat: "₩", thousand: ",", decimal: ".", right: false },
    "TRY": { places: 2, hidePlacesWhenZero: false, symbolFormat: " TL", thousand: "", decimal: ",", right: true },
    "UAH": { places: 2, hidePlacesWhenZero: false, symbolFormat: "₴", thousand: "", decimal: ",", right: true },
    "MXN": { places: 2, hidePlacesWhenZero: false, symbolFormat: "Mex$ ", thousand: ",", decimal: ".", right: false },
    "CAD": { places: 2, hidePlacesWhenZero: false, symbolFormat: "CDN$ ", thousand: ",", decimal: ".", right: false },
    "AUD": { places: 2, hidePlacesWhenZero: false, symbolFormat: "A$ ", thousand: ",", decimal: ".", right: false },
    "NZD": { places: 2, hidePlacesWhenZero: false, symbolFormat: "NZ$ ", thousand: ",", decimal: ".", right: false },
    "USD": { places: 2, hidePlacesWhenZero: false, symbolFormat: "$", thousand: ",", decimal: ".", right: false }
  };

  function formatCurrency(number, type) {
    var info = currencyFormatInfo[type || user_currency];
    if(!info){
      return;
    }
    if (info.hidePlacesWhenZero && (number % 1 === 0)) {
      info.places = 0;
    }

    var negative = number < 0 ? "-" : "",
    i = parseInt(number = Math.abs(+number || 0).toFixed(info.places), 10) + "",
    j = (j = i.length) > 3 ? j % 3 : 0,
    formatted;

    formatted = negative +
    (j ? i.substr(0, j) + info.thousand : "") +
    i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + info.thousand) +
    (info.places ? info.decimal + Math.abs(number - i).toFixed(info.places).slice(2) : "");

    if (info.right)
    formatted += info.symbolFormat;
    else
    formatted = info.symbolFormat + formatted;

    return formatted;
  }

  function parseCurrency(str) {
    var currency_symbol = currencySymbolFromString(str);
    var currency_type = currencySymbolToType(currency_symbol);
    if (user_currency && currencyFormatInfo[user_currency].symbolFormat == currencyFormatInfo[currency_type].symbolFormat) currency_type = user_currency;
    var currency_number = currencySymbolToNumber(currency_type);
    var info = currencyFormatInfo[currency_type];

    // remove thousand sep, replace decimal with dot, remove non-numeric
    str = str.replace(info.thousand, '')
    .replace(info.decimal, '.')
    .replace(/[^\d\.]/g, '')
    .trim();

    var value = parseFloat(str);

    if (isNaN(value))
    return null;

    return {
      value: value,
      currency_type: currency_type,
      currency_symbol: currency_symbol,
      currency_number: currency_number
    };
  }

  function parseCurrency1(str) {
    var currency_symbol = currencySymbolFromString(str);
    var currency_type = currencySymbolToType(currency_symbol);
    var currency_number = currencySymbolToNumber(currency_symbol);
    var info = currencyFormatInfo[currency_type];

    // remove thousand sep, replace decimal with dot, remove non-numeric
    str = str.replace(info.thousand, '')
    .replace(info.decimal, '.')
    .replace(/[^\d\.]/g, '')
    .trim();

    var value = parseFloat(str);

    if (isNaN(value))
    return null;

    return {
      value: value,
      currency_type: currency_type,
      currency_symbol: currency_symbol,
      currency_number: currency_number
    };
  }

  function currencySymbolToType (currency_symbol) {
    switch (currency_symbol) {
      case "pуб":
      return "RUB";
      case "€":
      return "EUR";
      case "£":
      return "GBP";
      case "R$":
      return "BRL";
      case "¥":
      return "JPY";
      case "kr":
      return "NOK";
      case "Rp":
      return "IDR";
      case "RM":
      return "MYR";
      case "P":
      return "PHP";
      case "S$":
      return "SGD";
      case "฿":
      return "THB";
      case "₫":
      return "VND";
      case "₩":
      return "KRW";
      case "TL":
      return "TRY";
      case "₴":
      return "UAH";
      case "Mex$":
      return "MXN";
      case "CDN$":
      return "CAD";
      case "A$":
      return "AUD";
      case "NZ$":
      return "NZD";
      default:
      return "USD";
    }
  }

  function currencySymbolToNumber (currency_symbol) {
    switch (currency_symbol) {
      case "pуб":
      return 5;
      case "€":
      return 3;
      case "£":
      return 2;
      case "R$":
      return 7;
      case "¥":
      return 8;
      case "kr":
      return 9;
      case "Rp":
      return 10;
      case "RM":
      return 11;
      case "P":
      return 12;
      case "S$":
      return 13;
      case "฿":
      return 14;
      case "₫":
      return 15;
      case "₩":
      return 16;
      case "TL":
      return 17;
      case "₴":
      return 18;
      case "Mex$":
      return 19;
      case "CDN$":
      return 20;
      case "A$":
      return 21;
      case "NZ$":
      return 22;
      default:
      return 1;
    }
  }

  function currencySymbolFromString (string_with_symbol) {
    var re = /(?:R\$|S\$|\$|RM|kr|Rp|€|¥|£|฿|pуб|P|₫|₩|TL|₴|Mex\$|CDN\$|A\$|NZ\$)/;
    var match = string_with_symbol.match(re);
    return match ? match[0] : '';
  }

  function determineUserCurrency () {
    var _currency;
    var deferred = new $.Deferred();
    var currency_cache = $.parseJSON(localStorage.getItem("user_currency"));
    var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
    if (false) {
      //if (currency_cache && currency_cache.updated >= expire_time) {
      _currency = currency_cache.currency_type;
      deferred.resolve(_currency);
    } else {
      var appid = 220;
      var ajax_url = "https://store.steampowered.com/api/appdetails/?filters=price_overview&appids="+appid;
      var cookies = document.cookie;
      var matched = cookies.match(/fakeCC=([a-z]{2})/i);
      var cc = "us";
      if (matched != null && matched.length == 2) {
        cc = matched[1];
      } else {
        matched = cookies.match(/steamCC(?:_\d+){4}=([a-z]{2})/i);
        if (matched != null && matched.length == 2) {
          cc = matched[1];
        }
      }
      if (cc) {
        ajax_url += "&cc=" + cc;
      }

      superSteamAsset.get(ajax_url)
      .done(function (data) {
        if (!data[appid].success){
          _currency = "USD";
          //save the currency as the local user_currency variable
          user_currency = _currency;
          deferred.resolve(_currency);
          return;
        }
        //save the currency as the local user_currency variable
        _currency = data[appid].data.price_overview.currency;
        user_currency = _currency;
        localStorage.setItem(
          "user_currency",
          JSON.stringify({
            currency_type: _currency,
            updated: parseInt(Date.now() / 1000, 10),
          }));
        console.log(_currency);
        deferred.resolve(_currency);
      });

    }
    return deferred.promise();
  };

  var currencyConversion = (function() {
    var deferred;
    var rates;

    function load(currency, user_currency) {
      if (deferred) return deferred.promise();
      deferred = new $.Deferred();
      rates = cache_get(currency || user_currency);
      //console.log(rates);
      console.log(currency);
      if (rates) {
        console.log(rates);
        deferred.resolveWith(rates);
      } else {
        //console.log(rates);
        var apiurl = "https://steamwatcher.com/boiler/currency/currencyreturnarray.php?fromcurrency=" + (currency || user_currency);
        superSteamAsset.get(apiurl, function(txt) {
          var jsonStringResponse = JSON.stringify(txt);
          rates = JSON.parse(jsonStringResponse);
          cache_set(currency || user_currency, rates);
          deferred.resolveWith(rates);
        }).fail(deferred.reject);
      }
      return deferred.promise();
    }

    function convert(amount, currency_from, currency_to) {
      if (rates) {
        if (rates[currency_to]) return amount / rates[currency_to][currency_from];
        if (rates[currency_from]) return amount * rates[currency_from][currency_to];
      }
    }

    function cache_set(currency, rates) {
      var expires = parseInt(Date.now() / 1000, 10) + 24 * 60 * 60; // One day from now
      var cached = {
        rates: rates[currency],
        expires: expires
      };
      localStorage.setItem("currencyConversion_" + currency, JSON.stringify(cached));
    }

    function cache_get(currency) {
      var cached = JSON.parse(localStorage.getItem("currencyConversion_" + currency));
      if (cached && cached.expires > parseInt(Date.now() / 1000, 10)) {
        var rates = {};
        rates[currency] = cached.rates;
        return rates;
      }
    }

    return {
      load: load,
      convert: convert
    };
  })();

  define('currency', function () {
    return {
      determineUserCurrency: determineUserCurrency,
      formatInfo: currencyFormatInfo,
      format: formatCurrency,
      parse: parseCurrency,
      parse1: parseCurrency1,
      symbolToType: currencySymbolToType,
      symbolToNumber: currencySymbolToNumber,
      symbolFromString: currencySymbolFromString,
      conversion: {
        load: currencyConversion.load,
        convert: currencyConversion.convert,
      },
    };
  });

})()
