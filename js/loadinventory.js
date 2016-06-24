(function () {
    var $ = require('jquery');
    var localStorageHelpers = require('local-storage-helpers');
    var superSteamAsset = require('supersteam-asset');

    define("load-inventory", function () {

        var _saveInventoryItemsInLocalStorage = {

            getInventory: function() {
                var deferred = new $.Deferred();

                if ($(".user_avatar").length > 0) {
                    var profileurl = $(".user_avatar")[0].href || $(".user_avatar a")[0].href;
                } else {
                    deferred.reject();
                    return deferred.promise();
                }

                var gift_deferred = new $.Deferred();
                var coupon_deferred = new $.Deferred();
                var card_deferred = new $.Deferred();

                var delValue = function (key) {
                    localStorage.removeItem(key);
                }

                var get_appid = function (t) {
                    if (t && t.match(/(?:store\.steampowered|steamcommunity)\.com\/app\/(\d+)\/?/)) return RegExp.$1;
                    else return null;
                }

                var handle_inv_ctx1 = function (txt) {
                    console.log("inv 1 check object");
                    console.log(txt);
                    var jsonStringResponse = JSON.stringify(txt);
                    localStorage.setItem("inventory_1", jsonStringResponse);
                    var data = JSON.parse(jsonStringResponse);
                    console.log(data);
                    if (data.success) {
                        $.each(data.rgDescriptions, function (i, obj) {
                            var is_package = false;
                            var appids;

                            if (obj.descriptions) {
                                for (var d = 0; d < obj.descriptions.length; d++) {
                                    if (obj.descriptions[d].type == "html") {
                                        appids = get_appids(obj.descriptions[d].value);
                                        if (appids) {
                                            // Gift package with multiple apps
                                            is_package = true;
                                            for (var j = 0; j < appids.length; j++) {
                                                if (appids[j]) localStorageHelpers.setValue(appids[j] + (obj.type === "Gift" ? "gift" : "guestpass"), true);
                                            }

                                            break;
                                        }
                                    }
                                }
                            }

                            if (!is_package && obj.actions) {
                                var appid = get_appid(obj.actions[0].link);
                                if (appid) localStorageHelpers.setValue(appid + (obj.type === "Gift" ? "gift" : "guestpass"), true);
                            }
                        });
                    }
                    gift_deferred.resolve();


                };

                var handle_inv_ctx6 = function (txt) {
                    console.log("handle inv 6");
                    var jsonStringResponse = JSON.stringify(txt);
                    localStorage.setItem("inventory_6", jsonStringResponse);

                    var data = JSON.parse(jsonStringResponse);
                    if (data.success) {
                        $.each(data.rgDescriptions, function (i, obj) {
                            if (obj.market_hash_name) {
                                localStorageHelpers.setValue("card:" + obj.market_hash_name, true);
                            }
                        });
                    }
                    card_deferred.resolve();

                };

                var handle_inv_ctx3 = function (txt) {
                    console.log("handle inv 3");
                    var jsonStringResponse = JSON.stringify(txt);
                    console.log(jsonStringResponse);
                    localStorage.setItem("inventory_3", jsonStringResponse);
                    var data = JSON.parse(jsonStringResponse);

                    console.log("Object is coupon");
                    console.log(data);
                    if (data.success) {

                        $.each(data.rgDescriptions, function (i, obj) {
                            var appid;
                            if (obj.type === "Coupon") {

                                if (obj.actions) {
                                    var packageids = [];
                                    for (var j = 0; j < obj.actions.length; j++) {
                                        //obj.actions[j]
                                        var link = obj.actions[j].link;
                                        var packageid = /http:\/\/store.steampowered.com\/search\/\?list_of_subs=([0-9]+)/.exec(link)[1];

                                        if (!localStorageHelpers.getValue("sub" + packageid)) packageids.push(packageid);
                                    }
                                    if (packageids.length > 0) {
                                        superSteamAsset.get("http://store.steampowered.com/api/packagedetails/?packageids=" + packageids.join(","), function (txt) {

                                            var jsonStringResponse = JSON.stringify(txt);
                                            var package_data = JSON.parse(jsonStringResponse);
                                            console.log(package_data);
                                            $.each(package_data, function (package_id, _package) {
                                                console.log("each function");
                                                console.log(_package);
                                                if (true) {
                                                    //if (_package.success) {
                                                    localStorageHelpers.setValue("sub" + package_id, true);
                                                    $.each(_package.data.apps, function (i, app) {
                                                        //these values arent all being added to the local storage for some reason
                                                        localStorageHelpers.setValue(app.id + "coupon", true);
                                                        localStorageHelpers.setValue(app.id + "coupon_sub", package_id);
                                                        localStorageHelpers.setValue(app.id + "coupon_imageurl", obj.icon_url);
                                                        localStorageHelpers.setValue(app.id + "coupon_title", obj.name);
                                                        localStorageHelpers.setValue(app.id + "coupon_discount", obj.name.match(/([1-9][0-9])%/)[1]);
                                                        console.log("Help?");
                                                        for (var i = 0; i < obj.descriptions.length; i++) {
                                                            if (startsWith(obj.descriptions[i].value, "Can't be applied with other discounts.")) {
                                                                //these are working but the values above are not being used
                                                                localStorageHelpers.setValue(app.id + "coupon_discount_note", obj.descriptions[i].value);
                                                                localStorageHelpers.setValue(app.id + "coupon_discount_doesnt_stack", true);
                                                            }
                                                            else if (startsWith(obj.descriptions[i].value, "(Valid")) {
                                                                localStorageHelpers.setValue(app.id + "coupon_valid", obj.descriptions[i].value);
                                                            }
                                                        }
                                                        ;
                                                    });
                                                }
                                            });
                                            coupon_deferred.resolve();
                                        });
                                    }
                                    else {
                                        coupon_deferred.resolve();
                                    }
                                }
                            }
                        });
                    }

                }

                var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
                var last_updated = localStorage.getItem("inventory_time") || expire_time - 1;

                //we need to reset this once everything is working
                if (last_updated < expire_time || !localStorage.getItem("inventory_1") || !localStorage.getItem("inventory_3")) {

                    // purge stale information from localStorage
                    //this is looping too many times
                    var i = 0, sKey;
                    for (; sKey = window.localStorage.key(i); i++) {
                        console.log(sKey);
                        if (sKey.match(/coupon/)) {
                            delValue(sKey);
                        }
                        if (sKey.match(/card:/)) {
                            delValue(sKey);
                        }
                        if (sKey.match(/gift/)) {
                            delValue(sKey);
                        }
                        if (sKey.match(/guestpass/)) {
                            delValue(sKey);
                        }
                    }
                    localStorage.setItem("inventory_time", parseInt(Date.now() / 1000, 10));
                    if (profileurl) {
                        superSteamAsset.get(profileurl + '/inventory/json/753/1/', handle_inv_ctx1);
                        superSteamAsset.get(profileurl + '/inventory/json/753/3/', handle_inv_ctx3);
                        superSteamAsset.get(profileurl + '/inventory/json/753/6/', handle_inv_ctx6);
                    }

                } else {
                    //I am parsing the json text that is being returned from the local storage so I dont have to add an if
                    //statement at the beginning of these functions to handle whether it is text or a json object--it will always
                    //be a JSON object
                    handle_inv_ctx1(JSON.parse(localStorage.getItem("inventory_1")));
                    handle_inv_ctx3(JSON.parse(localStorage.getItem("inventory_3")));
                    handle_inv_ctx6(JSON.parse(localStorage.getItem("inventory_6")));

                    gift_deferred.resolve();
                    coupon_deferred.resolve();
                    card_deferred.resolve();
                }

                $.when.apply(null, [gift_deferred.promise(), card_deferred.promise(), coupon_deferred.promise()]).done(function () {
                    deferred.resolve();
                });
                return deferred.promise();
            }
        }

        return _saveInventoryItemsInLocalStorage;
    });
})();
