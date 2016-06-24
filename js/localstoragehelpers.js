// Chrome storage functions
(function () {
  define("local-storage-helpers", function () {
    return {
      setValue: function (key, value) {
        localStorage.setItem(key, JSON.stringify(value));
      },
      getValue: function (key) {
        var v = localStorage.getItem(key);
        if (v === undefined) return v;
        return JSON.parse(v);
      },
      delValue: function (key) {
        localStorage.removeItem(key);
      },
    };
  });
})();
