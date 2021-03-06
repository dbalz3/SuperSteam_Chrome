﻿// Super Steam v1.12
(function () {
	var localization = require('localization');
	var currency = require('currency');
	var userPrefsUtils = require('user-prefs-utils');
	var earlyAccess = require('early-access');
	var localStorageHelpers = require('local-storage-helpers');
	var superSteamAsset = require('supersteam-asset');
	var $ = require('jquery');
	var loadInventory = require('load-inventory');
	var youtubeLoader = require('load-youtube');
	var inlineScriptLoader = require("load-script-inline");
	var steamKey = require("get-steam-key");
    var storage = chrome.storage.sync;
        
	// globals
	var localizedStrings;
	var user_currency;
	var is_signed_in = false;
	var language;
	var ea_appids;
	var assetUrls;
	var coeff = 1000*10;
        

	var cookie = document.cookie;

	// Run script in the context of the current tab
	function runInPageContext(fun){
		var script  = document.createElement('script');
		script.textContent = '(' + fun + ')();';
		document.documentElement.appendChild(script);
		script.parentNode.removeChild(script);
	}

	// Helper prototypes
	function startsWith(string, search) {
		return string.indexOf(search) === 0;
	};

	HTMLreplacements = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };

	function escapeHTML(str) {
		if(str === null || str === undefined){
			str = "";
		}
		str = str.toString();
		var return_string = str.replace(/[&"<>]/g, (m) => HTMLreplacements[m]);
		return return_string;
	}

	function getCookie(name) {
		var re = new RegExp(name + "=([^;]+)");
		var value = re.exec(document.cookie);
		return (value != null) ? unescape(value[1]) : null;
	}

	function matchAll(re, str) {
		var p, r = [];
		while(p = re.exec(str))
		r.push(p[1]);
		return r;
	}

	function get_appid(t) {
		if (t && t.match(/(?:store\.steampowered|steamcommunity)\.com\/app\/(\d+)\/?/)) return RegExp.$1;
		else return null;
	}

	function get_appids(t) {
		var res = matchAll(/(?:store\.steampowered|steamcommunity)\.com\/app\/(\d+)\/?/g, t);
		return (res.length > 0) ? res : null;
	}

	function get_subid(t) {
		if (t && t.match(/(?:store\.steampowered|steamcommunity)\.com\/sub\/(\d+)\/?/)) return RegExp.$1;
		else return null;
	}

	function get_appid_wishlist(t) {
		if (t && t.match(/game_(\d+)/)) return RegExp.$1;
		else return null;
	}

	function get_gamecard(t) {
		if (t && t.match(/(?:id|profiles)\/.+\/gamecards\/(\d+)/)) return RegExp.$1;
		else return null;
	}

	function delValue(key) {
		localStorage.removeItem(key);
	}

	// colors the tile for owned games
	function highlight_owned(node) {
		node.classList.add("es_highlight_owned");

		if (localStorageHelpers.getValue("hide_owned")) { hide_node(node); } else {
			if (userPrefs.highlightOwnedGames) { highlight_node(node, userPrefs.ownedGamesColor); }
		}
	}

	// colors the tile for wishlist games
	function highlight_wishlist(node) {
		//setup userprefs here
		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);
		node.classList.add("es_highlight_wishlist");

		if (localStorageHelpers.getValue("hide_wishlist")) {
			hide_node(node);
		}
		else if (userPrefs.highlightWishlistGames) {
			highlight_node(node, userPrefs.wishlistGamesColor);
		}
	}

	function highlight_cart(node) {
		if (localStorageHelpers.getValue("hide_cart")) { hide_node(node); }
	}

	function highlight_nondiscounts(node) {
		if (localStorageHelpers.getValue("hide_nondiscounts")) { $(node).css("display", "none"); }
	}

	function highlight_notinterested(node) {
		var notinterested_promise = (function () {
			var deferred = new $.Deferred();
			if (is_signed_in && window.location.protocol != "https:") {
				var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
				var last_updated = localStorageHelpers.getValue("dynamiclist_time") || expire_time - 1;

				if (last_updated < expire_time) {
					superSteamAsset.get("http://store.steampowered.com/dynamicstore/userdata/")
					.done((data) => {
						if (data["rgIgnoredApps"]) {
							localStorageHelpers.setValue("ignored_apps", data["rgIgnoredApps"].toString());
						}
						localStorageHelpers.setValue("dynamiclist_time", parseInt(Date.now() / 1000, 10));
						deferred.resolve();
					});
				} else {
					deferred.resolve();
				}
			} else {
				deferred.resolve();
			}
			return deferred.promise();
		})();

		$.when.apply($, [notinterested_promise]).done(function() {
			if (localStorageHelpers.getValue("hide_notinterested")) {
				var notinterested = localStorageHelpers.getValue("ignored_apps").split(",");
				if ($(node).hasClass("search_result_row")) {
					var appid = get_appid(node.href);
					if ($.inArray(appid, notinterested) !== -1) {
						$(node).css("display", "none");
					}
				}
			}
		});
	}

	function hexToRgb(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	function highlight_node(node, color) {
		var $node = $(node);
		// Carousel item
		if (node.classList.contains("cluster_capsule")) {
			$node = $(node).find(".main_cap_content");
		}

		// Genre Carousel items
		if (node.classList.contains("large_cap")) {
			$node = $(node).find(".large_cap_content");
		}

		// Sale items
		if (node.classList.contains("summersale_dailydeal_ctn")) {
			$node = $(node).find(".dailydeal_footer");
		}

		if (node.classList.contains("vote_option_game")) {
			$node = $(node).find(".vote_option_info");
		}

		// App and community hub page headers
		if (node.classList.contains("apphub_HeaderTop") || node.classList.contains("apphub_HeaderStandardTop")) {
			$node = $(node).find(".apphub_AppName");
			$node.css("color", color);
			return;
		}

		// Blotter activity
		if ($node.parent().parent()[0].classList.contains("blotter_daily_rollup_line") || $node.parent().parent()[0].classList.contains("blotter_author_block") || $node.parent().parent()[0].classList.contains("blotter_gamepurchase") || $node.parent().parent()[0].classList.contains("blotter_recommendation")) {
			$node.css("color", color);
			return;
		}

		var rgb = hexToRgb(color);

		$node.css("backgroundImage", "none");
		$node.css("background", "linear-gradient(135deg, rgba(0,0,0,1) 0%, rgba("+rgb.r+","+rgb.g+","+rgb.b+",0.8) 100%)");

		$node.find("img").css("opacity", "1");
		$(node).find(".search_capsule").css("opacity", "1");
		$(node).find(".ds_flag").remove();

		// Set text colour to not conflict with highlight.
		if (node.classList.contains("tab_item")) $node.find("div").css("color", "lightgrey");
		if (node.classList.contains("search_result_row")) $node.find(".search_name").css("color", "lightgrey");
	}

	function hide_node(node) {
		$(node).css("display", "none");

		if (node.classList.contains("search_result_row")) {
			if ($(document).height() <= $(window).height()) {
				load_search_results();
			}
		}
	}



	function add_empty_wishlist_buttons() {
		if(is_signed_in) {
			var profile = $(".playerAvatar a")[0].href.replace("http://steamcommunity.com", "");
			if (startsWith(window.location.pathname, profile)) {
				var empty_buttons = $("<div class='btn_save' id='es_empty_wishlist'>" + escapeHTML(language.empty_wishlist) + "</div>");
				$(".save_actions_enabled").filter(":last").after(empty_buttons);
				$("#es_empty_wishlist").click(empty_wishlist);
			}
		}
	}

	function add_wishlist_notes() {
		if(is_signed_in) {

			var profile = $(".playerAvatar a")[0].href.replace(window.location.protocol +"//steamcommunity.com", "");

				//Change css to this, so that at least the menu shows up
				/*
				.popup_block2 {
				 z-index: 900;
				 position: initial;
				 text-align: left;
				 }*/
				//.wishlistRow max-height: 50px

				$(".wishlistRow").each(function() {
					var appid = $(this).attr("id").replace("game_", "");
					var node = $(this);
					//var platform_img = $(this).find("#popup_block2 #span .platform_img");
					//$(this).append($("<div class='platform-spans' >"+platform_img+"</div>"));
					//$(this).find("#popup_block2 #span .platform_img").appendTo(".platform-spans");
					$(this).find(".bottom_controls .popup_block2 .popup_body2").prepend("<a class='popup_menu_item2 tight es_add_wishlist_note' id='es_add_wishlist_note_" + appid + "'><h5>"+"Add a wishlist note"+"</h5></a>");
					$spacer = $("<div class=\"hr\"></div>");
					$(this).append($spacer.clone());
					$(".wishlistRow").css({"max-height":"50px"});
					$(this).append($spacer.clone());
					//$(".platform_img").css({"position":"fixed"});
					$(".popup_block2").css({"z-index": "900","position": "relative","text-align": "left", "max-width":"157px"});
					//function set () {
					if (localStorageHelpers.getValue(appid + "wishlist_note")) {
						//Outputs null

						$(node).find("h4").after("<div class='es_wishlist_note'>" + localStorageHelpers.getValue(appid + "wishlist_note").toString() + "</div>").css("padding-top", "6px");
						$("#es_add_wishlist_note_" + appid).find("h5").text("Update wishlist note");
						if ($(this).find(".es_wishlist_note")[0].scrollWidth > $(node).find(".es_wishlist_note")[0].clientWidth) { $(this).find(".es_wishlist_note").attr("title", localStorageHelpers.getValue(appid + "wishlist_note")); }
					} else{
						//note = prompt("Enter your wishlist note", "");
						//var test = "";
						//test = localStorageHelpers.setValue(appid + "wishlist_note", note);
					}
				});


				$(".es_add_wishlist_note").click(function() {
					//$(".popup_block2").hide();

					var appid = $(this).attr("id").replace("es_add_wishlist_note_", "");
					if (localStorageHelpers.getValue(appid + "wishlist_note")) {
						var note = prompt("Update your wishlist note", localStorageHelpers.getValue(appid + "wishlist_note"));
					} else {
						var note = prompt("Enter your wishlist note", "");
					}

					switch (note) {
						//case null:
						//note = "Not null";
						//break;
						//case note = "?":
						//delValue(appid + "wishlist_note");
						//$("#game_" + appid).find(".es_wishlist_note").remove();
						//localStorageHelpers.setValue(appid + "wishlist_note", note);
						//break;
						default:
						localStorageHelpers.setValue(appid + "wishlist_note", note);
						$("#game_" + appid).find(".es_wishlist_note").remove();
						$("#game_" + appid).find("h4").after("<div class='es_wishlist_note'>" + localStorageHelpers.getValue(appid + "wishlist_note") + "</div").css("padding-top", "6px");
						if ($("#game_" + appid).find(".es_wishlist_note")[0].scrollWidth > $("#game_" + appid).find(".es_wishlist_note")[0].clientWidth) { $("#game_" + appid).find(".es_wishlist_note").attr("title", localStorageHelpers.getValue(appid + "wishlist_note")); }
					}
				});
			//}
		}
	}



	function empty_wishlist() {
		var conf_text = "Are you sure you want to empty your wishlist?\n\nThis action cannot be undone!";
		var conf = confirm(conf_text);
		if (conf) {
			var wishlist_class = ".wishlistRow";
			var deferreds = $(wishlist_class).map(function(i, $obj) {
				var deferred = new $.Deferred();
				var appid = get_appid_wishlist($obj.id),
				profile = $(".playerAvatar a")[0].href.replace("http://steamcommunity.com/", ""),
				session = getCookie("sessionid");

				$.ajax({
					type:"POST",
					url: "http://steamcommunity.com/" + profile + "/wishlist/",
					data:{
						sessionid: session,
						action: "remove",
						appid: appid
					},
					success: function( msg ) {
						deferred.resolve();
					}
				});

				return deferred.promise();
			});

			$.when.apply(null, deferreds).done(function(){
				location.reload();
			});
		}
	}

	function add_wishlist_filter() {
		var html  = "<span>" + escapeHTML(language.show) + ": </span>";
		html += "<label class='es_sort' id='es_wl_all'><input type='radio' name='es_wl_sort' checked><span><a>" + escapeHTML(language.games_all) + "</a></span></label>";
		html += "<label class='es_sort' id='es_wl_sale'><input type='radio' name='es_wl_sort'><span><a>" + escapeHTML(language.games_discount) + "</a></span></label>";
		html += "</div>";

		$('#wishlist_sort_options').append("<p>" + html);

		$('#es_wl_all').on('click', function() {
			$('.wishlistRow').css('display', 'block');
		});

		$('#es_wl_sale').on('click', function() {
			$('.wishlistRow').each(function () {
				if (!$(this).html().match(/discount_block_inline/)) {
					$(this).css('display', 'none');
				}
			});
		});

		$('#es_wl_coupon').on('click', function() {
			$('.wishlistRow').each(function () {
				if (!$(this)[0].outerHTML.match(/es_highlight_coupon/)) {
					$(this).css('display', 'none');
				}
			});
		});
	}

	function add_wishlist_discount_sort() {
		if ($("#wishlist_sort_options").find("a[href$='price']").length > 0) {
			$("#wishlist_sort_options").find("a[href$='price']").after("&nbsp;&nbsp;<label id='es_wl_sort_discount'><a>Discount</a></label>");
		} else {
			$("#wishlist_sort_options").find("span[class='selected_sort']").after("&nbsp;&nbsp;<label id='es_wl_sort_discount'><a>Discount</a></label>");
		}

		$("#es_wl_sort_discount").on("click", function() {
			var wishlistRows = [];
			$('.wishlistRow').each(function () {
				var push = new Array();
				if ($(this).html().match(/discount_block_inline/)) {
					push[0] = this.outerHTML;
					push[1] = $(this).find("div[class='discount_pct']").html();
				} else {
					push[0] = this.outerHTML;
					push[1] = "0";
				}
				wishlistRows.push(push);
				this.parentNode.removeChild(this);
			});

			wishlistRows.sort(function(a,b) { return parseInt(a[1],10) - parseInt(b[1],10);	});

			$('.wishlistRow').each(function () { $(this).css("display", "none"); });

			$(wishlistRows).each(function() {
				$("#wishlist_items").append(this[0]);
			});

			$(this).html("<span style='color: #B0AEAC;'>Discount</span>");
			var html = $("#wishlist_sort_options").find("span[class='selected_sort']").html();
			html = "<a onclick='location.reload()'>" + html + "</a>";
			$("#wishlist_sort_options").find("span[class='selected_sort']").html(html);
		});
	}

	//removed the parse currency functions here, these need to be properly referenced from the currency module

	// Calculate total cost of all items on wishlist
	function add_wishlist_total() {
		var total = 0;
		var gamelist = "";
		var items = 0;
		var currency_symbol;
		var apps = "";

		function calculate_node($node, search) {

			var parsed = currency.parse($node.find(search).text().trim());

			if (parsed) {
				currency_symbol = parsed.currency_symbol;
				gamelist += $node.find("h4").text().trim() + ", ";
				items ++;
				total += parsed.value;
				apps += get_appid($node.find(".btnv6_blue_hoverfade").attr("href")) + ",";
			}
		}

		$('.wishlistRow').each(function () {
			var $this = $(this);

			if ($this.find("div[class='price']").length != 0 && $this.find("div[class='price']").text().trim() != "")
			calculate_node($this, "div[class='price']");

			if ($this.find("div[class='discount_final_price']").length != 0)
			calculate_node($this, "div[class='discount_final_price']");
		});
		gamelist = gamelist.replace(/, $/, "");

		currency_type = currency.symbolToType(currency_symbol);

		
		total = currency.format(parseFloat(total), currency_type);
		$(".games_list").after("<link href='http://store.akamai.steamstatic.com/public/css/v6/game.css' rel='stylesheet' type='text/css'><div class='game_area_purchase_game' style='width: 600px; margin-top: 15px;'><h1>" + language.wishlist + "</h1><p class='package_contents'><b>" + language.bundle.includes.replace("(__num__)", items) + ":</b> " + gamelist + "</p><div class='game_purchase_action'><div class='game_purchase_action_bg'><div class='game_purchase_price price'>" + total + "</div></div></div></div></div></div>");
	}

	function add_wishlist_ajaxremove() {
		// Remove "onclick"
                runInPageContext(function(){ $J("a[onclick*=wishlist_remove]").removeAttr("onclick").addClass("es_wishlist_remove"); });

                var store_sessionid = false;
                storage.get(function(settings) {
                        if (settings.store_sessionid) {
                                store_sessionid = settings.store_sessionid;
                        }

                        var sessionid = store_sessionid || decodeURIComponent(cookie.match(/sessionid=(.+?);/i)[1]);

                        $(".es_wishlist_remove").on("click", function(e) {
                                e.preventDefault();

                                var appid = $(this).parent().parent().parent()[0].id.replace("game_", "");
                                $.ajax({
                                        type: "POST",
                                        url: (store_sessionid ? "//store.steampowered.com/api/removefromwishlist" : window.location),
                                        data: {
                                                sessionid: sessionid,
                                                action: "remove",
                                                appid: appid
                                        },
                                        success: function( msg ) {
                                                var currentRank = parseFloat($("#game_" + appid + " .wishlist_rank")[0].value);
                                                if ($("#es_price_" + appid).length > 0) { $("#es_price_" + appid).remove(); }
                                                $("#game_" + appid).fadeOut("fast", function(){ $(this).remove(); });
                                                localStorageHelpers.setValue(appid + "wishlisted", false);
                                                for (var i = 0; i < $('.wishlistRow').length; i++) {
                                                        if ($('.wishlist_rank')[i].value > currentRank) {
                                                                $('.wishlist_rank')[i].value = $('.wishlist_rank')[i].value - 1;	
                                                        }
                                                }
                                        }
                                });
                        });
                });
	}

	function pack_split(node, ways) {
		var price_text = $(node).find(".discount_final_price").html();
		var at_end, comma, places = 2;
		if (price_text == null) { price_text = $(node).find(".game_purchase_price").html(); }
		if (price_text.match(/,\d\d(?!\d)/)) {
			at_end = true;
			comma = true;
			price_text = price_text.replace(",", ".");
		}
		var currency_symbol = currency.symbolFromString(price_text);
		var currency_type = currency.symbolToType(currency_symbol);
		var price = (Number(price_text.replace(/[^0-9\.]+/g,""))) / ways;
		price = (Math.ceil(price * 100) / 100);
		//Gotta fix
		price_text = currency.format(price, currency_type);
		$(node).find(".btn_addtocart").last().before(
			"<div class='es_each_box'><div class='es_each_price'>" + price_text + "</div><div class='es_each'>"+language.each+"</div></div>"
		);
	}

	function add_4pack_breakdown() {
		$(".game_area_purchase_game_wrapper").each(function() {
			var title = $(this).find("h1").text().trim();
			title = title.toString().toLowerCase().replace(/-/g, ' ');

			if (!title || title.indexOf('pack') < 0) return;

			if (title.includes(' 2 pack')) { pack_split(this, 2); }
			else if (title.includes(' two pack')) { pack_split(this, 2); }
			else if (title.includes('tower wars friend pack')) { pack_split(this, 2); }

			else if (title.includes(' 3 pack') && !title.includes('doom 3')) { pack_split(this, 3); }
			else if (title.includes(' three pack')) { pack_split(this, 3); }
			else if (title.includes('tower wars team pack')) { pack_split(this, 3); }

			else if (title.includes(' 4 pack')) { pack_split(this, 4); }
			else if (title.includes(' four pack')) { pack_split(this, 4); }
			else if (title.includes(' clan pack')) { pack_split(this, 4); }

			else if (title.includes(' 5 pack')) { pack_split(this, 5); }
			else if (title.includes(' five pack')) { pack_split(this, 5); }

			else if (title.includes(' 6 pack')) { pack_split(this, 6); }
			else if (title.includes(' six pack')) { pack_split(this, 6); }
		});
	}

	function send_age_verification() {
		document.getElementsByName("ageYear")[0].value="1955";
		document.getElementsByClassName("btnv6_blue_hoverfade")[0].click();
	}

	function add_steamchart_info(appid) {
		if (localStorageHelpers.getValue("show_apppage_initialsetup") === null) {
			localStorageHelpers.setValue("show_apppage_current", true);
		}

		if ($(".game_area_dlc_bubble").length == 0) {
			if (userPrefs.showSteamChartsInfo === true && localStorageHelpers.getValue("show_apppage_current")) {
				superSteamAsset.get("https://steamwatcher.com/boiler/chart/steamcharts.php?appid=" + appid, function (txt) {
					if (txt.length > 0) {
						var data = JSON.parse(txt);
						if (data["chart"]) {
							var html = '<div id="steam-charts" class="game_area_description"><h2>' + escapeHTML(language.charts.current) + '</h2>';
							html += '<div id="chart-heading" class="chart-content"><div id="chart-image"><img src="http://cdn.akamai.steamstatic.com/steam/apps/' + escapeHTML(appid) + '/capsule_184x69.jpg" width="184" height="69"></div><div class="chart-stat">';
							html += '<span class="num">' + escapeHTML(data["chart"]["current"]) + '</span><br>' + escapeHTML(language.charts.playing_now) + '</div><div class="chart-stat">';
							html += '<span class="num">' + escapeHTML(data["chart"]["peaktoday"]) + '</span><br>' + escapeHTML(language.charts.peaktoday) + '</div><div class="chart-stat">';
							html += '<span class="num">' + escapeHTML(data["chart"]["peakall"]) + '</span><br>' + escapeHTML(language.charts.peakall) + '</div><span class="chart-footer">Powered by <a href="http://steamcharts.com/app/' + escapeHTML(appid) + '" target="_blank">SteamCharts.com</a></span></div></div>';

							$(".sys_req").parent().before(html);
						}
					}
				});
			}
		}
	}

	function add_steamspy_info(appid){
		if (userPrefs.showSteamSpyInfo) {
			superSteamAsset.get("https://steamwatcher.com/boiler/steamspy/steamspy.php?appid=" + appid)
			.done(function (txt) {

				//change this variable name from da to something else
				var da = JSON.stringify(txt);
				var data = JSON.parse(da);

				if (data["owners"] != 0) {
					var owners1 = Number(parseInt(data["owners"]) - parseInt(data["owners_variance"])).toLocaleString("en"),
					owners2 = Number(parseInt(data["owners"]) + parseInt(data["owners_variance"])).toLocaleString("en"),
					players2weeks1 = Number(parseInt(data["players_2weeks"]) - parseInt(data["players_2weeks_variance"])).toLocaleString("en"),
					players2weeks2 = Number(parseInt(data["players_2weeks"]) + parseInt(data["players_2weeks_variance"])).toLocaleString("en"),
					players2weeksp = (parseInt(data["players_2weeks"]) / parseInt(data["owners"]) * 100).toFixed(2),
					players1 = Number(parseInt(data["players_forever"]) - parseInt(data["players_forever_variance"])).toLocaleString("en"),
					players2 = Number(parseInt(data["players_forever"]) + parseInt(data["players_forever_variance"])).toLocaleString("en"),
					playersp = (parseInt(data["players_forever"]) / parseInt(data["owners"]) * 100).toFixed(2)
					avg_hours = Math.floor(parseInt(data["average_forever"]) / 60),
					avg_minutes = parseInt(data["average_forever"]) % 60,
					avg_hours2 = Math.floor(parseInt(data["average_2weeks"]) / 60),
					avg_minutes2 = parseInt(data["average_2weeks"]) % 60;

					var html = '<div id="steam-spy" class="game_area_description"><h2>Player Data</h2>';
					html += "<div class='spy_details'>";
					html += "<b>Owners:</b> " + owners1 + " - " + owners2;
					html += "<br><b>Players total:</b> " + players1 + " - " + players2 + " (" + playersp + "%)";
					html += "<br><b>Players in the last two weeks:</b> " + players2weeks1 + " - " + players2weeks2 + " (" + players2weeksp + "%)";
					html += "<br><b>Average playtime:</b> " + avg_hours + " hours, " + avg_minutes + " minutes";
					html += "<br><b>Average playtime in the last two weeks:</b> " + avg_hours2 + " hours, " + avg_minutes2 + " minutes";
					html += "<span class='chart-footer' style='padding-right: 13px;'>Powered by <a href='http://steamspy.com/app/" + appid + "' target='_blank'>steamspy.com</a></span>";
					html += "</div>";

					if ($("#steam-charts").length) {
						$("#steam-charts").after(html);
					} else {
						$(".sys_req").parent().before(html);
					}
				}
			});
		}
	}

	function add_wallet_balance_to_header() {
		if (is_signed_in) {
			$("#global_action_menu").append("<div id='es_wallet' style='text-align:right; padding-right:12px; line-height: normal;'>");
			$("#es_wallet").load('http://store.steampowered.com #header_wallet_ctn');
		}
	}

	// Adds Super Steam menu
	function add_super_steam_options() {
		//we need to add more options to this dropdown menu, it should include the real website (super-steam.net) as well
		//as a link to the options page
		$dropdown = $("<span class=\"pulldown global_action_link\" id=\"enhanced_pulldown\">Super Steam</span>");
		$dropdown_options_container = $("<div class=\"popup_block_new\"><div class=\"popup_body popup_menu\" id=\"es_popup\"></div></div>");
		$dropdown_options = $dropdown_options_container.find(".popup_body");
		$dropdown_options.css("display", "none");

		// remove menu if click anywhere but on "Super Steam".
		$('body').bind('click', function(e) {
			if($(e.target).closest("#enhanced_pulldown").length == 0) {
				if ($dropdown_options.css("display") == "block" || $dropdown_options.css("display") == "") {
					$dropdown_options.css("display", "none");
				}
			}
		});

		$dropdown.click(function(){
			$dropdown_options.toggle();
		});

		$website_link = $("<a class=\"popup_menu_item\" target=\"_blank\" href=\"http://super-steam.net\">" + escapeHTML(language.website) + "</a>");

		$clear_cache_link = $("<a class=\"popup_menu_item\" href=\"\">" + escapeHTML(language.clear_cache) + "</a>");
		$clear_cache_link.click(function(){
			localStorage.clear();
			location.reload();
		});

		$spacer = $("<div class=\"hr\"></div>");

		$dropdown_options.append($clear_cache_link);
		$dropdown_options.append($spacer.clone());
		$dropdown_options.append($website_link);

		$("#global_action_menu")
		.prepend($dropdown)
		.prepend($dropdown_options_container);

		$("#global_actions").after("<progress id='es_progress' class='complete' value='1' max='1' title='" + language.ready.ready + "'></progress>");
	}

	function add_fake_country_code_warning() {
		var LKGBillingCountry = getCookie("LKGBillingCountry");
		var fakeCC = getCookie("fakeCC");

		if (fakeCC && LKGBillingCountry && LKGBillingCountry.length == 2 && LKGBillingCountry != fakeCC) {
			$("#global_header").after('<div class=content style="background-image: url( ' + assetUrls.img_red_banner + ' ); height: 21px; text-align: center; padding-top: 8px;">' + escapeHTML(language.using_store.replace("__current__", escapeHTML(fakeCC))) + '  <a href="#" id="reset_fake_country_code">' + escapeHTML(language.using_store_return.replace("__base__", escapeHTML(LKGBillingCountry))) + '</a></div>');
			$("#page_background_holder").css("top", "135px");
			$("#reset_fake_country_code").click(function(e) {
				e.preventDefault();
				document.cookie = 'fakeCC=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
				window.location.replace(window.location.href.replace(/[?&]cc=.{2}/, ""));
			})
		}
	}

	// Displays warning if browsing in a different language
	function add_language_warning() {

		//this needs to be pulled from userprefs

		if (showlanguagewarning) {
			var currentLanguage = "English";
			if (cookie.match(/language=([a-z]+)/i)) {
				currentLanguage = cookie.match(/language=([a-z]+)/i)[1];
			}
			currentLanguage = currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1);
			function make_language_pretty(language_string) {
				switch (language_string) {
					case "Schinese": return "Simplified Chinese"; break;
					case "Tchinese": return "Traditional Chinese"; break;
					case "Koreana":	return "Korean"; break;
					default: return language_string; break;
				}
			}

			var lang = showlanguagewarninglanguage.toLowerCase().slice(0,3);

			currentLanguage = make_language_pretty(currentLanguage);
			showlanguagewarninglanguage = make_language_pretty(showlanguagewarninglanguage);

			if (showlanguagewarninglanguage != currentLanguage) {
				if (localizedStrings[lang] && localizedStrings[lang].using_language && localizedStrings[lang].using_language_return) {
					$("#global_header").after('<div class=content style="background-image: url( ' + assetUrls.img_red_banner + '); color: #ffffff; font-size: 12px; height: 21px; text-align: center; padding-top: 8px;">' + escapeHTML(localizedStrings[lang].using_language.replace("__current__", currentLanguage)) + '  <a href="#" id="reset_language_code">' + escapeHTML(localizedStrings[lang].using_language_return.replace("__base__", showlanguagewarninglanguage)) + '</a></div>');
				} else {
					$("#global_header").after('<div class=content style="background-image: url( ' + assetUrls.img_red_banner + '); color: #ffffff; font-size: 12px; height: 21px; text-align: center; padding-top: 8px;">' + escapeHTML(localizedStrings["eng"].using_language.replace("__current__", currentLanguage)) + '  <a href="#" id="reset_language_code">' + escapeHTML(localizedStrings["eng"].using_language_return.replace("__base__", showlanguagewarninglanguage)) + '</a></div>');
				}
				$("#page_background_holder").css("top", "135px");
				$("#reset_language_code").click(function(e) {
					e.preventDefault();
					document.cookie = 'Steam_Language=' + showlanguagewarninglanguage.toLowerCase() + ';path=/;';
					window.location.replace(window.location.href.replace(/[?&]l=[a-z]+/, ""));
				});
			}
		}
	}

	// Removes the "Install Steam" button at the top of each page
	function removeInstallSteamButton() {
		if (userPrefs.hideInstallSteamButton == true) {
			$('div.header_installsteam_btn').remove();
		}
	}

	// Removes the About menu item at the top of each page
	function remove_about_menu() {
		if (userPrefs.hideAboutMenu == true) {
			$('a[href$="http://store.steampowered.com/about/"]').replaceWith('');
			$('div.header_installsteam_btn')
			.append($('<a>')
				.addClass("header_installsteam_btn_content")
				.attr("href", "http://store.steampowered.com/about/")
				.text("Install Steam")
			);
		}
	}

	function add_header_links() {
		if ($(".supernav_container").length > 0) {
			// add "Forums" after "Workshop"
			//localizedStrings comes up undefined
			$(".submenu_community").find("a[href='" + window.location.protocol + "//steamcommunity.com/workshop/']").after('<a class="submenuitem" href="//forums.steampowered.com/forums/" target="_blank">' + "Forums" + '</a>');

			if (is_signed_in) {
				$(".submenu_username").find("a:first").after('<a class="submenuitem" href="//steamcommunity.com/my/games/">' + "Games" + '</a>');
				$(".submenu_username").append('<a class="submenuitem" href="//steamcommunity.com/my/recommended/">' + "Reviews" + '</a>');
			}

		}
	}

	function add_custom_wallet_amount() {
		var addfunds = $(".addfunds_area_purchase_game:first").clone();
		$(addfunds).addClass("es_custom_funds");
		$(addfunds).find(".btnv6_green_white_innerfade").addClass("es_custom_button");
		$(addfunds).find("h1").text(language.wallet.custom_amount);
		$(addfunds).find("p").text(language.wallet.custom_amount_text.replace("__minamount__", $(addfunds).find(".price").text().trim()));
		var currency_symbol = currency.symbolFromString($(addfunds).find(".price").text().trim());
		var minimum = $(addfunds).find(".price").text().trim().replace(/(?:R\$|\$|€|¥|£|pуб)/, "");
		var formatted_minimum = minimum;
		switch (currency_symbol) {
			case "€":
			case "pуб":
			$(addfunds).find(".price").html("<input id='es_custom_funds_amount' class='es_text_input' style='margin-top: -3px;' size=4 value='" + escapeHTML(minimum) +"'> " + escapeHTML(currency_symbol));
			break;
			default:
			$(addfunds).find(".price").html(currency_symbol + " <input id='es_custom_funds_amount' class='es_text_input' style='margin-top: -3px;' size=4 value='" + escapeHTML(minimum) +"'>");
			break;
		}
		$("#game_area_purchase .addfunds_area_purchase_game:first").after(addfunds);
		$("#es_custom_funds_amount").change(function() {
			// Make sure two numbers are entered after the separator
			if (!($("#es_custom_funds_amount").val().match(/(\.|\,)\d\d$/))) { $("#es_custom_funds_amount").val($("#es_custom_funds_amount").val().replace(/\D/g, "")); }

			// Make sure the user entered decimals.  If not, add 00 to the end of the number to make the value correct
			if (currency_symbol == "€" || currency_symbol == "pуб" || currency_symbol == "R$") {
				if ($("#es_custom_funds_amount").val().indexOf(",") == -1) $("#es_custom_funds_amount").val($("#es_custom_funds_amount").val() + ",00");
			} else {
				if ($("#es_custom_funds_amount").val().indexOf(".") == -1) $("#es_custom_funds_amount").val($("#es_custom_funds_amount").val() + ".00");
			}

			var calculated_value = $("#es_custom_funds_amount").val().replace(/-/g, "0").replace(/\D/g, "").replace(/[^A-Za-z0-9]/g, '');
			$("#es_custom_funds_amount").val($("#es_custom_funds_amount").val().replace(/[A-Za-z]/g, ''));
			$(".es_custom_button").attr("href", "javascript:submitAddFunds( " + escapeHTML(calculated_value) + " );")
		});
	}

	function add_empty_cart_button() {
		addtext = "<a id='es_empty_cart' class='es_empty btnv6_green_white_innerfade btn_medium continue' style='float: left;'><span>" + escapeHTML(language.empty_cart) + "</span></a>";
		$(".checkout_content").prepend(addtext);
		if ($(".cart_row").length === 0) {
			$(".es_empty").addClass("btn_disabled");
		}
		$("#es_empty_cart").on("click", function() {
			document.cookie = 'shoppingCartGID' + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/';
			location.href=location.href;
		});
	}

	// User profile pages
	function add_community_profile_links() {

		
			if ($("#reportAbuseModal").length > 0) { var steamID = document.getElementsByName("abuseID")[0].value; }
			if (steamID === undefined && document.documentElement.outerHTML.match(/steamid"\:"(.+)","personaname/)) { var steamID = document.documentElement.outerHTML.match(/steamid"\:"(.+)","personaname/)[1]; }
			var ico_steamrep, ico_steamtrades, ico_steamgifts, ico_achievementstats, ico_backpacktf, ico_astats;
			var ico_steamdb = assetUrls.img_ico_steamdb;

			function showprofilelinks_display(){

			}
			switch (showprofilelinks_display) {
				default:
				//The appropriate files exist, but these must be the wrong pointers.
				ico_steamrep = assetUrls.img_ico_steamrep;
				ico_steamgifts = assetUrls.img_ico_steamgifts;
				ico_achievementstats = assetUrls.img_ico_achievementstats;
				ico_backpacktf = assetUrls.img_ico_backpacktf;
				ico_astats = assetUrls.img_ico_astatsnl;
				break;
				case 1:
				ico_steamrep = assetUrls.img_ico_steamrep_col;
				ico_steamgifts = assetUrls.img_ico_steamgifts_col;
				ico_achievementstats = assetUrls.img_ico_achievementstats_col;
				ico_backpacktf = assetUrls.img_ico_backpacktf_col;
				ico_astats = assetUrls.img_ico_astatsnl_col;
				break;
			}

			var htmlstr = '';
			htmlstr += '<div class="profile_count_link"><a href="http://steamrep.com/profiles/' + steamID + '" target="_blank"><span class="count_link_label">SteamRep</span>&nbsp;<span class="profile_count_link_total">';
                        if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_steamrep + '" class="profile_link_icon">'; } else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
			htmlstr += '<div class="profile_count_link"><a href="http://steamdb.info/calculator/?player=' + steamID + '" target="_blank"><span class="count_link_label">SteamDB</span>&nbsp;<span class="profile_count_link_total">';
			if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_steamdb + '" class="profile_link_icon">'; }else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
			htmlstr += '<div class="profile_count_link"><a href="http://www.steamgifts.com/go/user/' + steamID + '" target="_blank"><span class="count_link_label">SteamGifts</span>&nbsp;<span class="profile_count_link_total">';
                        if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_achievementstats + '" class="profile_link_icon">'; }else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
                        htmlstr += '<div class="profile_count_link"><a href="http://www.achievementstats.com/index.php?action=profile&playerId=' + steamID + '" target="_blank"><span class="count_link_label">Achievement Stats</span>&nbsp;<span class="profile_count_link_total">';
                        if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_achievementstats + '" class="profile_link_icon">'; }else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
                        htmlstr += '<div class="profile_count_link"><a href="http://backpack.tf/profiles/' + steamID + '" target="_blank"><span class="count_link_label">Backpack.tf</span>&nbsp;<span class="profile_count_link_total">';
                        if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_backpacktf + '" class="profile_link_icon">'; }else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
                        htmlstr += '<div class="profile_count_link"><a href="http://astats.astats.nl/astats/User_Info.php?steamID64=' + steamID + '" target="_blank"><span class="count_link_label">AStats.nl</span>&nbsp;<span class="profile_count_link_total">';
                        if (showprofilelinks_display != 2) { htmlstr += '<img src="' + ico_astats + '" class="profile_link_icon">'; }else {htmlstr += '&nbsp;';}
                        htmlstr += '</span></a></div>';
                        htmlstr += "<div class=\"profile_count_link\" id=\"es_permalink_div\"><span id=\"es_permalink_text\">"+language.permalink+"</span><input type=\"text\" id=\"es_permalink\" value=\"" + window.location.protocol + "//steamcommunity.com/profiles/"+steamID+"\" readonly></div>";

            
                        if (htmlstr != '') { $(".profile_item_links").append(htmlstr); }

			if ($(".profile_item_links").length == 0) {
				$(".profile_rightcol").append("<div class='profile_item_links'>");
				$(".profile_item_links").append(htmlstr);
				$(".profile_rightcol").after("<div style='clear: both'></div>");
			}
            }

	// Fix "No image available" in wishlist
	function fix_wishlist_image_not_found() {
		var items = document.getElementById("wishlist_items");
		if (items) {
			imgs = items.getElementsByTagName("img");
			for (var i = 0; i < imgs.length; i++)
			if (imgs[i].src == "http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/33/338200c5d6c4d9bdcf6632642a2aeb591fb8a5c2.gif") {
				var gameurl = imgs[i].parentNode.href;
				imgs[i].src = "http://cdn.akamai.steamstatic.com/steam/apps/" + gameurl.substring(gameurl.lastIndexOf("/") + 1) + "/header.jpg";
			}
		}
	}

	function fix_profile_image_not_found() {
		var items = $(".recent_game");
		if (items) {
			imgs = $(items).find("img");
			for (var i = 0; i < imgs.length; i++)
			if (imgs[i].src == "http://media.steampowered.com/steamcommunity/public/images/avatars/33/338200c5d6c4d9bdcf6632642a2aeb591fb8a5c2.gif") {
				var gameurl = imgs[i].parentNode.href;
				imgs[i].src = "http://cdn.steampowered.com/v/gfx/apps/" + gameurl.substring(gameurl.lastIndexOf("/") + 1) + "/header.jpg";
				imgs[i].width = 184;
				imgs[i].height = 69;
			}
		}
	}

	function add_wishlist_profile_link() {
		if ($("#reportAbuseModal").length > 0) { var steamID = document.getElementsByName("abuseID")[0].value; }
		if (steamID === undefined && document.documentElement.outerHTML.match(/steamid"\:"(.+)","personaname/)) { var steamID = document.documentElement.outerHTML.match(/steamid"\:"(.+)","personaname/)[1]; }

		$(".profile_item_links").find(".profile_count_link:first").after("<div class='profile_count_link' id='es_wishlist_link'><a href='http://steamcommunity.com/profiles/" + steamID + "/wishlist'><span class='count_link_label'>" + language.wishlist + "</span>&nbsp;<span class='profile_count_link_total' id='es_wishlist_count'></span></a></div>");

		// Get count of wishlisted items
		superSteamAsset.get("http://steamcommunity.com/profiles/" + steamID + "/wishlist", function(txt) {
			var html = $.parseHTML(txt);
			var count = ($(html).find(".wishlistRow").length);

			if (count) { $("#es_wishlist_count").text(count); } else { $('#es_wishlist_link').remove(); }
		});
	}

	function appdata_on_wishlist() {
		$('a.btnv6_blue_hoverfade').each(function (index, node) {
			var app = get_appid(node.href);
			superSteamAsset.get('http://store.steampowered.com/api/appdetails/?appids=' + app, function (data) {
				var jsonString = JSON.stringify(data);
				var storefront_data = JSON.parse(jsonString);
				$.each(storefront_data, function(appid, app_data) {

					if (app_data.success) {
                                           
                                              	if (app_data.data.platforms) {
							var htmlstring = "";
							var platforms = 0;
							if (app_data.data.platforms.windows) { htmlstring += "<span class='platform_img win'></span>"; platforms += 1; }
							if (app_data.data.platforms.mac) { htmlstring += "<span class='platform_img mac'></span>"; platforms += 1; }
							if (app_data.data.platforms.linux) { htmlstring += "<span class='platform_img linux'></span>"; platforms += 1; }

							if (platforms > 1) { htmlstring = "<span class='platform_img steamplay'></span>" + htmlstring; }
							//css padding and lock in place
							$(node).parent().parent().parent().find(".btnv6_blue_hoverfade").append("<div class='platform-spans' align='right' >"+htmlstring+"</div>");
							//$(node).parent().parent().parent().find("storepage_btn_ctn").append(htmlstring);
							//.css({"position":"relative", "bottom":"20px"})
						}
                                                
                                                // Add release date info to unreleased apps
                                                localizedStrings = "";
						if (app_data.data.release_date.coming_soon == true) {
							$(node).parent().before("<div class='price'>" + localizedStrings + "Available: " + app_data.data.release_date.date + "</div>");
						}
					}
				});
			});
		});
	}

	// If app has a coupon, display message
	function display_coupon_message(appid) {
		loadInventory.getInventory().then(()=>{
			if (localStorageHelpers.getValue(appid+"coupon")) {
				var coupon_date = localStorageHelpers.getValue(appid + "coupon_valid");
				var coupon_date2 = coupon_date.match(/\[date](.+)\[\/date]/);
				coupon_date = new Date(coupon_date2[1] * 1000);

				var coupon_discount_note = localStorageHelpers.getValue(appid + "coupon_discount_note");
				if (coupon_discount_note === null) { coupon_discount_note = ""; }

				$('#game_area_purchase').before($(""+
				"<div class=\"early_access_header\">" +
				"    <div class=\"heading\">" +
				"        <h1 class=\"inset\">" + language.coupon_available + "</h1>" +
				"        <h2 class=\"inset\">" + language.coupon_application_note + "</h2>" +
				"        <p>" + language.coupon_learn_more + "</p>" +
				"    </div>" +
				"    <div class=\"devnotes\">" +
				"        <table border=0>" +
				"            <tr>" +
				"                <td rowspan=3>" +
				"                    <img src=\"http://cdn.steamcommunity.com/economy/image/" + escapeHTML(localStorageHelpers.getValue(appid + "coupon_imageurl")) + "\"/>" +
				"                </td>" +
				"                <td valign=center>" +
				"                    <h1>" + escapeHTML(localStorageHelpers.getValue(appid + "coupon_title")) + "</h1>" +
				"                </td>" +
				"            </tr>" +
				"            <tr>" +
				"                <td>" + escapeHTML(coupon_discount_note) + "</td>" +
				"            </tr>" +
				"            <tr>" +
				"                <td>" +
				"                    <font style=\"color:#A75124;\">" + escapeHTML(coupon_date) + "</font>" +
				"                </td>" +
				"            </tr>" +
				"        </table>" +
				"    </div>" +
				"</div>"));

				var price_div = $(".game_purchase_action:first");
				var	cart_id = $(document).find("[name=\"subid\"]")[0].value;
				var actual_price_container = $(price_div).find(".price,.discount_final_price").text().trim();
				var currency_symbol = currency.symbolFromString(actual_price_container);
				var currency_type = currency.symbolToType(currency_symbol);
				var comma = actual_price_container.search(/,\d\d(?!\d)/);

				if (comma > -1) {
					actual_price_container = actual_price_container.replace(",", ".");
				} else {
					actual_price_container = actual_price_container.replace(",", "");
				}

				var original_price = parseFloat(actual_price_container.match(/([0-9]+(?:(?:\,|\.)[0-9]+)?)/)[1]);
				var discounted_price = (original_price - (original_price * localStorageHelpers.getValue(appid + "coupon_discount") / 100).toFixed(2)).toFixed(2);

				if (!(price_div.find(".game_purchase_discount").length > 0 && localStorageHelpers.getValue(appid + "coupon_discount_doesnt_stack"))) {
					$(price_div).html("<div class=\"game_purchase_action_bg\">" +
					"    <div class=\"discount_block game_purchase_discount\">" +
					"        <div class=\"discount_pct\">-" + localStorageHelpers.getValue(appid + "coupon_discount") + "%</div>" +
					"        <div class=\"discount_prices\">" +
					"            <div class=\"discount_original_price\">" + currency.format(original_price, currency_type) + "</div>" +
					"            <div class=\"discount_final_price\" itemprop=\"price\">" + currency.format(discounted_price, currency_type) + "</div>" +
					"        </div>" +
					"    </div>" +
					"<div class=\"btn_addtocart\">" +
					"        <a class=\"btnv6_green_white_innerfade btn_medium\" href=\"javascript:addToCart( " + cart_id + ");\"><span>" + language.add_to_cart + "</span></a>" +
					"    </div>" +
					"</div>");
				}
			}
		});
	}

	function show_pricing_history(appid, type) {

		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);

		if (userPrefs.showPriceHistory == true) {
			storestring = "steam,amazonus,impulse,gamersgate,greenmangaming,gamefly,origin,uplay,indiegalastore,gametap,gamesplanet,getgames,desura,gog,dotemu,gameolith,adventureshop,nuuvem,shinyloot,dlgamer,humblestore,squenix,bundlestars,fireflower,humblewidgets,newegg,gamesrepublic";

			// Get country code from Steam cookie
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

			function get_price_data(lookup_type, node, id) {

				var subids = "";
				$("input[name=subid]").each(function(index, value) {
					subids += value.value + ",";
				});
				subids = subids.replace(/,+$/, "");
				superSteamAsset.get("https://steamwatcher.com/boiler/prices/gamepricev2.php?subs=" + subids + "&appid=" + id + "&stores=" + storestring + "&cc=" + cc + "&coupon=true", function (txt) {
					var jsonString = JSON.stringify(txt)
					var data = JSON.parse(jsonString);

					if(txt === ""|txt === undefined){
						data = false;

					}else{
						data = JSON.parse(jsonString);
					}
					if (data) {

						var activates = "", line1 = "", line2 = "", line3 = "", html, recorded, currency_symbol, comma = false, at_end = false;
						var currency_type = data[".meta"]["currency"];

						switch (data[".meta"]["currency"]) {
							case "GBP":
							currency_symbol = "£";
							break;
							case "EUR":
							currency_symbol = "€";
							comma = true;
							at_end = true;
							break;
							case "BRL":
							currency_symbol = "R$ ";
							comma = true;
							break;
							default:
							currency_symbol = "$";
						}

						// "Lowest Price"
						if(!data[id]){
							return;
						}
						if (data[id]["price"]) {
							if (data[id]["price"]["drm"] == "steam") {
								activates = "(<b>" + escapeHTML(language.activates) + "</b>)";
								if (data[id]["price"]["store"] == "Steam") {
									activates = "";
								}
							}

							line1 = escapeHTML(language.lowest_price) + ': ' + currency.format(escapeHTML(data[id]["price"]["price"].toString()), currency_type) + ' at <a href="' + escapeHTML(data[id]["price"]["url"].toString()) + '" target="_blank">' + escapeHTML(data[id]["price"]["store"].toString()) + '</a> ' + activates + ' (<a href="' + escapeHTML(data[id]["urls"]["info"].toString()) + '" target="_blank">' + escapeHTML(language.info) + '</a>)';

							if (data[id]["price"]["price_voucher"]) {
								line1 = escapeHTML(language.lowest_price) + ': ' + currency.format(escapeHTML(data[id]["price"]["price_voucher"].toString()), currency_type) + ' at <a href="' + escapeHTML(data[id]["price"]["url"].toString()) + '" target="_blank">' + escapeHTML(data[id]["price"]["store"].toString()) + '</a> ' + escapeHTML(language.after_coupon) + ' <b>' + escapeHTML(data[id]["price"]["voucher"].toString()) + '</b> ' + activates + ' (<a href="' + escapeHTML(data[id]["urls"]["info"].toString()) + '" target="_blank">' + escapeHTML(language.info) + '</a>)';
							}
						}

						// "Historical Low"
						if (data[id]["lowest"]) {
							recorded = new Date(data[id]["lowest"]["recorded"]*1000);
							line2 = escapeHTML(language.historical_low) + ': ' + currency.format(escapeHTML(data[id]["lowest"]["price"].toString()), currency_type) + ' at ' + escapeHTML(data[id]["lowest"]["store"].toString()) + ' on ' + escapeHTML(recorded.toDateString()) + ' (<a href="' + escapeHTML(data[id]["urls"]["history"].toString()) + '" target="_blank">Info</a>)';
						}

						var html = "<div class='es_lowest_price' id='es_price_" + escapeHTML(id.toString()) + "'><div class='gift_icon' id='es_line_chart_" + escapeHTML(id.toString()) + "'><img src='" + assetUrls.img_line_chart + "'></div>";

						// "Number of times this game has been in a bundle"
						if (data[id]["bundles"]["count"] > 0) {
							line3 = "<br>" + escapeHTML(language.bundle.bundle_count) + ": " + data[id]["bundles"]["count"] + ' (<a href="' + escapeHTML(data[id]["urls"]["history"].toString()) + '" target="_blank">Info</a>)';
						}

						if (line1 && line2) {
							$(node).before(html + line1 + "<br>" + line2 + line3);
							$("#es_line_chart_" + id).css("top", (($("#es_price_" + id).outerHeight() - 20) / 2) + "px");
						}

						if (data[id]["bundles"]["live"].length > 0) {
							var length = data[id]["bundles"]["live"].length;
							for (var i = 0; i < length; i++) {
								var enddate;
								if (data[id]["bundles"]["live"][i]["expiry"]) {
									enddate = new Date(data[id]["bundles"]["live"][i]["expiry"]*1000);
								}
								var currentdate = new Date().getTime();
								if (!enddate || currentdate < enddate) {
									if (data[id]["bundles"]["live"][i]["page"]) { purchase = '<div class="game_area_purchase_game_wrapper"><div class="game_area_purchase_game"><div class="game_area_purchase_platform"></div><h1>' + language.buy + ' ' + data[id]["bundles"]["live"][i]["page"] + ' ' + data[id]["bundles"]["live"][i]["title"] + '</h1>'; }
									else { purchase = '<div class="game_area_purchase_game_wrapper"><div class="game_area_purchase_game"><div class="game_area_purchase_platform"></div><h1>' + language.buy + ' ' + data[id]["bundles"]["live"][i]["title"] + '</h1>'; }
									if (enddate) purchase += '<p class="game_purchase_discount_countdown">' + language.bundle.offer_ends + ' ' + enddate + '</p>';
									purchase += '<p class="package_contents"><b>' + language.bundle.includes.replace("(__num__)", data[id]["bundles"]["live"][i]["games"].length) + ':</b> '
									data[id]["bundles"]["live"][i]["games"].forEach(function(entry) {
										purchase += entry + ", ";
									});
									purchase = purchase.replace(/, $/, "");
									purchase += '</p><div class="game_purchase_action"><div class="game_purchase_action_bg"><div class="btn_addtocart btn_packageinfo"><div class="btn_addtocart_left"></div><a class="btn_addtocart_content" href="' + data[id]["bundles"]["live"][i]["details"] + '" target="_blank">' + language.bundle.info + '</a><div class="btn_addtocart_right"></div></div></div><div class="game_purchase_action_bg">';
									if (data[id]["bundles"]["live"][i]["price"] > 0) {
										if (data[id]["bundles"]["live"][i]["pwyw"]) {
											purchase += '<div class="es_each_box" itemprop="price">';
											purchase += '<div class="es_each">' + language.bundle.at_least + '</div><div class="es_each_price" style="text-align: right;">' + curency.format(escapeHTML(data[id]["bundles"]["live"][i]["price"].toString()), currency_type) + '</div>';
										} else {
											purchase += '<div class="game_purchase_price price" itemprop="price">';
											purchase += currency.format(escapeHTML(data[id]["bundles"]["live"][i]["price"].toString()), currency_type);
										}
									}
									purchase += '</div><div class="btn_addtocart"><div class="btn_addtocart_left"></div>';
									purchase += '<a class="btn_addtocart_content" href="' + data[id]["bundles"]["live"][i]["url"] + '" target="_blank">';
									purchase += language.buy;
									purchase += '</a><div class="btn_addtocart_right"></div></div></div></div></div></div>';
									$("#game_area_purchase").after(purchase);

									$("#game_area_purchase").after("<h2 class='gradientbg'>" + language.bundle.header + " <img src='http://cdn3.store.steampowered.com/public/images/v5/ico_external_link.gif' border='0' align='bottom'></h2>");
								}
							}
						}
					}
				});
			}

			switch (type) {
				case "app":
				get_price_data(type, $(".game_area_purchase_game_wrapper:first"), appid);

				$(".game_area_purchase_game_wrapper").not(".game_area_purchase_game_wrapper:first").each(function() {
					var subid = $(this).find("input[name=subid]").val();
					get_price_data("sub", $(this), subid);
				});
				break;
				case "sub":
				get_price_data(type, $(".game_area_purchase_game:first"), appid);
				break;
			}
		}
	}

	// Add Steam user review score
	function add_steamreview_userscore(appid) {
		if ($(".game_area_dlc_bubble,.noReviewsYetTitle").length === 0) {
			var positive = 0,
			negative = 0;

			positive = parseFloat($("#ReviewsTab_positive").find("span:last").text().replace(/\(|\)|,/g, ""));
			negative = parseFloat($("#ReviewsTab_negative").find("span:last").text().replace(/\(|\)|,/g, ""));

			var pos_percent = ((positive / (positive + negative)) * 100).toFixed(0),
			neg_percent = ((negative / (positive + negative)) * 100).toFixed(0);

			if (!isNaN(pos_percent) && !isNaN(neg_percent)) {
				$(".game_details").find(".details_block:first").before('<div id="es_review_score"><div style="display: inline-block; margin-right: 25px;"><img src="http://store.akamai.steamstatic.com/public/shared/images/userreviews/icon_thumbsUp_v6.png" width="24" height="24" class="es_review_image"><span class="es_review_text"> ' + pos_percent + '%</span></div><div style="display: inline-block;"><img src="http://store.akamai.steamstatic.com/public/shared/images/userreviews/icon_thumbsDown_v6.png" width="24" height="24" class="es_review_image"><span class="es_review_text"> ' + neg_percent + '%</span></div><div style="clear: both;"></div></div>');
			}
		}
	}
	//http://store.steampowered.com/app/208480/
	function add_hltb_info(appid) {

                        superSteamAsset.get("https://steamwatcher.com/boiler/howlong/beattime.php?appid=" + appid, function (txt) {

				if (txt.length > 0) {
					var data = JSON.parse(txt);

					if (data["hltb"]) {
						how_long_html = "<div class='block game_details underlined_links'>"
						+ "<div class='block_header'><h4>How Long to Beat</h4></div>"
						+ "<div class='block_content'><div class='block_content_inner'><div class='details_block'>";
						if (data["hltb"]["main_story"]){
							how_long_html += "<b>" + language.hltb.main + ":</b><span style='float: right;'>" + escapeHTML(data['hltb']['main_story']) + "</span><br>";
						}
						if (data["hltb"]["main_extras"]){
							how_long_html += "<b>" + language.hltb.main_e + ":</b><span style='float: right;'>" + escapeHTML(data['hltb']['main_extras']) + "</span><br>";
						}
						if (data["hltb"]["comp"]) {
							how_long_html += "<b>" + language.hltb.compl + ":</b><span style='float: right;'>" + escapeHTML(data['hltb']['comp']) + "</span><br>"
						}
						how_long_html += "</div>"
						+ "<a class='linkbar' href='" + escapeHTML(data['hltb']['url']) + "' target='_blank'>" + language.more_information + " <img src='http://cdn2.store.steampowered.com/public/images/v5/ico_external_link.gif' border='0' align='bottom'></a>"
						+ "<a class='linkbar' href='" + escapeHTML(data['hltb']['submit_url']) + "' target='_blank'>" + language.hltb.submit + " <img src='http://cdn2.store.steampowered.com/public/images/v5/ico_external_link.gif' border='0' align='bottom'></a>"
						+ "</div></div></div>";
						$("div.game_details:first").after(how_long_html);
					}
				}
			});
	}

	function add_pcgamingwiki_link(appid) {
		if (userPrefs.showPcGamingWikiLinks == true) {
			$('#ReportAppBtn').parent().prepend('<a class="btnv6_blue_hoverfade btn_medium pcgw_btn" target="_blank" href=http://pcgamingwiki.com/api/appid.php?appid=' + appid + ' style="display: block; margin-bottom: 6px;"><span><i class="ico16" style="background-image:url(' + assetUrls.img_pcgw + ')"></i>&nbsp;&nbsp; ' + language.wiki_article.replace("__pcgw__","PCGamingWiki") + '</span></a>');
		}
	}

	// Add link to Steam Card Exchange
	function add_steamcardexchange_link(appid){

		if ($(".icon").find('img[src$="/ico_cards.png"]').length > 0) {
			//Size of the icon?
			$("#ReportAppBtn").parent().prepend('<a class="btnv6_blue_hoverfade btn_medium cardexchange_btn" target="_blank" href="http://www.steamcardexchange.net/index.php?gamepage-appid-' + appid + '" style="display: block; margin-bottom: 6px;"><span><i class="ico16" style="background-image:url(' + chrome.extension.getURL("img/steamcardexchange_store.png") + ')"></i>&nbsp;&nbsp; ' + ' Steam Card Exchange</span></a>');
			//$("#demo_block").prepend('<a class="btnv6_blue_hoverfade btn_medium cardexchange_btn" target="_blank" href="http://www.steamcardexchange.net/index.php?gamepage-appid-' + appid + '" style="display: block; margin-bottom: 6px;"><span><i class="ico16" style="background-image:url(' + assetUrls.img_steamcardexchange_store + ')"></i>&nbsp;&nbsp; ' + language.view_in + ' Steam Card Exchange</span></a>');

		}
	}

	function add_widescreen_certification(appid) {
		if (userPrefs.showWidescreenInfo == true) {
			if (document.URL.indexOf("store.steampowered.com/app/") >= 0) {
				if (document.body.innerHTML.indexOf("<p>Requires the base game <a href=") <= 0) {
					// check to see if game data exists
					superSteamAsset.get("https://steamwatcher.com/boiler/widescreengaming/widescreen.php?appid=" + appid, function (txt) {
						$("div.game_details:first").each(function (index, node) {
							var data = JSON.parse(txt);
							if (data["node"]) {
								var path = data["node"]["Path"];
								var wsg = data["node"]["WideScreenGrade"];
								var mmg = data["node"]["MultiMonitorGrade"];
								var fkg = data["node"]["Grade4k"];
								var uws = data["node"]["UltraWideScreenGrade"];
								var wsg_icon = "", wsg_text = "", mmg_icon = "", mmg_text = "";
								var fkg_icon = "", fkg_text = "", uws_icon = "", uws_text = "";

								switch (wsg) {
									case "A":
									wsg_icon = assetUrls.img_wsgf_ws_gold;
									wsg_text = escapeHTML(language.wsgf.gold.replace(/__type__/g, "Widescreen"));
									break;
									case "B":
									wsg_icon = assetUrls.img_wsgf_ws_silver;
									wsg_text = escapeHTML(language.wsgf.silver.replace(/__type__/g, "Widescreen"));
									break;
									case "C":
									wsg_icon = assetUrls.img_wsgf_ws_limited;
									wsg_text = escapeHTML(language.wsgf.limited.replace(/__type__/g, "Widescreen"));
									break;
									case "Incomplete":
									wsg_icon = assetUrls.img_wsgf_ws_inc;
									wsg_text = escapeHTML(language.wsgf.incomplete);
									break;
									case "Unsupported":
									wsg_icon = assetUrls.img_wsgf_ws_uns;
									wsg_text = escapeHTML(language.wsgf.unsupported.replace(/__type__/g, "Widescreen"));
									break;
								}

								switch (mmg) {
									case "A":
									mmg_icon = assetUrls.img_wsgf_mm_gold;
									mmg_text = escapeHTML(language.wsgf.gold.replace(/__type__/g, "Multi-Monitor"));
									break;
									case "B":
									mmg_icon = assetUrls.img_wsgf_mm_silver;
									mmg_text = escapeHTML(language.wsgf.silver.replace(/__type__/g, "Multi-Monitor"));
									break;
									case "C":
									mmg_icon = assetUrls.img_wsgf_mm_limited;
									mmg_text = escapeHTML(language.wsgf.limited.replace(/__type__/g, "Multi-Monitor"));
									break;
									case "Incomplete":
									mmg_icon = assetUrls.img_wsgf_mm_inc;
									mmg_text = escapeHTML(language.wsgf.incomplete);
									break;
									case "Unsupported":
									mmg_icon = assetUrls.img_wsgf_mm_uns;
									mmg_text = escapeHTML(language.wsgf.unsupported.replace(/__type__/g, "Multi-Monitor"));
									break;
								}

								switch (uws) {
									case "A":
									uws_icon = assetUrls.img_wsgf_uw_gold;
									uws_text = escapeHTML(language.wsgf.gold.replace(/__type__/g, "Ultra-Widescreen"));
									break;
									case "B":
									uws_icon = assetUrls.img_wsgf_uw_silver;
									uws_text = escapeHTML(language.wsgf.silver.replace(/__type__/g, "Ultra-Widescreen"));
									break;
									case "C":
									uws_icon = assetUrls.img_wsgf_uw_limited;
									uws_text = escapeHTML(language.wsgf.limited.replace(/__type__/g, "Ultra-Widescreen"));
									break;
									case "Incomplete":
									uws_icon = assetUrls.img_wsgf_uw_inc;
									uws_text = escapeHTML(language.wsgf.incomplete);
									break;
									case "Unsupported":
									uws_icon = assetUrls.img_wsgf_uw_uns;
									uws_text = escapeHTML(language.wsgf.unsupported.replace(/__type__/g, "Ultra-Widescreen"));
									break;
								}

								switch (fkg) {
									case "A":
									fkg_icon = assetUrls.img_wsgf_4k_gold;
									fkg_text = escapeHTML(language.wsgf.gold.replace(/__type__/g, "4k UHD"));
									break;
									case "B":
									fkg_icon = assetUrls.img_wsgf_4k_silver;
									fkg_text = escapeHTML(language.wsgf.silver.replace(/__type__/g, "4k UHD"));
									break;
									case "C":
									fkg_icon = assetUrls.img_wsgf_4k_limited;
									fkg_text = escapeHTML(language.wsgf.limited.replace(/__type__/g, "4k UHD"));
									break;
									case "Incomplete":
									fkg_icon = assetUrls.img_wsgf_4k_inc;
									fkg_text = escapeHTML(language.wsgf.incomplete);
									break;
									case "Unsupported":
									fkg_icon = assetUrls.img_wsgf_4k_uns;
									fkg_text = escapeHTML(language.wsgf.unsupported.replace(/__type__/g, "4k UHD"));
									break;
								}

								var html = "<div class='block underlined_links'><div class='block_header'><h4>WSGF Widescreen Certifications</h4></div><div class='block_content'><div class='block_content_inner'><div class='details_block'><center>";

								if (wsg != "Incomplete") { html += "<a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(wsg_icon) + "' height='120' title='" + escapeHTML(wsg_text) + "' border=0></a>&nbsp;&nbsp;&nbsp;"; }
								if (mmg != "Incomplete") { html += "<a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(mmg_icon) + "' height='120' title='" + escapeHTML(mmg_text) + "' border=0></a>&nbsp;&nbsp;&nbsp;"; }
								if (uws != "Incomplete") { html += "<a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(uws_icon) + "' height='120' title='" + escapeHTML(uws_text) + "' border=0></a>&nbsp;&nbsp;&nbsp;"; }
								if (fkg != "Incomplete") { html += "<a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(fkg_icon) + "' height='120' title='" + escapeHTML(fkg_text) + "' border=0></a>&nbsp;&nbsp;&nbsp;"; }
								if (path) { html += "</center><br><a class='linkbar' target='_blank' href='" + escapeHTML(path) + "'>" + language.rating_details + " <img src='http://cdn2.store.steampowered.com/public/images/v5/ico_external_link.gif' border='0' align='bottom'></a>"; }
								html += "</div></div></div></div>";
								$(node).after(html);
							}
						});
					});
				}
			}
		}
	}

	function add_dlc_page_link(appid) {
		//The link is right, but it is displaying: Downloadable Content For This Game<a id="es_dlc_option_button">Options ▾</a>
		if ($(".game_area_dlc_section").length > 0) {
			var html = $(".game_area_dlc_section").html();
			title = html.match(/<h2 class=\"gradientbg">(.+)<\/h2>/)[1];
			//html = html.replace(title, "<a href='//store.steampowered.com/dlc/" + appid + "'>" + title + "</a>");
			html = html.replace(title, "<a href='http://store.steampowered.com/dlc/" + appid + "'>" + title + "</a>");

			$(".game_area_dlc_section").html(html);

		}
	}

	function add_app_badge_progress(appid) {
		if ($(".icon").find('img[src$="/ico_cards.png"]').length > 0) {
			$("#category_block").after("<div class='block'><div class='block_header'><h4>Badge Progress</h4></div><div class='block_content_inner'><link rel='stylesheet' type='text/css' href='http://cdn.steamcommunity.com/public/css/skin_1/badges.css'><div class='es_badge_progress'></div><div class='es_foil_badge_progress'></div></div>");
			$(".es_badge_progress").load("http://steamcommunity.com/my/gamecards/" + appid + "/ .badge_current", function(responseText) {
				if ($(responseText).find(".friendPlayerLevelNum").length != 1) {
					var card_num_owned = $(responseText).find(".badge_detail_tasks .owned").length;
					var card_num_total = $(responseText).find(".badge_detail_tasks .badge_card_set_card").length;
					var progress_text_length = $(responseText).find(".gamecard_badge_progress").text().trim().length;
					var next_level_empty_badge = $(responseText).find(".gamecard_badge_progress .badge_info").length;
					var show_card_num;
					var badge_completed;
					if(progress_text_length>0&&next_level_empty_badge==0){
						badge_completed=true;
					}
					if((card_num_owned>0&&progress_text_length==0)||(card_num_owned>0&&!badge_completed)){
						show_card_num=true;
					}
					if (badge_completed){
						$(".es_badge_progress").after("<div class='game_area_details_specs'><div class='icon'><img src='http://store.akamai.steamstatic.com/public/images/v6/ico/ico_cards.png' width=24 height=16 border=0 align=top></div><a href='http://steamcommunity.com/my/gamecards/" + appid + "/' class='name'>" + language.view_badge + "</a></div>");
					} else {
						$(".es_badge_progress").after("<div class='game_area_details_specs'><div class='icon'><img src='http://store.akamai.steamstatic.com/public/images/v6/ico/ico_cards.png' width=24 height=16 border=0 align=top></div><a href='http://steamcommunity.com/my/gamecards/" + appid + "/' class='name'>" + language.badge_progress + "</a></div>");
					}
					if(show_card_num){
						$(".es_badge_progress").after("<div style='padding-top: 2px; padding-bottom: 10px; margin-left: 44px; color: #67c1f5;'>" + language.cards_owned.replace("__owned__", card_num_owned).replace("__possible__", card_num_total) + "</div>");
					}
					$(".es_badge_progress").after("<div style='padding-top: 10px; padding-bottom: 10px; margin-left: 44px; color: #67c1f5;'>" + $(responseText).find(".progress_info_bold").text() + "</div>");
					$(".es_badge_progress").after("<div style=\"clear: both\"></div>");
					$(".es_badge_progress .badge_info_description").css({"width":"275px"});
					$(".es_badge_progress .badge_empty_circle").css({"margin":"0px 46px 14px 8px","border-radius":"46px"});
					$(".es_badge_progress .badge_empty_right div:last-child").remove();
					$(".es_badge_progress .badge_empty_right").append("<div class=\"badge_empty_name\">" + escapeHTML(language.badge_not_unlocked) + "</div>").append("<div style=\"clear: both\"></div>");
				} else {
					$(".es_badge_progress").remove();
				}
			});
			$(".es_foil_badge_progress").load("http://steamcommunity.com/my/gamecards/" + appid + "/?border=1 .badge_current", function(responseText) {
				if ($(responseText).find(".friendPlayerLevelNum").length != 1) {
					var card_num_owned = $(responseText).find(".badge_detail_tasks .owned").length;
					var card_num_total = $(responseText).find(".badge_detail_tasks .badge_card_set_card").length;
					var progress_text_length = $(responseText).find(".gamecard_badge_progress").text().trim().length;
					var next_level_empty_badge = $(responseText).find(".gamecard_badge_progress .badge_info").length;
					var show_card_num;
					var badge_completed;
					if(progress_text_length>0&&next_level_empty_badge==0){
						badge_completed=true;
					}
					if((card_num_owned>0&&progress_text_length==0)||(card_num_owned>0&&!badge_completed)){
						show_card_num=true;
					}
					if ($(responseText).find(".badge_empty_circle").length != 1||card_num_owned>0) {
						$(".es_foil_badge_progress .badge_info_description").css({"width":"275px"});
						$(".es_foil_badge_progress .badge_empty_circle").css({"margin":"0px 46px 14px 8px","border-radius":"46px"});
						$(".es_foil_badge_progress .badge_empty_right div:last-child").remove();
						$(".es_foil_badge_progress .badge_empty_right").append("<div class=\"badge_empty_name\">" + escapeHTML(language.badge_not_unlocked) + "</div>")
						if (badge_completed){
							$(".es_foil_badge_progress").after("<div class='game_area_details_specs'><div class='icon'><img src='http://store.akamai.steamstatic.com/public/images/v6/ico/ico_cards.png' width=24 height=16 border=0 align=top></div><a href='http://steamcommunity.com/my/gamecards/" + appid + "/' class='name'>" + language.view_badge_foil + "</a><div>");
						} else {
							$(".es_foil_badge_progress").after("<div class='game_area_details_specs'><div class='icon'><img src='http://store.akamai.steamstatic.com/public/images/v6/ico/ico_cards.png' width=24 height=16 border=0 align=top></div><a href='http://steamcommunity.com/my/gamecards/" + appid + "/' class='name'>" + language.badge_foil_progress + "</a><div>");
						}
						if(show_card_num){
							$(".es_foil_badge_progress").after("<div style='padding-top: 2px; padding-bottom: 10px; margin-left: 44px; color: #67c1f5;'>" + language.cards_owned.replace("__owned__", card_num_owned).replace("__possible__", card_num_total) + "</div>");
						}
						$(".es_foil_badge_progress").after("<div style=\"clear: both\"></div>");
					} else {
						$(".es_foil_badge_progress").remove();
					}
				} else {
					$(".es_foil_badge_progress").remove();
				}
			});
		}
	}

	// adds metacritic user score

	//There may be an issue with the Options system. The value for showMetaCriticScores always returns false.
	function add_metacritic_userscore() {
		var is_json_string = function (teststr){
			try {
				var jsonString = JSON.stringify(teststr);
				JSON.parse(jsonString);


			} catch (e){
				return false;
			}
			return true;
		}
		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);

		if (userPrefs.showMetaCriticScores === true) {
			if ($("#game_area_metascore")) {
				var metalink = $("#game_area_metalink").find("a").attr("href");
				if(!metalink){
					return;
				}else{
					superSteamAsset.get("https://steamwatcher.com/boiler/metacritic/metacriticuserrating.php?mcurl=" + metalink, function (txt) {
						var data = JSON.parse(txt);
						if(data == "0.0"){
							return;
						}
						var metauserscore = parseFloat(data)*10;
						var newmeta = '<div id="game_area_metascore" style="background-image: url(' + assetUrls.img_metacritic_bg + ');"><span>' + metauserscore + '</span><span class="ms_slash">/</span><span class="ms_base">100</span></div>';
						$("#game_area_metascore").after(newmeta);
					});
				}
			}
		}
	}

	// Check price savings when purchasing game bundles
	function subscription_savings_check() {
		var not_owned_games_prices = 0,
		$bundle_price = $(".package_totals_area").find(".price:last");

		setTimeout(function() {
			$.each($(".tab_item"), function (i, node) {
				var price_container = $(node).find(".discount_final_price").text().trim(),
				itemPrice = 0;

				if (price_container) {
					var price = currency.parse(price_container);
					if (price) itemPrice = price.value;
				}
				if ($(node).find(".ds_owned_flag").length === 0) {
					not_owned_games_prices += itemPrice;
				}
			});

			var bundle_price = currency.parse($bundle_price.text());
			if (bundle_price) {
				var corrected_price = not_owned_games_prices - bundle_price.value;
				var $message = $('<div class="savings">' + currency.format(corrected_price, bundle_price.currency_type) + '</div>');
				if ($("#package_savings_bar").length === 0) {
					$(".package_totals_area").append("<div id='package_savings_bar'><div class='savings'></div><div class='message'>" + language.bundle_saving_text + "</div></div>");
				}
				if (corrected_price < 0) $message[0].style.color = "red";
				$('.savings').replaceWith($message);
			}
		}, 500);
	}

	function add_market_total() {
		if (userPrefs.showTransactionSummary === true) {
			if (window.location.pathname.match(/^\/market\/$/)) {
				$("#moreInfo").before('<div id="es_summary"><div class="market_search_sidebar_contents"><h2 class="market_section_title">'+ escapeHTML(language.market_transactions) +'</h2><div class="market_search_game_button_group" id="es_market_summary" style="width: 238px"><img src="http://cdn.steamcommunity.com/public/images/login/throbber.gif">' + escapeHTML(language.loading) + '</div></div></div>');

				var pur_total = 0.0;
				var sale_total = 0.0;
				var currency_symbol = "";

				function get_market_data(txt) {
					var data = txt;
					market = data['results_html'];
					if (!currency_symbol) currency_symbol = currency.symbolFromString($(market).find(".market_listing_price").text().trim());

					pur_totaler = function (p, i) {
						if ($(p).find(".market_listing_price").length > 0) {
							if ($(p).find(".market_listing_gainorloss").text().trim() === "+") {
								var price = $(p).find(".market_listing_price").text().trim().match(/(\d+[.,]?\d+)/);
								if (price !== null) {
									var tempprice = price[0].toString();
									tempprice = tempprice.replace(/,(\d\d)$/, ".$1");
									tempprice = tempprice.replace(/,/g, "");
									return parseFloat(tempprice);
								}
							}
						}
					};

					sale_totaler = function (p, i) {
						if ($(p).find(".market_listing_price").length > 0) {
							if ($(p).find(".market_listing_gainorloss").text().trim() === "-") {
								var price = $(p).find(".market_listing_price").text().trim().match(/(\d+[.,]?\d+)/);
								if (price !== null) {
									var tempprice = price[0].toString();
									tempprice = tempprice.replace(/,(\d\d)$/, ".$1");
									tempprice = tempprice.replace(/,/g, "");
									return parseFloat(tempprice);
								}
							}
						}
					};

					pur_prices = $.map($(market), pur_totaler);
					sale_prices = $.map($(market), sale_totaler);

					$.map(pur_prices, function (p, i) { pur_total += p; });
					$.map(sale_prices, function (p, i) { sale_total += p; });
				}

				function show_results() {
					var currency_type = currency.symbolToType(currency_symbol);
					var net = sale_total - pur_total;

					var html = language.purchase_total + ":<span class='es_market_summary_item'>" + currency.format(parseFloat(pur_total), currency_type) + "</span><br>";
					html += language.sales_total + ":<span class='es_market_summary_item'>" + currency.format(parseFloat(sale_total), currency_type) + "</span><br>";
					if (net > 0) {
						html += language.net_gain + ":<span class='es_market_summary_item' style='color: green;'>" + currency.format(parseFloat(net), currency_type) + "</span>";
					} else {
						html += language.net_spent + ":<span class='es_market_summary_item' style='color: red;'>" + currency.format(parseFloat(net), currency_type) + "</span>";
					}

					$("#es_market_summary").html(html);
				}

				var start = 0;
				var count = 500;
				var i = 1;
				superSteamAsset.get("http://steamcommunity.com/market/myhistory/render/?query=&start=0&count=1", function (last_transaction) {
					var jsonString = JSON.stringify(last_transaction);
					var data = JSON.parse(jsonString);
					var total_count = data["total_count"];
					var loops = Math.ceil(total_count / count);

					if (loops) {
						while ((start + count) < (total_count + count)) {
							superSteamAsset.get("http://steamcommunity.com/market/myhistory/render/?query=&start=" + start + "&count=" + count, function (txt) {
								get_market_data(txt);
								if (i == loops) { show_results(); }
								i++;
							});
							start += count;
						}
					} else {
						show_results();
					}
				});
			}
		}
	}

	function add_active_total() {
		if (window.location.pathname.match(/^\/market\/$/)) {
		
		// Give proper IDs to each relevant DOM node
		$("#my_market_listingsonhold_number").parents(".my_listing_section").attr("id", "es_listingsonhold");
		$("#my_market_listingstoconfirm_number").parents(".my_listing_section").attr("id", "es_listingsawaiting");
		$("#my_market_selllistings_number").parents(".my_listing_section").attr("id", "es_selling");
		$("#my_market_buylistings_number").parents(".my_listing_section").attr("id", "es_buying");
		
		// Listings on hold
		var total = 0;
		var total_after = 0;	
		
		$("#es_listingsonhold .market_listing_row .market_listing_my_price").each(function() {			
			var temp = $(this).text().trim().replace(/pуб./g,"").replace(/,(\d\d(?!\d))/g, ".$1").replace(/[^0-9(\.]+/g,"").split("(");
			total += Number(temp[0]);
			total_after += Number(temp[1]);
			currency_symbol = currency.symbolFromString($(this).text().trim());
		});
		
                //console.log(total);
                //total for listings on hold popping up when no listings are on hold.  NEED TO FIX!
		if (total != 0) {
			var currency_type = currency.symbolToType(currency_symbol);
			total = currency.format(parseFloat(total), currency_type);
			total_after = currency.format(parseFloat(total_after), currency_type);
			$(".my_listing_section:first").append("<div class='market_listing_row market_recent_listing_row'><div class='market_listing_right_cell market_listing_edit_buttons'></div><div class='market_listing_my_price es_active_total'><span class='market_table_value><span class='market_listing_price'><span style='color: white'>" + total + "</span><br><span style='color: #AFAFAF'>(" + total_after + ")</span></span></span><br><span>" + escapeHTML(language.sales_total) + "</span></div></div>");
		
                    //jQuery(".market_listing_my_price:nth-child(4)").css( "border", "3px solid red" );
                    //jQuery(".market_recent_listing_row:nth-child(8)").after(".market_listing_row market_recent_listing_row listing_747961986475449495");
                    //jQuery("#mylisting_747961986475449495").insertAfter(".market_recent_listing_row");
                }




	// Sell listings		
		var total = 0;
		var total_after = 0;		
		$("#es_selling .market_listing_row .market_listing_my_price").each(function() {
			var temp = $(this).text().trim().replace(/pуб./g,"").replace(/,(\d\d(?!\d))/g, ".$1").replace(/[^0-9(\.]+/g,"").split("(");
			total += Number(temp[0]);
			total_after += Number(temp[1]);
		});
		
		if (total != 0) {
			total = currency.format(parseFloat(total));
			total_after = currency.format(parseFloat(total_after));
			$("#es_selling .market_recent_listing_row:last").clone().appendTo($("#es_selling .market_recent_listing_row:last").parent()).attr("id", "es_selling_total");
			$("#es_selling_total").find("img").remove();
			$("#es_selling_total").find(".market_listing_edit_buttons").empty();
			$("#es_selling_total").find(".market_listing_listed_date").empty();
			$("#es_selling_total").find(".market_listing_item_name_block").empty();
			$("#es_selling_total").find(".market_table_value").css("margin-top", "3px").css("margin-bottom", "3px");
			$("#es_selling_total").find(".market_listing_price").html("<span style='color: white'>" + total + "</span><br><span style='color: #AFAFAF'>(" + total_after + ")</span></span></span><br><span class='market_listing_game_name'>Sales Total</span>");
			// " + localized_strings.hold_total + "
			
		}

		/*
                var total = 0;
		
		$(".my_listing_section:nth-child(2)").find(".market_listing_row").find(".market_listing_my_price:first").each(function() {
			var qty = $(this).parent().find(".market_listing_my_price:last").text().trim();
			total += Number($(this).text().trim().replace(/pуб./g,"").replace(/,(\d\d(?!\d))/g, ".$1").replace(/[^0-9\.]+/g,"")) * Number(qty);
			currency_symbol = currency.symbolFromString($(this).text().trim());
		});
                */
               
                //Buying Total
                var total = 0;	
               
                $("#tabContentsMyListings .market_listing_table_header:eq(1) span:first").css("width","200px");
                $("#tabContentsMyListings .market_listing_table_header:eq(1) span:first").after("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>LOWEST</a></span>");

                $("#tabContentsMyListings .market_listing_table_header:eq(2) span:first").css("width","200px");
                $("#tabContentsMyListings .market_listing_table_header:eq(2) span:first").after("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>LOWEST</a></span>");

               
		$("#es_buying .market_listing_row").each(function() {
			var qty = $(this).find(".market_listing_my_price:last").text().trim();
			var price = currency.parse($(this).text().replace(/.+@/, "").trim());
			total += Number(price.value) * Number(qty);
		});
                              		
		if (total != 0) {
			total = currency.format(parseFloat(total));			
			$("#es_buying .market_recent_listing_row:last").clone().appendTo($("#es_buying .market_recent_listing_row:last").parent()).attr("id", "es_buying_total");
			$("#es_buying_total").find("img").remove();
                        //$("#tabContentsMyListings .market_listing_table_header span:first").after("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>" + language.lowest + "</a></span>");
			$("#es_buying_total").find(".market_listing_edit_buttons").empty();
			$("#es_buying_total").find(".market_listing_item_name_block").empty();
			$("#es_buying_total").find(".market_listing_buyorder_qty").empty();
			$("#es_buying_total").find(".market_table_value").css("margin-top", "3px").css("margin-bottom", "3px");
			$("#es_buying_total").find(".market_listing_price").html("<span style='color: white'>" + total + "</span><br><span class='market_listing_game_name'>" + language.buying_total + "</span>");
		}
                /*
                if (total != 0) {
			var currency_type = currency.symbolToType(currency_symbol);
			total = currency.format(parseFloat(total), currency_type);
			$(".my_listing_section:nth-child(2)").append("<div class='market_listing_row market_recent_listing_row'><div class='market_listing_right_cell market_listing_edit_buttons'></div><div class='market_listing_my_price es_active_total'><span class='market_listing_item_name' style='color: white'>" + escapeHTML(total) + "</span><br><span class='market_listing_game_name'>" + escapeHTML(language.buying_total) + "</span></div></div>");
		}
                */
            /*
            if (window.location.pathname.match(/^\/market\/$/)) {
			var total = 0;
			var total_after = 0;

			$(".market_listing_row").find(".market_listing_my_price").each(function() {
				var temp = $(this).text().trim().replace(/pуб./g,"").replace(/,(\d\d(?!\d))/g, ".$1").replace(/[^0-9(\.]+/g,"").split("(");
				total += Number(temp[0]);
				total_after += Number(temp[1]);
				currency_symbol = currency.symbolFromString($(this).text().trim());
			});

			if (total != 0) {
				var currency_type = currency.symbolToType(currency_symbol);
				total = currency.format(parseFloat(total), currency_type);
				total_after = currency.format(parseFloat(total_after), currency_type);
				$(".my_listing_section:nth-child(1)").append("<div class='market_listing_row market_recent_listing_row'><div class='market_listing_right_cell market_listing_edit_buttons'></div><div class='market_listing_my_price es_active_total'><span class='market_table_value><span class='market_listing_price'><span style='color: white'>" + total + "</span><br><span style='color: #AFAFAF'>(" + total_after + ")</span></span></span><br><span>" + escapeHTML(language.sales_total) + "</span></div></div>");
			}

			var total = 0;

			$(".market_listing_row").find(".market_listing_my_price:first").each(function() {
				var qty = $(this).parent().find(".market_listing_my_price:last").text().trim();
				//total += Number($(this).text().trim().replace(/pуб./g,"").replace(/,(\d\d(?!\d))/g, ".$1").replace(/[^0-9\.]+/g,"")) * Number(qty);
                                var price = Number($(this).text().replace(/.+@/, "").trim());
                                total += Number(price.value) * Number(qty);
				currency_symbol = currency.symbolFromString($(this).text().trim());
			});

                                                                      
			if (total != 0 && isNaN(total) === false && total != null) {
				var currency_type = currency.symbolToType(currency_symbol);
				total = currency.format(parseFloat(total), currency_type);
				$(".my_listing_section:nth-child(2)").append("<div class='market_listing_row market_recent_listing_row'><div class='market_listing_right_cell market_listing_edit_buttons'></div><div class='market_listing_my_price es_active_total'><span class='market_listing_item_name' style='color: white'>" + escapeHTML(total) + "</span><br><span class='market_listing_game_name'>" + escapeHTML(language.buying_total) + "</span></div></div>");
			}
                        
		}
            
            */
            
            
            
            }
	}

	// Show the lowest market price for items you're selling
	function add_lowest_market_price() {
		$("#tabContentsMyListings .market_listing_table_header span:first").css("width", "200px");
		$("#tabContentsMyListings .market_listing_table_header span:first").after("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>" + language.lowest + "</a></span>");
		//jQuery(".market_listing_table_header:eq(1)").css( "border", "3px solid red" );
                //$(".market_listing_table_header:eq(1)").prepend("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>" + language.lowest + "</a></span>");
                //jQuery("#tabContentsMyListings .market_listing_table_header:eq(1) span:first").after("<span class='market_listing_right_cell market_listing_my_price'><a class='es_market_lowest_button'>TEST</a></span>");
                                
                $("#tabContentsMyListings .market_listing_row").each(function() {
			$(this).find(".market_listing_edit_buttons").css("width", "200px");
			$(this).find(".market_listing_edit_buttons").after("<div class='market_listing_right_cell market_listing_my_price market_listing_es_lowest'>&nbsp;</div>");
		});

		function add_lowest_market_price_data() {
			var cc = "us";
			var currencyLocal = 1;
			if ($("#marketWalletBalanceAmount").length > 0) { currencyLocal = currency.parse($("#marketWalletBalanceAmount").text().trim()).currency_number; }

			// Get country code from Steam cookie
			var cookies = document.cookie;
			var matched = cookies.match(/fakeCC=([a-z]{2})/i);
			if (matched != null && matched.length == 2) {
				cc = matched[1];
			} else {
				matched = cookies.match(/steamCC(?:_\d+){4}=([a-z]{2})/i);
				if (matched != null && matched.length == 2) {
					cc = matched[1];
				}
			}

			$("#tabContentsMyListings .market_listing_row").each(function() {
				var node = $(this);
				var link = node.find(".market_listing_item_name_link").attr("href");
				if (link) {
					var appid = link.match(/\/(\d+)\/.+$/)[1];
					var market_hash_name = link.match(/\/\d+\/(.+)$/)[1];
					superSteamAsset.get("http://steamcommunity.com/market/priceoverview/?country=" + cc + "&currency=" + currencyLocal + "&appid=" + appid + "&market_hash_name=" + market_hash_name, function(json) {
						var data = json;
						if (data["success"]) {
							node.find(".market_listing_es_lowest").html(data["lowest_price"]);
							var my_price = currency.parse($(node).find(".market_listing_price span span:first").text().trim());
							var low_price = currency.parse(node.find(".market_listing_es_lowest").text());

							// Ours matches the lowest price
							if (my_price.value <= low_price.value) {
								node.find(".market_listing_es_lowest").addClass("es_percentage_lower");
							}

							// Our price is higher than the lowest price
							if (my_price.value > low_price.value) {
								node.find(".market_listing_es_lowest").addClass("es_percentage_higher");
							}
						}
					});
				}
			});
		}

		if ($("#tabContentsMyListings .market_listing_row").length < 11 ) {
			add_lowest_market_price_data();
		} else {
			$(".market_listing_es_lowest:first").html("<a class='es_market_lowest_button'><img src=http://store.akamai.steamstatic.com/public/images/v6/ico/ico_cloud.png height=24 style='margin-top: 13px;'></a>");
		}
		$(".es_market_lowest_button").click(function() {
			add_lowest_market_price_data();
		});
	
                //jQuery( ".market_listing_row" ).children().eq(7).remove();
                jQuery(".market_listing_my_price:nth-child(8)").remove();
        }


	function account_total_spent(){
		if (userPrefs.showTotalSpent === true) {
			if ($('.accountBalance').length !== 0) {
				currency.conversion.load(user_currency).done(function() {

					if (window.location.pathname.match("/account(/store_transactions)?/?$")) {

						$(".account_setting_block:first .account_setting_sub_block:nth-child(2)").prepend("<div id='es_total' class='es_loading' style='text-align: center;'><span>Loading...</span></div>");

						currency_symbol = currency.symbolFromString($(".accountBalance").text().trim());
						if (currency_symbol == "") { return; }
						local_currency = currency.symbolToType(currency_symbol);
						var game_total = 0,
						gift_total = 0,
						ingame_total = 0,
						market_total = 0;

						// Gather data
						function add_it_up(txt){
							var history = JSON.parse(txt);

							var history_html = $.parseHTML(history["html"]);
							if (history_html) {
								$.each(history_html, function(){
									var type = $(this).find(".wht_type div:first").text().trim(),
									amount = $(this).find(".wht_total").text().trim(),
									items = $(this).find(".wht_items").text().trim();

									if (amount && !amount.match("Credit") && type && !items.match("Wallet Credit")) {
										var parsed = currency.parse(amount),
										calc_value;
										if (parsed.currency_type != local_currency) {
											calc_value = currency.conversion.convert(parsed.value, parsed.currency_type, local_currency);
										} else {
											calc_value = parsed.value;
										}
										if (type.match(/^Purchase/)) game_total += calc_value;
										if (type.match("Market Transaction")) market_total += calc_value;
										if (type.match("Gift Purchase")) { gift_total += calc_value; }
										if (type.match("In-Game Purchase")) ingame_total += calc_value;
									}
								});
								return history["cursor"];
							}
						}

						var sessionid = $(".page_header_ctn").text().match(/g_sessionID = \"(.+)\";/)[1];
						var history_promise = (function () {
							var deferred = new $.Deferred();

							superSteamAsset.get("https://store.steampowered.com/account/AjaxLoadMoreHistory/?l=en&sessionid=" + sessionid, function(txt) {
								var next = add_it_up(JSON.stringify(txt));

								while (next) {
										$.ajax({
											async: false,
											url: "https://store.steampowered.com/account/AjaxLoadMoreHistory/?l=en&cursor%5Btimestamp_newest%5D=" + next["timestamp_newest"] + "&sessionid=" + sessionid
										}).done(function(data) {
											next = add_it_up(JSON.stringify(data));
										});
								}
								deferred.resolve();
							});
							return deferred.promise();
						})();

						$.when.apply($, [history_promise]).done(function() {
							var total_total = game_total + gift_total + ingame_total + market_total, html = '';

							if (game_total != 0) {
								game_total = currency.format(parseFloat(game_total), user_currency);
								html += '<div class="accountRow accountBalance">';
								html += '<div class="accountData price">' + game_total + '</div>';
								html += '<div class="accountLabel" style="text-align: left;">' + language.store_transactions + ':</div></div>';
							}

							if (gift_total != 0) {
								gift_total = currency.format(parseFloat(gift_total), user_currency);
								html += '<div class="accountRow accountBalance">';
								html += '<div class="accountData price">' + gift_total + '</div>';
								html += '<div class="accountLabel" style="text-align: left;">' + language.gift_transactions + ':</div></div>';
							}

							if (ingame_total != 0) {
								ingame_total = currency.format(parseFloat(ingame_total), user_currency);
								html += '<div class="accountRow accountBalance">';
								html += '<div class="accountData price">' + ingame_total + '</div>';
								html += '<div class="accountLabel" style="text-align: left;">' + language.game_transactions + ':</div></div>';
							}

							if (market_total != 0) {
								market_total = currency.format(parseFloat(market_total), user_currency);
								html += '<div class="accountRow accountBalance">';
								html += '<div class="accountData price">' + market_total + '</div>';
								html += '<div class="accountLabel" style="text-align: left;">' + language.market_transactions + ':</div></div>';
							}

							if (total_total != 0) {
								total_total = currency.format(parseFloat(total_total), user_currency);
								html += '<div class="inner_rule" style="margin: 5px 0px 5px 0px;"></div>';
								html += '<div class="accountRow accountBalance">';
								html += '<div class="accountData price">' + total_total + '</div>';
								html += '<div class="accountLabel" style="text-align: left;">' + language.total_spent + ':</div></div>';
							}

							$('#es_total').html(html);
						});
					}
				});
			}
		}
	}

	function inventory_market_prepare() {
		$("#es_market_helper").remove();
		var es_market_helper = document.createElement("script");
		es_market_helper.type = "text/javascript";
		es_market_helper.id = "es_market_helper";
		es_market_helper.textContent = '$("#inventories").on("click", ".itemHolder, .newitem", function() { window.postMessage({ type: "es_sendmessage", information: [iActiveSelectView,g_ActiveInventory.selectedItem.marketable,g_ActiveInventory.appid,g_ActiveInventory.selectedItem.market_hash_name,g_ActiveInventory.selectedItem.market_fee_app,g_ActiveInventory.selectedItem.type,g_ActiveInventory.selectedItem.id] }, "*"); });';
		document.documentElement.appendChild(es_market_helper);

		window.addEventListener("message", function(event) {
			if (event.data.type && (event.data.type == "es_sendmessage")) { inventory_market_helper(event.data.information); }
		}, false);
	}

	function inventory_market_helper(response) {
		var item = response[0];
		var marketable = response[1];
		var global_id = response[2];
		var hash_name = response[3];
		var appid = response[4];
		var assetID = response[6];
		var gift = false;
		if (response[5] && response[5].match(/Gift/)) gift = true;
		var html;

		if (gift) {
			$("#es_item" + item).remove();
			if ($("#iteminfo" + item + "_item_actions").find("a").length > 0) {
				var gift_appid = get_appid($("#iteminfo" + item + "_item_actions").find("a")[0].href);
				superSteamAsset.get("http://store.steampowered.com/api/appdetails/?appids=" + gift_appid + "&filters=price_overview", function(txt) {
					var data = JSON.parse(txt);
					if (data[gift_appid].success && data[gift_appid]["data"]["price_overview"]) {
						var currency = data[gift_appid]["data"]["price_overview"]["currency"];
						var discount = data[gift_appid]["data"]["price_overview"]["discount_percent"];
						var price = currency.format(data[gift_appid]["data"]["price_overview"]["final"] / 100, currency);

						$("#iteminfo" + item + "_item_actions").css("height", "50px");
						if (discount > 0) {
							var original_price = currency.format(data[gift_appid]["data"]["price_overview"]["initial"] / 100, currency);
							$("#iteminfo" + item + "_item_actions").append("<div class='es_game_purchase_action' style='float: right;'><div class='es_game_purchase_action_bg'><div class='es_discount_block es_game_purchase_discount'><div class='es_discount_pct'>-" + discount + "%</div><div class='es_discount_prices'><div class='es_discount_original_price'>" + original_price + "</div><div class='es_discount_final_price'>" + price + "</div></div></div></div>");
						} else {
							$("#iteminfo" + item + "_item_actions").append("<div class='es_game_purchase_action' style='float: right;'><div class='es_game_purchase_action_bg'><div class='es_game_purchase_price es_price'>" + price + "</div></div>");
						}
					}
				});
			}
		} else {
			if ($(".profile_small_header_name .whiteLink").attr("href") !== $(".playerAvatar").find("a").attr("href")) {
				if ($('#es_item0').length == 0) { $("#iteminfo0_item_market_actions").after("<div class='item_market_actions es_item_action' id=es_item0></div>"); }
				if ($('#es_item1').length == 0) { $("#iteminfo1_item_market_actions").after("<div class='item_market_actions es_item_action' id=es_item1></div>"); }
				$('.es_item_action').html("");

				if (marketable == 0) { $('.es_item_action').remove(); return; }
				$("#es_item" + item).html("<img src='http://cdn.steamcommunity.com/public/images/login/throbber.gif'><span>"+ language.loading+"</span>");

				function inventory_market_helper_get_price(url) {
					superSteamAsset.get(url, function (txt) {
						data = JSON.parse(txt);
						$("#es_item" + item).html("");
						if (data.success) {
							html = "<div><div style='height: 24px;'><a href='http://steamcommunity.com/market/listings/" + global_id + "/" + hash_name + "'>" + language.view_in_market + "</a></div>";
							html += "<div style='min-height: 3em; margin-left: 1em;'>" + language.starting_at + ": " + data.lowest_price;
							if (data.volume) {
								html += "<br>" + language.last_24.replace("__sold__", data.volume);
							}

							$("#es_item" + item).html(html);
						} else {
							$("#es_item" + item).remove();
						}
					});
				}

				if (localStorageHelpers.getValue("steam_currency_number")) {
					inventory_market_helper_get_price("http://steamcommunity.com/market/priceoverview/?currency=" + localStorageHelpers.getValue("steam_currency_number") + "&appid=" + global_id + "&market_hash_name=" + hash_name);
				} else {
					superSteamAsset.get("http://store.steampowered.com/app/220/", function(txt) {
						var currency = currency.parse($(txt).find(".price, .discount_final_price").text().trim());
						localStorageHelpers.setValue("steam_currency_number", currency.currency_number);
						inventory_market_helper_get_price("http://steamcommunity.com/market/priceoverview/?currency=" + currency.currency_number + "&appid=" + global_id + "&market_hash_name=" + hash_name);
					});
				}
			} else {
				if (hash_name && hash_name.match(/Booster Pack/g)) {
					setTimeout(function() {
						var currency = currency.parse($("#iteminfo" + item + "_item_market_actions").text().match(/\:(.+)/)[1]);
						var api_url = "https://steamwatcher.com/boiler/martketdata/averagecardprice.php?appid=" + appid + "&cur=" + currency.currency_type.toLowerCase();
						superSteamAsset.get(api_url, function(price_data) {
							var booster_price = parseFloat(price_data,10) * 3;
							html = language.avg_price_3cards + ": " + currency.format(booster_price, currency.currency_type) + "<br>";
							$("#iteminfo" + item + "_item_market_actions").find("div:last").css("margin-bottom", "8px");
							$("#iteminfo" + item + "_item_market_actions").find("div:last").append(html);
						});
					}, 1000);
				}
				//may have to remove this
			}
		}
	}

	function hide_empty_inventory_tabs() {
		var tab_count = 0;
		$('div.games_list_tabs > a[id^="inventory_link_"]').each(function() {
			var separator = $(this).next('div[class^="games_list_tab_"]');
			$(this).removeClass('first_tab fourth_tab');
			if (parseInt($(this).children('span.games_list_tab_number').html().replace(/,/g, '').match(/\d+/)[0]) == 0) {
				$(this).hide();
				separator.hide();
			} else {
				tab_count += 1;
			}

			tab_count == 1 && $(this).addClass('first_tab');
			tab_count == 4 && $(this).addClass('fourth_tab');
			separator.removeClass().addClass(((tab_count > 0) && (tab_count%4 == 0)) ? 'games_list_tab_row_separator' : 'games_list_tab_separator');
		});
	}


		function hide_age_gate(appid){
			if($("#app_agegate").length){
				document.cookie = 'mature_content=1; path=/app/'+appid+';';
				document.location = "http:\/\/store.steampowered.com\/app\/"+appid+"\/";
			}

		}

	function add_badge_crafting_completion() {
		//$('#active_inventory_page').before("<div style='height:200px;'>testing</div>");
		//need to add space here to add output for stats and what badges you can craft
		//will look through list of all cards user owns in "inventory stats-->context 6"
		//will then check each game page for cards owned via ajax and determine if the craft badge button is present
		//if craft badge button is present-->will add button to page so the user will know they can craft badge for whatever game
		//need to reset loaded storage for cards that are no longer present and re-index for new coupons and emoticons that were yielded
		//need to make sure the "crafting" animation can show on the page so the user knows he is crafting
		//
	}

	function buy_all_missing_cards_for_badge() {
		//index each card the user has
		//determine all appids for all of the cards user has
		//send array of all appids to server and get return of total count of cards
		//probably need to start updating this database more often
		//
		//we can pinwheel in the box until this info comes back
		//we can also store it in local storage-->can store
		//as the responses come back
		//we can see what cards the user has and doesnt have
		//
	}
        

        function click_through_mature_filter() {
            if($("#age_gate_btn_continue").length){
               $("#age_gate_btn_continue").click();
            }
        }

	// Add SteamDB links to pages
	function add_steamdb_links(appid, type) {
		if (userPrefs.showSteamDbLinks === true) {
			switch (type) {
				case "gamehub":
				$(".apphub_OtherSiteInfo").append('<a class="btnv6_blue_hoverfade btn_medium steamdb_ico" target="_blank" href="http://steamdb.info/app/' + appid + '/"><span><i class="ico16" style="background-image:url(' + assetUrls.img_steamdb_store + ')"></i>&nbsp; Steam Database</span></a>');
				break;
				case "gamegroup":
				$('#rightActionBlock' ).append('<div class="actionItemIcon"><img src="' + superSteamAsset.get("img/steamdb.png") + '" width="16" height="16" alt=""></div><a class="linkActionMinor" target="_blank" href="http://steamdb.info/app/' + appid + '/">' + language.view_in + ' Steam Database</a>');
				break;
				case "app":
				$('#ReportAppBtn').parent().prepend('<a class="btnv6_blue_hoverfade btn_medium steamdb_ico" target="_blank" href="http://steamdb.info/app/' + appid + '/" style="display: block; margin-bottom: 6px;"><span><i class="ico16" style="background-image:url(' + assetUrls.img_steamdb_store + ')"></i>&nbsp; &nbsp;' + language.view_in + ' Steam Database</span></a>');
				break;
				case "sub":
				$(".share").before('<a class="btnv6_blue_hoverfade btn_medium steamdb_ico" target="_blank" href="http://steamdb.info/sub/' + appid + '/" style="display: block; margin-bottom: 6px;"><span><i class="ico16" style="background-image:url(' + assetUrls.img_steamdb_store + ')"></i>&nbsp; &nbsp;' + language.view_in + ' Steam Database</span></a>');
				break;
			}

			$(".steamdb_ico").hover(
				function() {
					$(this).find("i").css("background-image", "url(" + assetUrls.img_steamdb_store_black + ")");
				}, function() {
					$(this).find("i").css("background-image", "url(" + assetUrls.img_steamdb_store + ")");
				}
			)
		}
	}

	function add_familysharing_warning(appid) {
		var exfgls_appids, exfgls_promise = (function () {
			var deferred = new $.Deferred();
			if (window.location.protocol != "https:") {
				// is the data cached?
				var expire_time = parseInt(Date.now() / 1000, 10) - 8 * 60 * 60;
				var last_updated = localStorageHelpers.getValue("exfgls_appids_time") || expire_time - 1;

				if (last_updated < expire_time) {
					// if no cache exists, pull the data from the website
					superSteamAsset.get("https://steamwatcher.com/boiler/exfgls/familysharewarning.php", function(txt) {
						exfgls_appids = txt;
						localStorageHelpers.setValue("exfgls_appids", exfgls_appids);
						localStorageHelpers.setValue("exfgls_appids_time", parseInt(Date.now() / 1000, 10));
						deferred.resolve();
					});
				} else {
					exfgls_appids = localStorageHelpers.getValue("exfgls_appids");
					deferred.resolve();
				}

				return deferred.promise();
			} else {
				deferred.resolve();
				return deferred.promise();
			}
		})();

		exfgls_promise.done(function(){
			var exfgls = JSON.parse(localStorageHelpers.getValue("exfgls_appids"));
			if (exfgls["exfgls"].indexOf(appid) >= 0) {
				$("#game_area_purchase").before('<div id="purchase_note"><div class="notice_box_top"></div><div class="notice_box_content">' + language.family_sharing_notice + '</div><div class="notice_box_bottom"></div></div>');
			}
		});
	}

	// Adds red warnings for 3rd party DRM
	function drm_warnings(type) {
		if (userPrefs.show3rdPartyDrmWarnings === true) {
			var gfwl;
			var uplay;
			var securom;
			var tages;
			var stardock;
			var rockstar;
			var kalypso;
			var drm;

			var text = $("#game_area_description").html();
			text += $(".game_area_sys_req").html();
			text += $("#game_area_legal").html();
			text += $(".game_details").html();
			text += $(".DRM_notice").html();


			// Games for Windows Live detection
			if (text.toUpperCase().indexOf("GAMES FOR WINDOWS LIVE") > 0) { gfwl = true; }
			if (text.toUpperCase().indexOf("GAMES FOR WINDOWS - LIVE") > 0) { gfwl = true; }
			if (text.indexOf("Online play requires log-in to Games For Windows") > 0) { gfwl = true; }
			if (text.indexOf("INSTALLATION OF THE GAMES FOR WINDOWS LIVE SOFTWARE") > 0) { gfwl = true; }
			if (text.indexOf("Multiplayer play and other LIVE features included at no charge") > 0) { gfwl = true; }
			if (text.indexOf("www.gamesforwindows.com/live") > 0) { gfwl = true; }

			// Ubisoft Uplay detection
			if (text.toUpperCase().indexOf("CREATION OF A UBISOFT ACCOUNT") > 0) { uplay = true; }
			if (text.toUpperCase().indexOf("UPLAY") > 0) { uplay = true; }

			// Securom detection
			if (text.toUpperCase().indexOf("SECUROM") > 0) { securom = true; }

			// Tages detection
			if (text.match(/\btages\b/i)) { tages = true; }
			if (text.match(/angebote des tages/i)) { tages = false; }
			if (text.match("/\bsolidshield\b/i")) { tages = true; }

			// Stardock account detection
			if (text.indexOf("Stardock account") > 0) { stardock = true; }

			// Rockstar social club detection
			if (text.indexOf("Rockstar Social Club") > 0) { rockstar = true; }
			if (text.indexOf("Rockstar Games Social Club") > 0) { rockstar = true; }

			// Kalypso Launcher detection
			if (text.indexOf("Requires a Kalypso account") > 0) { kalypso = true; }

			// Detect other DRM
			if (text.indexOf("3rd-party DRM") > 0) { drm = true; }
			if (text.indexOf("No 3rd Party DRM") > 0) { drm = false; }

			var string_type;
			var drm_string = "(";
			if (type == "app") { string_type = language.drm_third_party; } else { string_type = language.drm_third_party_sub; }

			if (gfwl) { drm_string += 'Games for Windows Live, '; drm = true; }
			if (uplay) { drm_string += 'Ubisoft Uplay, '; drm = true; }
			if (securom) { drm_string += 'SecuROM, '; drm = true; }
			if (tages) { drm_string += 'Tages, '; drm = true; }
			if (stardock) { drm_string += 'Stardock Account Required, '; drm = true; }
			if (rockstar) { drm_string += 'Rockstar Social Club, '; drm = true; }
			if (kalypso) { drm_string += "Kalypso Launcher, "; drm = true; }

			if (drm_string == "(") {
				drm_string = "";
			} else {
				drm_string = drm_string.substring(0, drm_string.length - 2);
				drm_string += ")";
			}

			if (drm) {
				if ($("#game_area_purchase").find(".game_area_description_bodylabel").length > 0) {
					$("#game_area_purchase").find(".game_area_description_bodylabel").after('<div class="game_area_already_owned es_drm_warning" style="background-image: url( ' + assetUrls.img_game_area_warning + ' );"><span>' + string_type + ' ' + drm_string + '</span></div>');
				} else {
					$("#game_area_purchase").prepend('<div class="game_area_already_owned es_drm_warning" style="background-image: url( ' + assetUrls.img_game_area_warning + ' );"><span>' + string_type + ' ' + drm_string + '</span></div>');
				}
			}
		}
	}

	function add_carousel_descriptions() {
		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);
		if (userPrefs.showAppDescription == true) {
			if ($(".main_cluster_content").length > 0) {
				var description_height_to_add = 62;

				heightvar = parseInt($(".main_cluster_content").css("height").replace("px", ""), 10) + description_height_to_add + "px";
				$(".main_cluster_content").css("height", heightvar);
				$("#main_cluster_scroll .cluster_capsule").css("height", heightvar);
				$("#main_cluster_scroll .discount_block").css("bottom", "98px");
				setTimeout(function() {
					$(".cluster_capsule").each(function(i, _obj) {
						var appid = get_appid(_obj.href),
						$desc = $(_obj).find(".main_cap_content"),
						$desc_content = $("<p></p>");

						$desc.css("height", parseInt($desc.css("height").replace("px", ""), 10) + description_height_to_add + "px");
						$desc.parent().css("height", parseInt($desc.parent().css("height").replace("px", ""), 10) + description_height_to_add + "px");

						var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
						var last_updated = localStorageHelpers.getValue(appid + "carousel_time") || expire_time - 1;

						if (last_updated < expire_time) {
							superSteamAsset.get('http://store.steampowered.com/app/' + appid, function(txt) {
								var desc = txt.match(/textarea name="w_text" placeholder="(.+)" maxlength/);
								if (desc) {
									localStorageHelpers.setValue(appid + "carousel", desc[1]);
									localStorageHelpers.setValue(appid + "carousel_time", parseInt(Date.now() / 1000, 10));
									var value_to_add = "<div class='main_cap_status' style='font-size: 12px; line-height: normal;'>" + desc[1] + "</div>";
									$desc.append(value_to_add);
									var heightOfMainClusterScroll = $("#main_cluster_scroll").height();
									$("#main_cluster_scroll").css("height",heightOfMainClusterScroll+100);
								}
							});
						}
						else {
							var desc = localStorageHelpers.getValue(appid + "carousel");
							var value_to_add = "<div class='main_cap_status' style='font-size: 12px; line-height: normal;'>" + desc + "</div>";
							$desc.append(value_to_add);
							var heightOfMainClusterScroll = $("#main_cluster_scroll").height();
							$("#main_cluster_scroll").css("height",heightOfMainClusterScroll+100);
						}
					});
				}, 750);

				// purge stale information from localStorage
				var i = 0, sKey;
				for (; sKey = window.localStorage.key(i); i++) {
					if (sKey.match(/carousel_time/)) {
						var expire_time = parseInt(Date.now() / 1000, 10) - 8 * 60 * 60; // Eight hours ago
						var last_updated = window.localStorage.getItem(sKey) || expire_time - 1;

						if (last_updated < expire_time) {
							var appid = sKey.match(/\d+/)[0];

							delValue(appid + "carousel");
							delValue(appid + "carousel_time");

						}
					}
				}
			}
		}
	}

	var processing = false;
	var search_page = 2;

	function load_search_results () {
		if (!processing) {
			processing = true;
			var search = document.URL.match(/(.+)\/(.+)/)[2].replace(/\&page=./, "").replace(/\#/g, "&");
			if ($(".LoadingWrapper").length === 0) {
				$(".search_pagination:last").before('<div class="LoadingWrapper"><div class="LoadingThrobber" style="margin-bottom: 15px;"><div class="Bar Bar1"></div><div class="Bar Bar2"></div><div class="Bar Bar3"></div></div><div id="LoadingText">' + language.loading + '</div></div>');
			}
			$.ajax({
				url: 'http://store.steampowered.com/search/results' + search + '&page=' + search_page + '&snr=es'
			}).success(function(txt) {
				var html = $.parseHTML(txt);
				html = $(html).find("a.search_result_row");

				var added_date = +new Date();
				$('#search_result_container').attr('data-last-add-date', added_date);
				html.attr('data-added-date', added_date);

				$(".LoadingWrapper").remove();
				$(".search_result_row").last().after(html);
				search_page = search_page + 1;
				processing = false;

				var ripc = function () {
					var added_date = $('#search_result_container').attr('data-last-add-date');
					GDynamicStore.DecorateDynamicItems($('.search_result_row[data-added-date="' + added_date + '"]'));
					BindStoreTooltip($('.search_result_row[data-added-date="' + added_date + '"] [data-store-tooltip]'));
				};

				runInPageContext(ripc);
			}).error(function() {
				$(".LoadingWrapper").remove();
				$(".search_pagination:last").before("<div style='text-align: center; margin-top: 16px;' id='es_error_msg'>" + language.search_error + ". <a id='es_retry' style='cursor: pointer;'>" + language.search_error_retry + ".</a></div>");

				$("#es_retry").click(function() {
					processing = false;
					$("#es_error_msg").remove();
					load_search_results();
				});
			});
		}
	}

	function is_element_in_viewport($elem) {
		// only concerned with vertical at this point
		var elem_offset = $elem.offset(),
		elem_bottom = elem_offset.top + $elem.height(),
		viewport_top = $(window).scrollTop(),
		viewport_bottom = window.innerHeight + viewport_top;

		return (elem_bottom <= viewport_bottom && elem_offset.top >= viewport_top);
	}

	function endless_scrolling() {

		if (userPrefs.enableSearchResultsInfinteScroll == true) {
			if (!(window.location.href.match(/auction=1/))) {
				var result_count;
				$(document.body).append('<link rel="stylesheet" type="text/css" href="http://store.akamai.steamstatic.com/public/css/v6/home.css">');
				$(".search_pagination_right").css("display", "none");
				if ($(".search_pagination_left").text().trim().match(/(\d+)$/)) {
					result_count = $(".search_pagination_left").text().trim().match(/(\d+)$/)[0];
					$(".search_pagination_left").text(result_count + " Results");
				}

				$(window).scroll(function() {
					// if the pagination element is in the viewport, continue loading
					if (is_element_in_viewport($(".search_pagination_left"))) {
						if (result_count > $('.search_result_row').length) {
							load_search_results();
						} else {
							$(".search_pagination_left").text('All ' + result_count + ' results displayed');
						}
					}
				});
			}
		}
	}

	function add_hide_button_to_search() {
		$("#advsearchform").find(".rightcol").prepend("<div class='block' id='es_hide_menu'><div class='block_header'><div>" + language.hide + "</div></div><div class='block_content block_content_inner'><div class='tab_filter_control' id='es_owned_games'><div class='tab_filter_control_checkbox'></div><span class='tab_filter_control_label'>" + language.options.owned + "</span></div><div class='tab_filter_control' id='es_wishlist_games'><div class='tab_filter_control_checkbox'></div><span class='tab_filter_control_label'>" + language.options.wishlist + "</span></div><div class='tab_filter_control' id='es_cart_games'><div class='tab_filter_control_checkbox'></div><span class='tab_filter_control_label'>" + language.options.cart + "</span></div><div class='tab_filter_control' id='es_notdiscounted'><div class='tab_filter_control_checkbox'></div><span class='tab_filter_control_label'>" + language.notdiscounted + "</span></div><div class='tab_filter_control' id='es_notinterested'><div class='tab_filter_control_checkbox'></div><span class='tab_filter_control_label'>" + language.notinterested + "</span></div></div></div>");

		if (localStorageHelpers.getValue("hide_owned")) {
			$("#es_owned_games").addClass("checked");
		}

		if (localStorageHelpers.getValue("hide_wishlist")) {
			$("#es_wishlist_games").addClass("checked");
		}

		if (localStorageHelpers.getValue("hide_cart")) {
			$("#es_cart_games").addClass("checked");
		}

		if (localStorageHelpers.getValue("hide_nondiscounts")) {
			$("#es_notdiscounted").addClass("checked");
		}

		if (localStorageHelpers.getValue("hide_notinterested")) {
			$("#es_notinterested").addClass("checked");
		}

		function add_hide_buttons_to_search_click() {
			$(".search_result_row").each(function() {
				$(this).css("display", "block");
				if ($("#es_owned_games").is(".checked") && $(this).is(".ds_owned")) { $(this).css("display", "none"); }
				if ($("#es_wishlist_games").is(".checked") && $(this).is(".ds_wishlist")) { $(this).css("display", "none"); }
				if ($("#es_cart_games").is(".checked") && $(this).is(".ds_incart")) { $(this).css("display", "none"); }
				if ($("#es_notdiscounted").is(".checked") && $(this).find(".search_discount").children("span").length == 0) { $(this).css("display", "none"); }
				if ($("#es_notinterested").is(".checked")) { highlight_notinterested(this); }
			});
		}

		$("#es_owned_games").click(function() {
			if ($("#es_owned_games").hasClass("checked")) {
				$("#es_owned_games").removeClass("checked");
				localStorageHelpers.setValue("hide_owned", false);
			} else {
				$("#es_owned_games").addClass("checked");
				localStorageHelpers.setValue("hide_owned", true);
			}
			add_hide_buttons_to_search_click();
		});

		$("#es_wishlist_games").click(function() {
			if ($("#es_wishlist_games").hasClass("checked")) {
				$("#es_wishlist_games").removeClass("checked");
				localStorageHelpers.setValue("hide_wishlist", false);
			} else {
				$("#es_wishlist_games").addClass("checked");
				localStorageHelpers.setValue("hide_wishlist", true);
			}
			add_hide_buttons_to_search_click();
		});

		$("#es_cart_games").click(function() {
			if ($("#es_cart_games").hasClass("checked")) {
				$("#es_cart_games").removeClass("checked");
				localStorageHelpers.setValue("hide_cart", false);
			} else {
				$("#es_cart_games").addClass("checked");
				localStorageHelpers.setValue("hide_cart", true);
			}
			add_hide_buttons_to_search_click();
		});

		$("#es_notdiscounted").click(function() {
			if ($("#es_notdiscounted").hasClass("checked")) {
				$("#es_notdiscounted").removeClass("checked");
				localStorageHelpers.setValue("hide_nondiscounts", false);
			} else {
				$("#es_notdiscounted").addClass("checked");
				localStorageHelpers.setValue("hide_nondiscounts", true);
			}
			add_hide_buttons_to_search_click();
		});

		$("#es_notinterested").click(function() {
			if ($("#es_notinterested").hasClass("checked")) {
				$("#es_notinterested").removeClass("checked");
				localStorageHelpers.setValue("hide_notinterested", false);
			} else {
				$("#es_notinterested").addClass("checked");
				localStorageHelpers.setValue("hide_notinterested", true);
			}
			add_hide_buttons_to_search_click();
		});
	}

	function add_popular_tab() {
		$(".home_tabs_row").find(".home_tab:last").after("<div class='home_tab' id='es_popular'><div class='tab_content'>" + language.popular + "</div></div>");
		var tab_html = "<div id='tab_popular_content' class='tab_content' style='display: none;'>";

		$(".home_tabs_content").append(tab_html);

		$("#es_popular").on("click", function() {
			$(".home_tabs_row").find(".active").removeClass("active");
			$(".home_tabs_content").find(".tab_content").hide();
			$("#es_popular").addClass("active");
			$("#tab_popular_content").show();

			if ($("#tab_popular_content").find("div").length == 0) {
				superSteamAsset.get("http://store.steampowered.com/stats", function(txt) {
					var return_text = $.parseHTML(txt);
					var i = 0;
					$(return_text).find(".player_count_row").each(function() {
						if (i < 10) {
							var appid = get_appid($(this).find("a").attr("href"));
							var game_name = $(this).find("a").text();
							var currently = $(this).find(".currentServers:first").text();
							var html = "<div class='tab_item app_impression_tracked' data-ds-appid='" + appid + "' onmouseover='GameHover( this, event, \"global_hover\", {\"type\":\"app\",\"id\":\"" + appid + "\",\"public\":0,\"v6\":1} );' onmouseout='HideGameHover( this, event, \"global_hover\" )' id='tab_row_popular_" + appid + "'>";
							html += "<a class='tab_item_overlay' href='http://store.steampowered.com/app/" + appid + "/?snr=1_4_4__106'><img src='http://store.akamai.steamstatic.com/public/images/blank.gif'></a><div class='tab_item_overlay_hover'></div>";
							html += "<img class='tab_item_cap' src='http://cdn.akamai.steamstatic.com/steam/apps/" + appid + "/capsule_184x69.jpg'>";
							html += "<div class='tab_item_content'><div class='tab_item_name'>" + game_name + "</div><div class='tab_item_details'>" + currently + " " + language.charts.playing_now + "</div><br clear='all'></div>";

							html += "</div>";
							$("#tab_popular_content").append(html);
							i++;
						}
					});
					$("#tab_popular_content").append("<div class='tab_see_more'>See more: <a href='http://store.steampowered.com/stats/' class='btnv6_blue_hoverfade btn_small_tall'><span>Popular Games</span></a></div>");
				});
			}
		});
	}

	//we should think about adding tabs nn
	function add_allreleases_tab() {
		var button_text = $("#tab_newreleases_content").find(".tab_see_more a:last").text();
		$(".home_tabs_row").find(".home_tab:first").after("<div class='home_tab' id='es_allreleases'><div class='tab_content'>" + button_text + "</div></div>");
		var tab_html = "<div id='tab_allreleases_content' class='tab_content' style='display: none;'>";

		$(".home_tabs_content").append(tab_html);

		function get_allreleases_results(search) {
			$("#tab_allreleases_content .tab_item, #tab_allreleases_content .tab_see_more").remove();
			superSteamAsset.get("http://store.steampowered.com/search/?sort_by=Released_DESC&category1=" + search, function(txt) {
				var return_text = $.parseHTML(txt);
				$(return_text).find(".search_result_row").each(function(i, item) {
					var appid = get_appid($(this).attr("href"));
					var game_name = $(this).find(".title").text();
					var platform = $(this).find(".search_name p:last").html();
					var release_date = $(this).find(".search_released").text();
					var discount_pct = $(this).find(".search_discount span:last").text();
					var price = $(this).find(".search_price").html();
					var html = "<div class='tab_item app_impression_tracked' data-ds-appid='" + appid + "' onmouseover='GameHover( this, event, \"global_hover\", {\"type\":\"app\",\"id\":\"" + appid + "\",\"public\":0,\"v6\":1} );' onmouseout='HideGameHover( this, event, \"global_hover\" )' id='tab_row_popular_" + appid + "'>";
					html += "<a class='tab_item_overlay' href='http://store.steampowered.com/app/" + appid + "/?snr=1_4_4__106'><img src='http://store.akamai.steamstatic.com/public/images/blank.gif'></a><div class='tab_item_overlay_hover'></div>";
					html += "<img class='tab_item_cap' src='http://cdn.akamai.steamstatic.com/steam/apps/" + appid + "/capsule_184x69.jpg'>";
					// price info
					if (discount_pct) {
						html += "<div class='discount_block tab_item_discount'><div class='discount_pct'>" + discount_pct + "</div><div class='discount_prices'>" + price + "</div></div>";
					} else {
						html += "<div class='discount_block tab_item_discount no_discount'><div class='discount_prices no_discount'><div class='discount_final_price'>" + price + "</div></div></div>";
					}

					html += "<div class='tab_item_content'><div class='tab_item_name'>" + game_name + "</div><div class='tab_item_details'> " + platform + "<div class='tab_item_top_tags'><span class='top_tag'>" + release_date + "</span></div></div><br clear='all'></div>";

					html += "</div>";
					$("#tab_allreleases_content").append(html);
					return i < 9;
				});
				var button = $("#tab_newreleases_content").find(".tab_see_more").clone();
				$("#tab_allreleases_content").append(button);
			});
		}

		function generate_search_string() {
			var return_str = "";
			if (localStorageHelpers.getValue("show_allreleases_games")) { return_str += "998,"; }
			if (localStorageHelpers.getValue("show_allreleases_video")) { return_str += "999,"; }
			if (localStorageHelpers.getValue("show_allreleases_demos")) { return_str += "10,"; }
			if (localStorageHelpers.getValue("show_allreleases_mods")) { return_str += "997,"; }
			if (localStorageHelpers.getValue("show_allreleases_packs")) { return_str += "996,"; }
			if (localStorageHelpers.getValue("show_allreleases_dlc")) { return_str += "21,"; }
			if (localStorageHelpers.getValue("show_allreleases_guide")) { return_str += "995,"; }
			if (localStorageHelpers.getValue("show_allreleases_softw")) { return_str += "994,"; }
			return return_str;
		}

		$("#es_allreleases").on("click", function() {
			$(".home_tabs_row").find(".active").removeClass("active");
			$(".home_tabs_content").find(".tab_content").hide();
			$("#es_allreleases").addClass("active");
			$("#tab_allreleases_content").show();

			if ($("#tab_allreleases_content").find("div").length == 0) {
				$("#tab_allreleases_content").append("<div id='es_allreleases_btn' class='home_actions_ctn' style='margin-bottom: 4px; display: none;'><div class='home_btn home_customize_btn' style='z-index: 13; position: absolute; right: -2px;'>" + language.customize + "</div></div>");

				if (localStorageHelpers.getValue("show_allreleases_initialsetup") === null) {
					localStorageHelpers.setValue("show_allreleases_games", true);
					localStorageHelpers.setValue("show_allreleases_video", true);
					localStorageHelpers.setValue("show_allreleases_demos", true);
					localStorageHelpers.setValue("show_allreleases_mods", true);
					localStorageHelpers.setValue("show_allreleases_packs", true);
					localStorageHelpers.setValue("show_allreleases_dlc", true);
					localStorageHelpers.setValue("show_allreleases_guide", true);
					localStorageHelpers.setValue("show_allreleases_softw", true);
					localStorageHelpers.setValue("show_allreleases_initialsetup", true);
				}

				var html = "<div class='home_viewsettings_popup' style='display: none; z-index: 12; right: 0px; top: 58px;'><div class='home_viewsettings_instructions' style='font-size: 12px;'>" + language.allreleases_products + "</div>";

				// Games
				text = language.games;
				if (localStorageHelpers.getValue("show_allreleases_games")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_games'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_games'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				// Videos / Trailers
				text = language.videos;
				if (localStorageHelpers.getValue("show_allreleases_video")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_video'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_video'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";	}

				// Demos
				text = language.demos;
				if (localStorageHelpers.getValue("show_allreleases_demos")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_demos'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_demos'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				// Mods
				text = language.mods;
				if (localStorageHelpers.getValue("show_allreleases_mods")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_mods'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_mods'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				// Packs
				text = language.packs;
				if (localStorageHelpers.getValue("show_allreleases_packs")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_packs'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_packs'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";	}

				// Downloadable Content
				text = language.dlc;
				if (localStorageHelpers.getValue("show_allreleases_dlc")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_dlc'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_dlc'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				// Guides
				text = language.guides;
				if (localStorageHelpers.getValue("show_allreleases_guide")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_guide'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_guide'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				// Software
				text = language.software;
				if (localStorageHelpers.getValue("show_allreleases_softw")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_softw'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
				else { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_allreleases_softw'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }

				$("#es_allreleases_btn").append(html);

				var search_string = generate_search_string();
				get_allreleases_results(search_string);

				$("#tab_allreleases_content").hover(function() {
					$("#es_allreleases_btn").show();
				}, function() {
					$("#es_allreleases_btn").hide();
					$("#es_allreleases_btn").find(".home_viewsettings_popup").hide();
					if ($("#es_allreleases_btn").find(".home_customize_btn").hasClass("active")) {
						$("#es_allreleases_btn").find(".home_customize_btn").removeClass("active");
					}
				});

				$("#es_allreleases_btn").find(".home_customize_btn").click(function() {
					if ($(this).hasClass("active")) {
						$(this).removeClass("active");
					} else {
						$(this).addClass("active");
					}

					if ($(this).parent().find(".home_viewsettings_popup").is(":visible")) {
						$(this).parent().find(".home_viewsettings_popup").hide();
					} else {
						$(this).parent().find(".home_viewsettings_popup").show();
					}
				});

				$("#es_allreleases_btn").find(".home_viewsettings_checkboxrow").click(function() {
					var setting_name = $(this).attr("id");
					if (localStorageHelpers.getValue(setting_name)) {
						localStorageHelpers.setValue(setting_name, false);
						$(this).find(".home_viewsettings_checkbox").removeClass("checked");
					} else {
						localStorageHelpers.setValue(setting_name, true);
						$(this).find(".home_viewsettings_checkbox").addClass("checked");
					}

					var search_string = generate_search_string();
					get_allreleases_results(search_string);
				});
			}
		});
	}

	function hide_greenlight_banner() {
		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);
		if (userPrefs.replaceSteamGreenlightBanner === true) {
			var banner = $("#ig_top_workshop");
			var breadcrumbs = $(".breadcrumbs");

			var greenlight_info = '<link rel="stylesheet" type="text/css" href="http://steamcommunity-a.akamaihd.net/public/shared/css/apphub.css"><div class="apphub_HeaderTop es_greenlight"><div class="apphub_AppName ellipsis">Greenlight</div><div style="clear: both"></div>'
			greenlight_info += '<div class="apphub_sectionTabs">';
			greenlight_info += '<a class="apphub_sectionTab" id="games_apphub_sectionTab" href="http://steamcommunity.com/workshop/browse/?appid=765&section=items"><span>Games</a>';
			greenlight_info += '<a class="apphub_sectionTab" id="software_apphub_sectionTab" href="http://steamcommunity.com/workshop/browse/?appid=765&section=software"><span>Software</a>';
			greenlight_info += '<a class="apphub_sectionTab" id="concepts_apphub_sectionTab" href="http://steamcommunity.com/workshop/browse/?appid=765&section=concepts"><span>Concepts</a>';
			greenlight_info += '<a class="apphub_sectionTab" id="collections_apphub_sectionTab" href="http://steamcommunity.com/workshop/browse/?appid=765&section=collections"><span>Collections</a>';
			greenlight_info += '<a class="apphub_sectionTab" href="http://steamcommunity.com/workshop/discussions/?appid=765"><span>Discussions</a>';
			greenlight_info += '<a class="apphub_sectionTab" href="http://steamcommunity.com/workshop/about/?appid=765&section=faq"><span>About Greenlight</a>';
			greenlight_info += '<a class="apphub_sectionTab" href="http://steamcommunity.com/workshop/news/?appid=765"><span>News</a>';
			greenlight_info += '</div>';
			if(breadcrumbs.find("a:first").text().trim()=="Greenlight"){
				banner.before(greenlight_info);
				var collection_header = $("#ig_collection_header");
				collection_header.css("height","auto");
				collection_header.find("img").hide();
				if(banner.hasClass("blue")) {
					banner.hide();
				}
				else if(banner.hasClass("green")) {
					$(".es_greenlight").toggleClass("es_greenlit");
				}else if(banner.hasClass("greenFlash")) {
					$(".es_greenlight").toggleClass("es_released");
				}
				var second_breadcrumb = breadcrumbs.find("a:nth-child(2)").text().trim();
				switch (second_breadcrumb) {
					case "Games":
					$("#games_apphub_sectionTab").toggleClass("active");
					break;
					case "Software":
					$("#software_apphub_sectionTab").toggleClass("active");
					break;
					case "Concepts":
					$("#concepts_apphub_sectionTab").toggleClass("active");
					break;
					case "Collections":
					breadcrumbs.before(greenlight_info);
					$("#collections_apphub_sectionTab").toggleClass("active");
					break;
				}
			}
		}
	}
	//Needs to be re-worked if we want to include gifts.
	function display_purchase_date() {
		if ($(".game_area_already_owned").length > 0) {
			var appname = $(".apphub_AppName").text();

			superSteamAsset.get('https://store.steampowered.com/account/licenses/', function (txt) {
			//Suspicious JQuery
				//var earliestPurchase = $(txt).find(".td #wht_date .td:contains(" + appname + ")").closest(".tr").last(),
				//var earliestPurchase = $(txt).find(".td .license_date_col").nextUntil(".tr");
				//$("td").filter(function() { return $.text([this]) == '*required'; })
				purchaseDate = $(txt).find("td:contains(" + appname + "):last").parent().find(".license_date_col").text();
				$(".game_area_already_owned:first").each(function (index, node) {
					if (purchaseDate) {

						$(".game_area_already_owned:first .already_in_library").append(" (Purchased on " + purchaseDate +") ");
					}
				});
			});
		}
	}

	function bind_ajax_content_highlighting() {
		var observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				for (var i = 0; i < mutation.addedNodes.length; i++) {
					var node = mutation.addedNodes[i];
					// Check the node is what we want, and not some unrelated DOM change.
					if (node.classList && node.classList.contains("tab_item")) {
						runInPageContext("function() { GDynamicStore.DecorateDynamicItems( $('.tab_item') ) }");
						start_highlighting_node(node);
						check_early_access(node, "ea_231x87.png", 0, ":last");
					}

					if (node.id == "search_result_container") {
						processing = false;
						endless_scrolling();
						start_highlights_and_tags();
						process_early_access();
					}

					if ($(node).children('div')[0] && $(node).children('div')[0].classList.contains("blotter_day")) {
						start_friend_activity_highlights();
						process_early_access();
					}

					if (node.classList && node.classList.contains("browse_tag_games")) {
						start_highlights_and_tags();
						process_early_access();
					}

					if (node.classList && node.classList.contains("match")) {
						start_highlighting_node(node);
						check_early_access(node, "ea_184x69.png", 0);
					}

					if (node.classList && node.classList.contains("search_result_row")) {
						start_highlighting_node(node);
						check_early_access(node, "ea_sm_120.png", 0);
					}

					if (node.classList && node.classList.contains("market_listing_row_link")) highlight_market_items();
					if ($(node).parent()[0] && $(node).parent()[0].classList.contains("search_result_row")) start_highlighting_node($(node).parent()[0]);
				}
			});
		});
		observer.observe(document, { subtree: true, childList: true });
	}

	function add_app_page_highlights(appid) {
		var jsonString = JSON.stringify(userPrefs);
		userPrefs = JSON.parse(jsonString);
		if (userPrefs.highlightOwnedGames) {
			if ($(".game_area_already_owned").find(".ds_owned_flag").length > 0) {
				$(".apphub_AppName").css("color", userPrefs.ownedGamesColor);
			}
		}
	}

	function start_highlights_and_tags(){
		// Batch all the document.ready appid lookups into one storefront call.
		var selectors = [
			"div.tab_row",				// Storefront rows
			"div.dailydeal_ctn",
			"div.wishlistRow",			// Wishlist rows
			"a.game_area_dlc_row",			// DLC on app pages
			"a.small_cap",				// Featured storefront items and "recommended" section on app pages
			"a.home_smallcap",
			"a.search_result_row",			// Search result rows
			"a.match",				// Search suggestions rows
			"a.cluster_capsule",			// Carousel items
			"div.recommendation_highlight",		// Recommendation pages
			"div.recommendation_carousel_item",	// Recommendation pages
			"div.friendplaytime_game",		// Recommendation pages
			"div.dlc_page_purchase_dlc",		// DLC page rows
			"div.sale_page_purchase_item",		// Sale pages
			"div.item",				// Sale pages / featured pages
			"div.home_area_spotlight",		// Midweek and weekend deals
			"div.browse_tag_game",			// Tagged games
			"div.similar_grid_item",			// Items on the "Similarly tagged" pages
			"div.tab_item",			// Items on new homepage
			"div.special",			// new homepage specials
			"div.curated_app_item"	// curated app items!
		];

		setTimeout(function() {
			$.each(selectors, function (i, selector) {
				$.each($(selector), function(j, node){
					var node_to_highlight = node;
					if ($(node).hasClass("item")) { node_to_highlight = $(node).find(".info")[0]; }
					if ($(node).hasClass("home_area_spotlight")) { node_to_highlight = $(node).find(".spotlight_content")[0]; }

					if ($(node).find(".ds_owned_flag").length > 0) {
						highlight_owned(node_to_highlight);
					}

					if ($(node).find(".ds_wishlist_flag").length > 0) {
						highlight_wishlist(node_to_highlight);
					}

					if ($(node).find(".ds_incart_flag").length > 0) {
						highlight_cart(node_to_highlight);
					}

					if ($(node).hasClass("search_result_row") && $(node).find(".search_discount").not(":has('span')").length > 0) {
						highlight_nondiscounts(node_to_highlight);
					}

					highlight_notinterested(node_to_highlight);
				});
			});
		}, 500);
	}

	function start_friend_activity_highlights() {
		var owned_promise = (function () {

			var deferred = new $.Deferred();
			if (is_signed_in && window.location.protocol != "https:") {
				var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
				var last_updated = localStorageHelpers.getValue("dynamicflist_time") || expire_time - 1;

				if (true) {
					//if (last_updated < expire_time) {
					superSteamAsset.get("http://store.steampowered.com/dynamicstore/userdata/", function(txt) {
						var jsonString = JSON.stringify(txt);
						var data = JSON.parse(jsonString);
						if (data["rgOwnedApps"]) {
							localStorageHelpers.setValue("owned_apps", data["rgOwnedApps"].toString());
						}
						if (data["rgWishlist"]) {
							localStorageHelpers.setValue("wishlist_apps", data["rgWishlist"].toString());
						}
						localStorageHelpers.setValue("dynamicflist_time", parseInt(Date.now() / 1000, 10));
						deferred.resolve();
					});
				} else {
					deferred.resolve();
				}
			} else {
				deferred.resolve();
			}

			return deferred.promise();
		})();

		owned_promise.done(function() {
			var selectors = [
				".blotter_author_block a",
				".blotter_gamepurchase_details a",
				".blotter_daily_rollup_line a"
			],

			ownedapps = localStorageHelpers.getValue("owned_apps").split(","),
			wishlistapps = localStorageHelpers.getValue("wishlist_apps").split(",");
			$.each(selectors, function (i, selector) {
				$.each($(selector), function(j, node){
					var appid = get_appid(node.href);
					if (appid && !node.classList.contains("blotter_userstats_game")) {
						if (selector == ".blotter_author_block a") { $(node).addClass("inline_tags"); }
						if (selector == ".blotter_daily_rollup_line a") {
							if ($(node).parent().parent().html().match(/<img src="(.+apps.+)"/)) {
								add_achievement_comparison_link($(node).parent().parent());
							}
						}
						if ($.inArray(appid, wishlistapps) !== -1) highlight_wishlist(node);
						if ($.inArray(appid, ownedapps) !== -1) highlight_owned(node);
					}
				});
			});
		});

	}

	function start_highlighting_node(node) {
		var node_to_highlight = node;
		if ($(node).hasClass("item")) { node_to_highlight = $(node).find(".info")[0]; }
		if ($(node).hasClass("home_area_spotlight")) { node_to_highlight = $(node).find(".spotlight_content")[0]; }

		if ($(node).find(".ds_owned_flag").length > 0) {
			highlight_owned(node_to_highlight);
		}

		if ($(node).find(".ds_wishlist_flag").length > 0) {
			highlight_wishlist(node_to_highlight);
		}

		if ($(node).find(".ds_incart_flag").length > 0) {
			higlight_cart(node_to_highlight);
		}

		if ($(node).hasClass("search_result_row") && $(node).find(".search_discount").not(":has('span')").length > 0) {
			highlight_nondiscounts(node_to_highlight);
		}

		highlight_notinterested(node);
	}

	// Allows the user to intuitively remove an item from their wishlist on the app page
	function add_app_page_wishlist_changes(appid) {
		if (is_signed_in) {


					if ($("#add_to_wishlist_area").length == 0 && $(".game_area_already_owned").length == 0) {
						$(".queue_actions_ctn").find("img[src='http://store.akamai.steamstatic.com/public/images/v6/ico/ico_selected.png']").parent().parent().wrap("<div id='add_to_wishlist_area' style='display: inline-block;'></div>");
						var url_for_removing_app = $("#add_to_wishlist_area").find("a:first").attr("href");
						$("#add_to_wishlist_area").find("a:first").removeAttr("href");
						$("#add_to_wishlist_area").find("a:first").wrap("<div id='add_to_wishlist_area_success' class='queue_control_button'></div>");

						// Add wishlist areas
						$("#add_to_wishlist_area").prepend("<div id='es_wishlist_area' style='display: none;' class='queue_control_button'><a class='btnv6_blue_hoverfade btn_medium' href='javascript:AddToWishlist( " + appid + ", \"add_to_wishlist_area\", \"add_to_wishlist_area_success\", \"add_to_wishlist_area_fail\", \"1_5_9__407\" );'><span>Add to your wishlist</span></a></div><div id='add_to_wishlist_area_fail' style='display: none;'></div>");

						$("#add_to_wishlist_area_success").find("a:first").attr("data-store-tooltip", "Click to remove app from wishlist");
						$("#add_to_wishlist_area_success").hover(
							function() {
								var remove = assetUrls.img_remove;

								$("#add_to_wishlist_area_success").find("img").attr("src", assetUrls.img_remove);
							}, function() {
								$("#add_to_wishlist_area_success").find("img").attr("src", "//store.akamai.steamstatic.com/public/images/v6/ico/ico_selected.png");
							}
						)

						$("#add_to_wishlist_area_success").on("click", function() {
							// get community session variable (this is different from the store session)
							get_http("http://steamcommunity.com/my/wishlist", function(txt) {
								var session = txt.match(/sessionid" value="(.+)"/)[1];
								$.ajax({
									type:"POST",
									url: url_for_removing_app,
									data:{
										sessionid: session,
										action: "remove",
										appid: appid
									},
									success: function( msg ) {
										setValue(appid + "wishlisted", false);
										$("#add_to_wishlist_area_success").hide();
										$("#es_wishlist_area").show();
									}
								});
							});
						});

						$("#es_wishlist_area").on("click", function() {
							$("#add_to_wishlist_area_success").show();
							$("#es_wishlist_area").hide();
							setTimeout(function() { $("#add_to_wishlist_area").show(); },1000);
						});
					}
				}


	}

	function rewrite_string(string, websafe) {
		if (websafe) {
			string = encodeURIComponent(string);
		} else {
			string = decodeURI(string);
		}
		return string;
	}

	function highlight_market_items() {
		$.each($(".market_listing_row_link"), function (i, node) {
			var current_market_name = node.href.match(/steamcommunity.com\/market\/listings\/753\/(.+)\?/);
			if (!current_market_name) { current_market_name = node.href.match(/steamcommunity.com\/market\/listings\/753\/(.+)/); }
			if (current_market_name) {
				var item_name = rewrite_string(current_market_name[1]);
				var market_name = localStorageHelpers.getValue("card:" + item_name);
				if (market_name) {
					node = $(node).find("div");
					$(node).css("backgroundImage", "none");
					$(node).css("color", "white");
					$(node).css("backgroundColor", userPrefs.ownedGamesColor);
				}
			}
		});
	}

	function add_achievement_comparison_link(node) {
		if (userPrefs.showCompareLinks === true) {
			if (!($(node).html().match(/es_achievement_compare/))) {
				var links = $(node).find("a");
				var appid = get_appid(links[2].href);
				superSteamAsset.get(links[0].href + "/stats/" + appid, function(txt) {
					var html = txt.match(/<a href="(.+)compare">/);
					if (html) {
						$(node).find("span:not(.nickname_block,.nickname_name)").css("margin-top", "0px");
						$(node).find("span:not(.nickname_block,.nickname_name)").append("<br><a href='http://www.steamcommunity.com" + escapeHTML(html[1]) + "compare' class='es_achievement_compare' target='_blank' style='font-size: 10px; float: right; margin-right: 6px;'>(" + escapeHTML(language.compare) + ")</a>");
					}
				});
			}
		}
	}

	function add_dlc_checkboxes() {
		var session = getCookie("sessionid");
		if ($("#game_area_dlc_expanded").length > 0) {
			$("#game_area_dlc_expanded").after("<div class='game_purchase_action game_purchase_action_bg' style='float: left; margin-top: 4px; margin-bottom: 10px; display: none;' id='es_selected_btn'><div class='btn_addtocart'><a class='btnv6_green_white_innerfade btn_medium' href='javascript:document.forms[\"add_selected_dlc_to_cart\"].submit();'><span>" + language.add_selected_dlc_to_cart + "</span></a></div></div>");
			$(".game_area_dlc_section").after("<div style='clear: both;'></div>");
		} else {
			$(".gameDlcBlocks").after("<div class='game_purchase_action game_purchase_action_bg' style='float: left; margin-top: 4px; display: none;' id='es_selected_btn'><div class='btn_addtocart'><a class='btnv6_green_white_innerfade btn_medium' href='javascript:document.forms[\"add_selected_dlc_to_cart\"].submit();'><span>" + language.add_selected_dlc_to_cart + "</span></a></div></div>");
		}
		$("#es_selected_btn").before("<form name=\"add_selected_dlc_to_cart\" action=\"http://store.steampowered.com/cart/\" method=\"POST\" id=\"es_selected_cart\">");
		$(".game_area_dlc_row").each(function() {
			if ($(this).find("input").val()) {
				$(this).find(".game_area_dlc_name").prepend("<input type='checkbox' class='es_dlc_selection' style='cursor: default;' id='es_select_dlc_" + $(this).find("input").val() + "' value='" + $(this).find("input").val() + "'><label for='es_select_dlc_" + $(this).find("input").val() + "' style='background-image: url( " + assetUrls.img_check_sheet + " );'></label>");
			} else {
				$(this).find(".game_area_dlc_name").css("margin-left", "23px");
			}
		}).hover(function() {
			$(this).find(".ds_flag").hide();
		}, function() {
			$(this).find(".ds_flag").show();
		});
		function add_dlc_to_list() {
			$("#es_selected_cart").html("<input type=\"hidden\" name=\"action\" value=\"add_to_cart\"><input type=\"hidden\" name=\"sessionid\" value=\"" + session + "\">");
			$(".es_dlc_selection:checked").each(function() {
				var input = $("<input>", {type: "hidden", name: "subid[]", value: $(this).val() });
				$("#es_selected_cart").append(input);
			});
			if ($(".es_dlc_selection:checked").length > 0) {
				$("#es_selected_btn").show();
			} else {
				$("#es_selected_btn").hide();
			}
		}

		$(".game_area_dlc_section").find(".gradientbg").after("<div style='height: 28px; padding-left: 15px; display: none;' id='es_dlc_option_panel'></div>");

		$("#es_dlc_option_panel").append("<div class='es_dlc_option' id='unowned_dlc_check'>" + escapeHTML(language.select.unowned_dlc) + "</div>");
		$("#unowned_dlc_check").on("click", function() {
			$(".game_area_dlc_section").find(".game_area_dlc_row").each(function() {
				if (!($(this).hasClass("es_highlight_owned"))) {
					$(this).find("input").prop("checked", true).change();
				}
			});
		});

		$("#es_dlc_option_panel").append("<div class='es_dlc_option' id='wl_dlc_check'>" + escapeHTML(language.select.wishlisted_dlc) + "</div>");
		$("#wl_dlc_check").on("click", function() {
			$(".game_area_dlc_section").find(".game_area_dlc_row").each(function() {
				if ($(this).hasClass("es_highlight_wishlist")) {
					$(this).find("input").prop("checked", true).change();
				}
			});
		});

		$("#es_dlc_option_panel").append("<div class='es_dlc_option' id='no_dlc_check'>" + escapeHTML(language.select.none) + "</div>");
		$("#no_dlc_check").on("click", function() {
			$(".game_area_dlc_section").find(".game_area_dlc_row").each(function() {
				$(this).find("input").prop("checked", false).change();
			});
		});

		$(".game_area_dlc_section").find(".gradientbg").append("<a id='es_dlc_option_button'>" + escapeHTML(language.thewordoptions) + " ▾</a>");

		$("#es_dlc_option_button").on("click", function() {
			$("#es_dlc_option_panel").toggle();
			if ($("#es_dlc_option_button").text().match("▾")) {
				$("#es_dlc_option_button").text(language.thewordoptions + " ▴");
			} else {
				$("#es_dlc_option_button").text(language.thewordoptions + " ▾");
			}
		});

		$(document).on( "change", ".es_dlc_selection", add_dlc_to_list );
	}



	function add_astats_link(appid) {
		if (userPrefs.showAStatsLinks === true) {
			$("#achievement_block").append("<div class='game_area_details_specs'><div class='icon'><img src='" + assetUrls.img_ico_astatsnl + "' style='margin-left: 4px'></div><a class='name' href='http://astats.astats.nl/astats/Steam_Game_Info.php?AppID=" + appid + "' target='_blank'><span>" + language.view_astats + "</span></a>");
		}
	}

	var ea_promise = earlyAccess.load();

	function check_early_access(node, image_name, image_left, selector_modifier, action) {
		ea_promise.done(function(){
			var href = ($(node).find("a").attr("href") || $(node).attr("href"));
			var appid = get_appid(href);
			if (appid === null) {
				if ($(node).find("img").length > 0) {
					if ($(node).find("img").attr("src").match(/\/apps\/(\d+)\//)) {
						appid = $(node).find("img").attr("src").match(/\/apps\/(\d+)\//)[1];
					}
				}
			}
			var early_access = JSON.parse(ea_appids);
			if (early_access["ea"].indexOf(appid) >= 0) {
				var selector = "img";
				if (selector_modifier != undefined) selector += selector_modifier;
				var image;
				switch (image_name) {
					case "ea_sm_120.png":
					image = assetUrls.img_overlay_ea_sm_120;
					break;
					case "ea_184x69.png":
					image = assetUrls.img_overlay_ea_184x69;
					break;
					case "ea_231x87.png":
					image = assetUrls.img_overlay_ea_231x87;
					break;
					case "ea_292x136.png":
					image = assetUrls.img_overlay_ea_292x136;
					break;
					case "ea_467x181.png":
					image = assetUrls.img_overlay_ea_467x181;
					break;
				}
				$(node).find(selector.trim()).wrap('<span class="ea_image_container"/>').before('<span class="supers_overlay"><img src="'+image+'"/></span>');
			}
		});
	}

	function show_regional_pricing() {
		if (userPrefs.showRegionalPriceComparisons) {
			var api_url = "http://store.steampowered.com/api/packagedetails/";
			var countries = [];
			

			if (userPrefs.region1 != "") countries.push(userPrefs.region1);
			if (userPrefs.region2 != "") countries.push(userPrefs.region2);
			if (userPrefs.region3 != "") countries.push(userPrefs.region3);
			if (userPrefs.region4 != "") countries.push(userPrefs.region4);
			if (userPrefs.region5 != "") countries.push(userPrefs.region5);
			if (userPrefs.region6 != "") countries.push(userPrefs.region6);
			if (userPrefs.region7 != "") countries.push(userPrefs.region7);
			if (userPrefs.region8 != "") countries.push(userPrefs.region8);
			if (userPrefs.region9 != "") countries.push(userPrefs.region9);

			var pricing_div = "<div class='es_regional_container'></div>";
			var world = assetUrls.img_world;
			var currency_deferred = [];
			var local_country;
			var local_currency;
			var sale = false;
			var sub;
			var region_appended=0;
			var available_currencies = ["USD","GBP","EUR","BRL","RUB","JPY","NOK","IDR","MYR","PHP","SGD","THB","VND","KRW","TRY","UAH","MXN","CAD","AUD","NZD"];
			var conversion_rates = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
			var currency_symbol;

			function process_data(conversion_array) {
				if (/^\/sale\/.*/.test(window.location.pathname)) {
					sale=true;
					pricing_div = $(pricing_div).addClass("es_regional_sale");
				}
				if (/^\/sub\/.*/.test(window.location.pathname)) {
					sub=true;
					pricing_div = $(pricing_div).addClass("es_regional_sub");
				}
				if (getCookie("fakeCC") != null || getCookie("LKGBillingCountry") != null) {
					if (getCookie("fakeCC")){
						local_country = getCookie("fakeCC");
						local_country = local_country.toLowerCase();
					} else {
						local_country = getCookie("LKGBillingCountry");
						local_country = local_country.toLowerCase();
					}
				}
				if(countries.indexOf(local_country)===-1){
					countries.push(local_country);
				}
				var all_game_areas = $(".game_area_purchase_game").toArray();
				if (sale) {
					all_game_areas = $(".sale_page_purchase_item").toArray();
				}
				//data-ds-appid
				var subid_info = [];
				var subid_array = [];

				function formatPriceData(sub_info,country,converted_price) {
					var countryString = '';
					countryString = country;
					var flag_div = "<div class=\"es_flag\" style='background-image:url( " + assetUrls.img_flags + " )'></div>";

					if (sub_info["prices"][country]){
					
						var price = sub_info["prices"][country]["final"]/100;
						var local_price = sub_info["prices"][local_country]["final"]/100;
						converted_price = converted_price/100;
						converted_price = converted_price.toFixed(2);

						var currencyLocal = sub_info["prices"][country]["currency"];
						var percentage;

						var formatted_price = currency.format(price, currencyLocal);

						var formatted_converted_price = currency.format(converted_price, local_currency);

						percentage = (((converted_price/local_price)*100)-100).toFixed(2);
						var arrows = assetUrls.img_arrows;
						var percentage_span="<span class=\"es_percentage\"><div class=\"es_percentage_indicator\" style='background-image:url("+arrows+")'></div></span>";
						if (percentage<0) {
							percentage = Math.abs(percentage);
							percentage_span = $(percentage_span).addClass("es_percentage_lower");
						}else if (percentage==0) {
							percentage_span = $(percentage_span).addClass("es_percentage_equal");
						}else {
							percentage_span = $(percentage_span).addClass("es_percentage_higher");
						}
						percentage_span = $(percentage_span).append(percentage+"%");
						var regional_price_div = "<div class=\"es_regional_price\">"+formatted_price+"&nbsp;<span class=\"es_regional_converted\">("+formatted_converted_price+")</span></div>";


						flag_div = $(flag_div).addClass("es_flag_"+countryString.toString().toLowerCase());

						regional_price_div = $(regional_price_div).prepend(flag_div);
						regional_price_div = $(regional_price_div).append(percentage_span);
						return regional_price_div;
					}
					else {
						var regional_price_div = "<div class=\"es_regional_price\"><span class=\"es_regional_unavailable\">"+language.region_unavailable+"</span></div>";
						//why does this work?
						flag_div = $(flag_div).addClass("es_flag_"+countryString.toString().toLowerCase());
						regional_price_div = $(regional_price_div).prepend(flag_div);
						return regional_price_div;
					}
				}

				$.each(all_game_areas,function(index,app_package){
					var subid = $(app_package).find("input[name='subid']").val();
					if(subid>0){
						subid_info[index]=[];
						subid_info[index]["subid"]=subid;
						subid_info[index]["prices"]=[];
						subid_array.push(subid);
					}
				});
				if(subid_array.length>0){
					$.each(countries,function(index,country){
						switch (country) {
							case "eu1":
							cc="fr";
							break;
							case "eu2":
							cc="it";
							break;
							default:
							cc=country;
							break;
						}
						$.each(subid_info,function(subid_index,package_info){
							currency_deferred.push(
								$.ajax({
									url:api_url,
									data:{
										packageids:package_info["subid"],
										cc:cc
									}
								}).done(function(data){
									$.each(data,function(data_subid){
										if(package_info){
											if(package_info["subid"]===data_subid){
												if(data[data_subid]["data"]) {
													var price = data[data_subid]["data"]["price"];
													subid_info[subid_index]["prices"][country]=price;
													pricing_div=$(pricing_div).append(price);
												}
											}
										}
									});
								})
							);
						});
					});


					var format_deferred=[];
					var formatted_regional_price_array=[];
					$.when.apply(null,currency_deferred).done(function(){
						$.map(subid_info,function(subid,index){

							if(subid){
								var sub_formatted = [];
								var convert_deferred=[];
								var all_convert_deferred = $.Deferred();
								var app_pricing_div = $(pricing_div).clone();
								$(app_pricing_div).attr("id", "es_pricing_" + subid_info[index]["subid"].toString());
								$.each(countries,function(country_index,country){
									var regional_price_array=[];
									if(country!==local_country){
										if(subid["prices"][country]){
											var country_currency = subid["prices"][country]["currency"].toString().toUpperCase();
											var app_price = subid["prices"][country]["final"];
											var index = $.inArray(country_currency, available_currencies);
											var converted_price = parseFloat(app_price) / conversion_array[index];
											var regional_price = formatPriceData(subid,country,converted_price);
											regional_price_array[0]=country;
											regional_price_array[1]=regional_price;
											sub_formatted.push(regional_price_array);
										}
										else {
											var regional_price = formatPriceData(subid,country);
											regional_price_array[0]=country;
											regional_price_array[1]=regional_price;
											sub_formatted.push(regional_price_array);
										}
									}
								});
								$.when.apply(null,convert_deferred).done(function(){
									if (sale){
										$(".sale_page_purchase_item").eq(index).find(".game_purchase_action_bg").after(app_pricing_div);
									} else {
										$(".game_area_purchase_game").eq(index).append(app_pricing_div);
										$(app_pricing_div).css("top", $(".game_area_purchase_game").eq(index).outerHeight(true));
										$(".game_area_purchase_game").css("z-index", "auto");
										$(".game_purchase_action").css("z-index", "1");
									}
									sub_formatted["subid"]=subid_info[index]["subid"].toString();
									formatted_regional_price_array.push(sub_formatted);
									all_convert_deferred.resolve();
								});
								format_deferred.push(all_convert_deferred.promise());
							}
						});
						$.when.apply(null,format_deferred).done(function(){
							var all_sub_sorted_divs=[];
							$.each(formatted_regional_price_array,function(formatted_div_index,formatted_div){
								var sorted_formatted_divs=[];
								$.each(countries,function(country_index,country){
									$.each(formatted_div,function(regional_div_index,regional_div){
										var sort_div_country = regional_div[0];
										if(country==sort_div_country){
											sorted_formatted_divs.push(regional_div[1]);
										}
									});
								});
								sorted_formatted_divs["subid"]=formatted_div["subid"];
								all_sub_sorted_divs.push(sorted_formatted_divs);
							});
							$.each(all_sub_sorted_divs,function(index,sorted_divs){
								var subid = subid_array[index];
								$.each(sorted_divs,function(price_index,regional_div){
									$("#es_pricing_"+sorted_divs["subid"]).append(regional_div);
									if(regional_div!=undefined){
										region_appended++;
									}
								});
								$("#es_pricing_"+subid).append("<div class='miniprofile_arrow right' style='position: absolute; top: 12px; right: -8px;'></div>");
								if(region_appended<=1){
									$("#es_pricing_"+subid).find(".miniprofile_arrow").css("top","6px");
								}
							});
							$.each(all_game_areas,function(index,app_package){
								var subid = $(app_package).find("input[name='subid']").val();
								if(subid){
									$(app_package).find(".price").css({"padding-left":"25px","background-image":"url("+world+")","background-repeat":"no-repeat","background-position":"5px 8px"});
									$(app_package).find(".discount_original_price").css({"position":"relative"});
									$(app_package).find(".discount_final_price").css({"margin-top":"-10px"});
									$(app_package).find(".discount_block").css({"padding-left":"25px","background-image":"url("+world+")","background-repeat":"no-repeat","background-position":"5px 8px","background-color":"#000000"});
									$(app_package).find(".discount_prices").css({"background":"none"});

									$(app_package).find(".price, .discount_block")
									.mouseover(function() {
										var purchase_location = $(app_package).find("div.game_purchase_action_bg").offset();
										if (sale) {
											$("#es_pricing_" + subid).css("right", $(app_package).find(".game_purchase_action").width() + 25 +"px").css("top", "138px");
										} else if(sub) {
											$("#es_pricing_" + subid).css("right", $(app_package).find(".game_purchase_action").width() + 25 + "px").css("top", "70px");
										} else {
											$("#es_pricing_" + subid).css("right", $(app_package).find(".game_purchase_action").width() + 20 + "px");
										}
										$("#es_pricing_" + subid).show();
									})
									.mouseout(function() {
										$("#es_pricing_" + subid).hide();
									})
									.css("cursor","help");
								}
							});
						});
					});
				}
			}

			// Get user's Steam currency
			currency_symbol = currency.symbolFromString($(".price:first, .discount_final_price:first").text().trim());
			if (currency_symbol == "") { return; }
			local_currency = currency.symbolToType(currency_symbol);

			var complete = 0;

			$.each(available_currencies, function(index, currency_type) {

				if (currency_type != local_currency) {
					if (localStorageHelpers.getValue(currency_type + "to" + local_currency)) {
						var expire_time = parseInt(Date.now() / 1000, 10) - 60; // One day ago
						//var expire_time = parseInt(Date.now() / 1000, 10) - 24 * 60 * 60; // One day ago
						var last_updated = localStorageHelpers.getValue(currency_type + "to" + local_currency + "_time") || expire_time - 1;

						if (last_updated < expire_time) {
							superSteamAsset.get("https://steamwatcher.com/boiler/currency/currencyconverter.php?fromcurrency=" + local_currency.toLowerCase() + "&tocurrency=" + currency_type.toLowerCase(), function(txt) {
								complete += 1;
								conversion_rates[available_currencies.indexOf(currency_type)] = parseFloat(txt);
								localStorageHelpers.setValue(currency_type + "to" + local_currency, parseFloat(txt));
								localStorageHelpers.setValue(currency_type + "to" + local_currency + "_time", parseInt(Date.now() / 1000, 10));
								if (complete == available_currencies.length - 1) { process_data(conversion_rates); }
							});
						} else {
							complete += 1;
							conversion_rates[available_currencies.indexOf(currency_type)] = localStorageHelpers.getValue(currency_type + "to" + local_currency);
							if (complete == available_currencies.length - 1) { process_data(conversion_rates); }
						}
					} else {
						superSteamAsset.get("https://steamwatcher.com/boiler/currency/currencyconverter.php?fromcurrency=" + local_currency.toLowerCase() + "&tocurrency=" + currency_type.toLowerCase(), function(txt) {
							complete += 1;
							conversion_rates[available_currencies.indexOf(currency_type)] = parseFloat(txt);
							localStorageHelpers.setValue(currency_type + "to" + local_currency, parseFloat(txt));
							localStorageHelpers.setValue(currency_type + "to" + local_currency + "_time", parseInt(Date.now() / 1000, 10));
							if (complete == available_currencies.length - 1) { process_data(conversion_rates); }
						});
					}
				}
			});
		}
	}

	function process_early_access() {
		ea_promise.done(function(){
			switch (window.location.host) {
				case "store.steampowered.com":
				switch (true) {
					case /^\/app\/.*/.test(window.location.pathname):
					$(".game_header_image").append("<a href='" + window.location.href + "'></a>");
					$(".game_header_image_ctn").each(function(index, value) { check_early_access($(this), "ea_292x136.png", $(this).position().left); });
					$(".small_cap").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 15); });
					break;
					case /^\/(?:genre|browse|tag)\/.*/.test(window.location.pathname):
					$(".tab_item").each(function(index, value) { check_early_access($(this), "ea_231x87.png", 0, ":last"); });
					$(".special_tiny_cap").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", 0); });
					$(".cluster_capsule").each(function(index, value) { check_early_access($(this), "ea_467x181.png", 0); });
					$(".game_capsule").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", 0); });
					$(".dq_item:not(:first-child)").each(function(index, value) { check_early_access($(this), "ea_467x181.png", 0); });
					break;
					case /^\/search\/.*/.test(window.location.pathname):
					$(".search_result_row").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", 0); });
					break;
					case /^\/recommended/.test(window.location.pathname):
					$(".friendplaytime_appheader").each(function(index, value) { check_early_access($(this), "ea_292x136.png", $(this).position().left); });
					$(".header_image").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					$(".appheader").each(function(index, value) { check_early_access($(this), "ea_292x136.png", $(this).position().left); });
					$(".recommendation_carousel_item").each(function(index, value) { check_early_access($(this), "ea_184x69.png", $(this).position().left + 8); });
					$(".game_capsule_area").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", $(this).position().left + 8); });
					$(".game_capsule").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", $(this).position().left); });
					$(".similar_grid_capsule").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					break;
					case /^\/tag\/.*/.test(window.location.pathname):
					$(".cluster_capsule").each(function(index, value) { check_early_access($(this), "ea_467x181.png", 0); });
					$(".tab_row").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0); });
					$(".browse_tag_game_cap").each(function(index, value) { check_early_access($(this), "ea_292x136.png", $(this).position().left); });
					break;
					case /^\/$/.test(window.location.pathname):
					$(".home_smallcap").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 15); });
					$(".cap").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					$(".special").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", 0); });
					$(".game_capsule").each(function(index, value) { check_early_access($(this), "ea_sm_120.png", 0); });
					$("#home_main_cluster").find(".cluster_capsule").each(function(index, value) { check_early_access($(this), "ea_467x181.png", 0); });
					$(".recommended_spotlight_ctn").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					$(".curated_app_link").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					$(".tab_item").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0, ":last"); });
					$(".dailydeal_ctn").find("a").each(function(index, value) { check_early_access($(this), "ea_292x136.png", 0); });
					break;
				}
				case "steamcommunity.com":
				switch(true) {
					case /^\/(?:id|profiles)\/.+\/wishlist/.test(window.location.pathname):
					$(".gameListRowLogo").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0); });
					break;
					case /^\/(?:id|profiles)\/(.+)\/games/.test(window.location.pathname):
					$(".gameListRowLogo").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0); });
					break;
					case /^\/(?:id|profiles)\/(.+)\/followedgames/.test(window.location.pathname):
					$(".gameListRowLogo").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 4); });
					break;
					case /^\/(?:id|profiles)\/.+\/\b(home|myactivity|status)\b/.test(window.location.pathname):
					$(".blotter_gamepurchase_content").find("a").each(function(index, value) {
						check_early_access($(this), "ea_231x87.png", $(this).position().left);
					});
					break;
					case /^\/(?:id|profiles)\/.+\/\b(reviews|recommended)\b/.test(window.location.pathname):
					$(".leftcol").each(function(index, value) { check_early_access($(this), "ea_184x69.png", $(this).position().left + 8); });
					break;
					case /^\/(?:id|profiles)\/.+/.test(window.location.pathname):
					$(".game_info_cap").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0); });
					$(".showcase_slot").each(function(index, value) { check_early_access($(this), "ea_184x69.png", 0); });
					break;
					case /^\/app\/.*/.test(window.location.pathname):
					if ($(".apphub_EarlyAccess_Title").length > 0) {
						$(".apphub_StoreAppLogo:first").after("<img class='es_overlay' style='left: " + $(".apphub_StoreAppLogo:first").position().left + "px' src='" + assetUrls.img_overlay_ea_292x136 + "'>");
					}
				}
			}
		});
	}

	function customize_app_page() {
		// Add a "Customize" button
		$(".purchase_area_spacer:last").after("<link rel='stylesheet' type='text/css' href='http://store.akamai.steamstatic.com/public/css/v6/home.css'><div id='es_customize_btn' class='home_actions_ctn' style='visibility: visible;'><div class='home_btn home_customize_btn'>" + language.customize + "</div></div>");

		if (localStorageHelpers.getValue("show_apppage_initialsetup") === null) {
			localStorageHelpers.setValue("show_apppage_recommendedbycurators", true);
			localStorageHelpers.setValue("show_apppage_recentupdates", true);
			localStorageHelpers.setValue("show_apppage_reviews", true);
			localStorageHelpers.setValue("show_apppage_playfire", true);
			localStorageHelpers.setValue("show_apppage_about", true);
			localStorageHelpers.setValue("show_apppage_current", true);
			localStorageHelpers.setValue("show_apppage_sysreq", true);
			localStorageHelpers.setValue("show_apppage_legal", true);
			localStorageHelpers.setValue("show_apppage_morelikethis", true);
			localStorageHelpers.setValue("show_apppage_customerreviews", true);
			localStorageHelpers.setValue("show_apppage_initialsetup", true);
		}

		var html = "<div class='home_viewsettings_popup' style='display: none'><div class='home_viewsettings_instructions' style='font-size: 12px;'>" + language.apppage_sections + "</div>"
		html += "<div class='home_viewsettings_checkboxrow ellipsis disabled'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + language.apppage_purchase + "</div></div>";

		// Recommended by Curators
		if ($(".steam_curators_block").length > 0) {
			var text = $(".steam_curators_block").find("h2:first").text();
			if (localStorageHelpers.getValue("show_apppage_recommendedbycurators")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_recommendedbycurators'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_recommendedbycurators'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".steam_curators_block").hide();
			}
		}

		// Recent updates
		if ($(".early_access_announcements").length > 0) {
			var text_search = $(".early_access_announcements").find("h2:first").clone();
			$("span", text_search).remove();
			text = $(text_search).text();
			if (localStorageHelpers.getValue("show_apppage_recentupdates")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_recentupdates'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_recentupdates'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".early_access_announcements").hide();
			}
		}

		// Reviews
		if ($("#game_area_reviews").length > 0) {
			text = $("#game_area_reviews").find("h2:first").text();
			if (localStorageHelpers.getValue("show_apppage_reviews")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_reviews'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_reviews'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#game_area_reviews").hide();
			}
		}

		// Rewards from Playfire
		if (localStorageHelpers.getValue("show_apppage_playfire")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_playfire'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + language.playfire_heading + "</div></div>"; }
		else {
			html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_playfire'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + language.playfire_heading + "</div></div>";
		}

		// About this game
		if ($("#game_area_description").length > 0) {
			text = $("#game_area_description").find("h2:first").text();
			if (localStorageHelpers.getValue("show_apppage_about")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_about'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_about'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#game_area_description").parent().parent().hide();
			}
		}

		// Steam charts
		if (localStorageHelpers.getValue("show_apppage_current")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_current'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + language.charts.current + "</div></div>"; }
		else {
			html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_current'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + language.charts.current + "</div></div>";
		}

		// System Requirements
		if ($(".sys_req").length > 0) {
			text = $(".sys_req").find("h2:first").text();
			if (localStorageHelpers.getValue("show_apppage_sysreq")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_sysreq'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_sysreq'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".sys_req").parent().hide();
			}
		}

		// Legal Information
		if ($("#game_area_legal").length > 0) {
			if (localStorageHelpers.getValue("show_apppage_legal")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_legal'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + language.apppage_legal + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_legal'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + language.apppage_legal + "</div></div>";
				$("#game_area_legal").hide();
			}
		}

		// More like this
		if ($("#recommended_block").length > 0) {
			text = $("#recommended_block").find("h4:first").text();
			if (localStorageHelpers.getValue("show_apppage_morelikethis")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_morelikethis'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_morelikethis'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#recommended_block").hide();
			}
		}

		// Helpful customer reviews
		if ($(".user_reviews_header").length > 0) {
			text_search = $(".user_reviews_header:first").clone();
			$("div", text_search).remove();
			text = $(text_search).text();
			if (localStorageHelpers.getValue("show_apppage_customerreviews")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_customerreviews'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_apppage_customerreviews'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".user_reviews_header").hide();
				$(".user_reviews_filter_bar").hide();
				$(".loading_more_reviews").hide();
				$(".user_reviews_container").hide();
				$("#app_reviews_hash").hide();
			}
		}

		$("#es_customize_btn").append(html);
		$("#es_customize_btn").after("<div style='clear: both;'></div>");

		$("#es_customize_btn").find(".home_customize_btn").click(function() {
			if ($(this).hasClass("active")) {
				$(this).removeClass("active");
			} else {
				$(this).addClass("active");
			}

			if ($(this).parent().find(".home_viewsettings_popup").is(":visible")) {
				$(this).parent().find(".home_viewsettings_popup").hide();
			} else {
				var pos_top = $("#es_customize_btn").offset().top + 19;
				var pos_left = $("#es_customize_btn").offset().left - 152;
				$(this).parent().find(".home_viewsettings_popup").css("top", pos_top + "px").css("left", pos_left + "px");
				$(this).parent().find(".home_viewsettings_popup").show();
			}
		});

		$('body').bind('click', function(e) {
			if($(e.target).closest("#es_customize_btn").length == 0) {
				if ($("#es_customize_btn").find(".home_customize_btn").hasClass("active")) {
					$("#es_customize_btn").find(".home_customize_btn").removeClass("active");
				}
				if ($("#es_customize_btn").find(".home_viewsettings_popup").is(":visible")) {
					$("#es_customize_btn").find(".home_viewsettings_popup").hide();
				}
			}
		});

		$("#show_apppage_recommendedbycurators").click(function() {
			if (localStorageHelpers.getValue("show_apppage_recommendedbycurators")) {
				localStorageHelpers.setValue("show_apppage_recommendedbycurators", false);
				$(".steam_curators_block").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_recommendedbycurators", true);
				$(".steam_curators_block").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_recentupdates").click(function() {
			if (localStorageHelpers.getValue("show_apppage_recentupdates")) {
				localStorageHelpers.setValue("show_apppage_recentupdates", false);
				$(".early_access_announcements").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_recentupdates", true);
				$(".early_access_announcements").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_reviews").click(function() {
			if (localStorageHelpers.getValue("show_apppage_reviews")) {
				localStorageHelpers.setValue("show_apppage_reviews", false);
				$("#game_area_reviews").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_reviews", true);
				$("#game_area_reviews").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_playfire").click(function() {
			if (localStorageHelpers.getValue("show_apppage_playfire")) {
				localStorageHelpers.setValue("show_apppage_playfire", false);
				$("#es_playfire").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_playfire", true);
				$("#es_playfire").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}

			if (localStorageHelpers.getValue("show_apppage_playfire") && $("#es_playfire").length == 0) {
				var appid = get_appid(window.location.host + window.location.pathname);
			}
		});

		$("#show_apppage_about").click(function() {
			if (localStorageHelpers.getValue("show_apppage_about")) {
				localStorageHelpers.setValue("show_apppage_about", false);
				$("#game_area_description").parent().parent().hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_about", true);
				$("#game_area_description").parent().parent().show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_current").click(function() {
			if ($(this).find(".home_viewsettings_checkbox").hasClass("checked")) {
				localStorageHelpers.setValue("show_apppage_current", false);
				$("#steam-charts").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_current", true);
				$("#steam-charts").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}

			if (userPrefs.showSteamChartsInfo && $("#steam-charts").length == 0) {
				var appid = get_appid(window.location.host + window.location.pathname);
				add_steamchart_info(appid);
			}
		});

		$("#show_apppage_sysreq").click(function() {
			if (localStorageHelpers.getValue("show_apppage_sysreq")) {
				localStorageHelpers.setValue("show_apppage_sysreq", false);
				$(".sys_req").parent().hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_sysreq", true);
				$(".sys_req").parent().show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_legal").click(function() {
			if (localStorageHelpers.getValue("show_apppage_legal")) {
				localStorageHelpers.setValue("show_apppage_legal", false);
				$("#game_area_legal").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_legal", true);
				$("#game_area_legal").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_morelikethis").click(function() {
			if (localStorageHelpers.getValue("show_apppage_morelikethis")) {
				localStorageHelpers.setValue("show_apppage_morelikethis", false);
				$("#recommended_block").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_morelikethis", true);
				$("#recommended_block").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_apppage_customerreviews").click(function() {
			if (localStorageHelpers.getValue("show_apppage_customerreviews")) {
				localStorageHelpers.setValue("show_apppage_customerreviews", false);
				$(".user_reviews_header").hide();
				$(".user_reviews_filter_bar").hide();
				$(".loading_more_reviews").hide();
				$(".user_reviews_container").hide();
				$("#app_reviews_hash").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_apppage_customerreviews", true);
				$(".user_reviews_header").show();
				$(".user_reviews_filter_bar").show();
				$("#Reviews_all").show();
				$("#app_reviews_hash").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});
	}

	function customize_home_page() {
		$(".home_page_content:first").append("<div id='es_customize_btn' class='home_actions_ctn' style='margin-bottom: 4px;'><div class='home_btn home_customize_btn' style='z-index: 13;'>" + language.customize + "</div></div><div style='clear: both;'></div>");
		$(".home_page_body_ctn:first").css("min-height", "400px");
		$(".has_takeover").css("min-height", "600px");

		if (localStorageHelpers.getValue("show_homepage_initialsetup") === null) {
			localStorageHelpers.setValue("show_homepage_carousel", true);
			localStorageHelpers.setValue("show_homepage_spotlight", true);
			localStorageHelpers.setValue("show_homepage_newsteam", true);
			localStorageHelpers.setValue("show_homepage_updated", true);
			localStorageHelpers.setValue("show_homepage_recommended", true);
			localStorageHelpers.setValue("show_homepage_explore", true);
			localStorageHelpers.setValue("show_homepage_curators", true);
			localStorageHelpers.setValue("show_homepage_tabs", true);
			localStorageHelpers.setValue("show_homepage_specials", true);
			localStorageHelpers.setValue("show_homepage_under10", true);
			localStorageHelpers.setValue("show_homepage_sidebar", true);
			localStorageHelpers.setValue("show_homepage_initialsetup", true);
		}

		var html = "<div class='home_viewsettings_popup' style='display: none; z-index: 12; right: 18px;'><div class='home_viewsettings_instructions' style='font-size: 12px;'>" + language.apppage_sections + "</div>"

		// Carousel
		if ($("#home_main_cluster").length > 0) {
			text = language.homepage_carousel;
			if (localStorageHelpers.getValue("show_homepage_carousel")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_carousel'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_carousel'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#home_main_cluster").parent().hide();
			}
		}

		// Spotlight
		if ($("#spotlight_scroll").length > 0) {
			text = language.homepage_spotlight;
			if (localStorageHelpers.getValue("show_homepage_spotlight")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_spotlight'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_spotlight'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#spotlight_scroll").parent().parent().hide();
			}
		}

		// New on Steam
		if ($(".new_on_steam").length > 0) {
			text = $(".new_on_steam").find("a:first").text();
			if (localStorageHelpers.getValue("show_homepage_newsteam")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_newsteam'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_newsteam'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".new_on_steam").hide();
			}
		}

		// Recently Updated
		if ($(".recently_updated").length > 0) {
			text = $(".recently_updated").find("a:first").text();
			if (localStorageHelpers.getValue("show_homepage_updated")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_updated'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_updated'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".recently_updated").hide();
			}
		}

		// Recommended For You
		if ($(".recommended").length > 0) {
			text = $(".recommended").find("h2:first").text();
			if (localStorageHelpers.getValue("show_homepage_recommended")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_recommended'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_recommended'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".recommended").hide();
			}
		}

		// Explore Your Queue
		if ($(".discovery_queue_ctn").length > 0) {
			text = $(".discovery_queue_ctn").find("a:first").text();
			if (localStorageHelpers.getValue("show_homepage_explore")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_explore'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_explore'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".discovery_queue_ctn").hide();
				$("#content_callout").hide();
				$("#content_loading").hide();
			}
		}

		// Steam Curators
		if ($(".apps_recommended_by_curators_ctn").length > 0) {
			text = $(".apps_recommended_by_curators_ctn").find("a:first").text();
			if (localStorageHelpers.getValue("show_homepage_curators")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_curators'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_curators'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".apps_recommended_by_curators_ctn").hide();
				$(".steam_curators_ctn").hide();
			}
		}

		// Homepage Tabs
		if ($(".home_tab_col").length > 0) {
			text = language.homepage_tabs;
			if (localStorageHelpers.getValue("show_homepage_tabs")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_tabs'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_tabs'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".home_tab_col").hide();
			}
		}

		var specials_section_parent = $(".dailydeal_ctn").parent();
		specials_section_parent.parent().find("h2:first, .dailydeal_ctn, .home_specials_grid:first, .home_block_footer:first, .home_specials_spacer").wrapAll("<div id='es_specials_section' />");
		specials_section_parent.parent().find("h2:last, .home_specials_grid:last, .home_block_footer:last").wrapAll("<div id='es_under_ten_section' />");

		// Specials
		if ($("#es_specials_section").length > 0) {
			text = $("#es_specials_section h2").text();
			if (localStorageHelpers.getValue("show_homepage_specials")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_specials'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_specials'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#es_specials_section").hide();
			}
		}

		// Under 10
		if ($("#es_under_ten_section").length > 0) {
			text = $("#es_under_ten_section h2").text();
			if (localStorageHelpers.getValue("show_homepage_under10")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_under10'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_under10'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$("#es_under_ten_section").hide();
			}
		}

		// Sidebar
		if ($(".home_page_gutter").length > 0) {
			text = language.homepage_sidebar;
			if (localStorageHelpers.getValue("show_homepage_sidebar")) { html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_sidebar'><div class='home_viewsettings_checkbox checked'></div><div class='home_viewsettings_label'>" + text + "</div></div>"; }
			else {
				html += "<div class='home_viewsettings_checkboxrow ellipsis' id='show_homepage_sidebar'><div class='home_viewsettings_checkbox'></div><div class='home_viewsettings_label'>" + text + "</div></div>";
				$(".home_page_gutter").hide();
				$(".home_page_body_ctn").css("margin-left", "0px");
				$(".home_page_content").css("padding-left", "0px");
				$(".has_takeover").find(".page_background_holder").css("margin-left", "-202px");
			}
		}

		$("#es_customize_btn").append(html);

		$("#es_customize_btn").find(".home_customize_btn").click(function() {
			if ($(this).hasClass("active")) {
				$(this).removeClass("active");
			} else {
				$(this).addClass("active");
			}

			if ($(this).parent().find(".home_viewsettings_popup").is(":visible")) {
				$(this).parent().find(".home_viewsettings_popup").hide();
			} else {
				$(this).parent().find(".home_viewsettings_popup").show();
			}
		});

		$('body').bind('click', function(e) {
			if($(e.target).closest("#es_customize_btn").length == 0) {
				if ($("#es_customize_btn").find(".home_customize_btn").hasClass("active")) {
					$("#es_customize_btn").find(".home_customize_btn").removeClass("active");
				}
				if ($("#es_customize_btn").find(".home_viewsettings_popup").is(":visible")) {
					$("#es_customize_btn").find(".home_viewsettings_popup").hide();
				}
			}
		});

		$("#show_homepage_carousel").click(function() {
			if (localStorageHelpers.getValue("show_homepage_carousel")) {
				localStorageHelpers.setValue("show_homepage_carousel", false);
				$("#home_main_cluster").parent().hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_carousel", true);
				$("#home_main_cluster").parent().show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_spotlight").click(function() {
			if (localStorageHelpers.getValue("show_homepage_spotlight")) {
				localStorageHelpers.setValue("show_homepage_spotlight", false);
				$("#spotlight_scroll").parent().parent().hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_spotlight", true);
				$("#spotlight_scroll").parent().parent().show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_newsteam").click(function() {
			if (localStorageHelpers.getValue("show_homepage_newsteam")) {
				localStorageHelpers.setValue("show_homepage_newsteam", false);
				$(".new_on_steam").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_newsteam", true);
				$(".new_on_steam").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_updated").click(function() {
			if (localStorageHelpers.getValue("show_homepage_updated")) {
				localStorageHelpers.setValue("show_homepage_updated", false);
				$(".recently_updated").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_updated", true);
				$(".recently_updated").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_recommended").click(function() {
			if (localStorageHelpers.getValue("show_homepage_recommended")) {
				localStorageHelpers.setValue("show_homepage_recommended", false);
				$(".recommended").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_recommended", true);
				$(".recommended").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_explore").click(function() {
			if (localStorageHelpers.getValue("show_homepage_explore")) {
				localStorageHelpers.setValue("show_homepage_explore", false);
				$(".discovery_queue_ctn").hide();
				$("#content_callout").hide();
				$("#content_loading").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_explore", true);
				$(".discovery_queue_ctn").show();
				$("#content_callout").show();
				$("#content_loading").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_curators").click(function() {
			if (localStorageHelpers.getValue("show_homepage_curators")) {
				localStorageHelpers.setValue("show_homepage_curators", false);
				$(".apps_recommended_by_curators_ctn").hide();
				$(".steam_curators_ctn").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_curators", true);
				if ($("#apps_recommended_by_curators").children().length > 0) {
					$(".apps_recommended_by_curators_ctn").show();
				} else {
					$(".steam_curators_ctn").show();
				}
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_tabs").click(function() {
			if (localStorageHelpers.getValue("show_homepage_tabs")) {
				localStorageHelpers.setValue("show_homepage_tabs", false);
				$(".home_tab_col").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_tabs", true);
				$(".home_tab_col").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_specials").click(function() {
			if (localStorageHelpers.getValue("show_homepage_specials")) {
				localStorageHelpers.setValue("show_homepage_specials", false);
				$(".dailydeal_ctn").parent().hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_specials", true);
				$(".dailydeal_ctn").parent().show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_under10").click(function() {
			if (localStorageHelpers.getValue("show_homepage_under10")) {
				localStorageHelpers.setValue("show_homepage_under10", false);
				$("#es_under_ten_section").hide();
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_under10", true);
				$("#es_under_ten_section").show();
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});

		$("#show_homepage_sidebar").click(function() {
			if (localStorageHelpers.getValue("show_homepage_sidebar")) {
				localStorageHelpers.setValue("show_homepage_sidebar", false);
				$(".home_page_gutter").hide();
				$(".home_page_body_ctn").css("margin-left", "0px");
				$(".home_page_content").css("padding-left", "0px");
				$(".has_takeover").find(".page_background_holder").css("margin-left", "-202px");
				$(this).find(".home_viewsettings_checkbox").removeClass("checked");
			} else {
				localStorageHelpers.setValue("show_homepage_sidebar", true);
				$(".home_page_gutter").show();
				$(".home_page_content").css("padding-left", "204px");
				$(".has_takeover").find(".page_background_holder").css("margin-left", "0px");
				$(this).find(".home_viewsettings_checkbox").addClass("checked");
			}
		});
	}

	function totalsize() {
		var html = $("html").html();
		var txt = html.match(/var rgGames = (.+);/);
		var games = JSON.parse(txt[1]);
		var mbt = 0;
		var gbt = 0;
		$.each(games, function(index, value) {
			if (value["client_summary"]) {
				if (/MiB/.test(value["client_summary"]["localContentSize"])) {
					var mb = value["client_summary"]["localContentSize"].match(/(.+) MiB/)
					mbt += parseFloat(mb[1]);
				}
				if (/GiB/.test(value["client_summary"]["localContentSize"])) {
					var gb = value["client_summary"]["localContentSize"].match(/(.+) GiB/)
					gbt += parseFloat(gb[1]);
				}
			}
		});

		mbt = (mbt / 1024);
		var total = (gbt + mbt).toFixed(2);
		$(".clientConnChangingText").before("<p class='clientConnHeaderText'>Total Size:</p><p class='clientConnMachineText'>" + escapeHTML(total) + " GiB</p>");
	}

	function totaltime() {
		var html = $("html").html();
		var txt = html.match(/var rgGames = (.+);/);
		var games = JSON.parse(txt[1]);
		var time = 0;
		$.each(games, function(index, value) {
			if (value["hours_forever"]) {
				time_str=value["hours_forever"].replace(",","");
				time+=parseFloat(time_str);
			}
		});
		var total = time.toFixed(1);
		$(".clientConnChangingText").before("<div style='float:right;'><p class='clientConnHeaderText'>" + escapeHTML(language.total_time) + ":</p><p class='clientConnMachineText'>" + escapeHTML(total) + " Hours</p></div>");
	}

	function add_gamelist_sort() {
		//Figure out where they are supposed to be looking.
		if ($(".clientConnChangingText").length > 0) {
		//if (true){
			$("#gameslist_sort_options").append("&nbsp;&nbsp;<label id='es_gl_sort_size'><a>" + escapeHTML(language.size) + "</a></label>");

			$("#es_gl_sort_size").on("click", function() {
				var gameRowsGB = [];
				var gameRowsMB = [];

				$(".clientConnItemBlock").find(".clientConnItemText:last").each(function (index, value) {
					var push = new Array();
					var size = ($(value).text());
					var row = ($(this).parent().parent().parent().parent());

					if (size) {

						push[0] = row[0].outerHTML;
						push[1] = size.replace(" GiB", "").replace(" MiB", "").replace(",", "");

						if (size.match(/GiB/)) {
							gameRowsGB.push(push);
						}

						if (size.match(/MiB/)) {
							gameRowsMB.push(push);
						}

						$(row).remove();
					}
				});

				gameRowsGB.sort(function(a,b) { return parseInt(a[1],10) - parseInt(b[1],10); });
				gameRowsMB.sort(function(a,b) { return parseInt(a[1],10) - parseInt(b[1],10); });

				$(gameRowsMB).each(function() {
					$("#games_list_rows").prepend(this[0]);
				});

				$(gameRowsGB).each(function() {
					$("#games_list_rows").prepend(this[0]);
				});

				$(this).html("<span style='color: #B0AEAC;'>" + escapeHTML(language.size) + "</span>");
				var html = $("#gameslist_sort_options").find("span[class='selected_sort']").html();
				html = "<a onclick='location.reload()'>" + html + "</a>";
				$("#gameslist_sort_options").find("span[class='selected_sort']").html(html);
			});
		}
	}
//Use what steam already has in place for "Filtering Games that you both own" and put "Hide Games that you do not own" behind it.
	function add_gamelist_common() {
		if($("label").attr("for")=="show_common_games") {
			superSteamAsset.get('//steamcommunity.com/profiles/' + is_signed_in + '/games/?xml=1', function (txt) {
				var dom = $.parseXML(txt);
				$("label, [for=show_common_games]").hide();
				$("#gameFilter").parent().after("<label for=\"es_gl_show_common_games\" id=\"es_gl_show_common_games_label\">"+language.common_label+"</label>");


			});
		}
	}
	function add_gamelist_filter() {
		if ($(".clientConnChangingText").length > 0) {
			var html  = "<span>" + escapeHTML(language.show) + ": </span>";
			html += "<label class='es_sort' id='es_gl_all'><input type='radio' name='es_gl_sort' checked><span><a>" + escapeHTML(language.games_all) + "</a></span></label>";
			html += "<label class='es_sort' id='es_gl_installed'><input type='radio' name='es_gl_sort' id='es_gl_installed_input'><span><a>" + escapeHTML(language.games_installed) + "</a></span></label>";
			html += "</div>";

			$('#gameslist_sort_options').append("<br>" + html);

			$('#es_gl_all').on('click', function() {
				$('.gameListRow').css('display', 'block');
				$("#es_gl_all_input").prop("checked", true);
			});

			$('#es_gl_installed').on('click', function() {
				$('.gameListRowItem').find(".color_uninstalled").parent().parent().css("display", "none");
				$('.gameListRowItem').find(".color_disabled").parent().parent().css("display", "none");
				$("#es_gl_installed_input").prop("checked", true);

			});
		}
	}

	function add_gamelist_achievements() {
		if (userPrefs.showAllAchievements) {
			if (window.location.href.match(/\/games\/\?tab=all/)) {
				$(".gameListRow").each(function(index, value) {
					var appid = get_appid_wishlist(value.id);
					if ($(value).html().match(/ico_stats.png/)) {
						if (!($(value).html().match(/<h5><\/h5>/))) {
							$(value).find(".gameListRowItemName").append("<div class='es_recentAchievements' id='es_app_" + escapeHTML(appid) + "' style='margin-top:30px;'>");
							$("#es_app_" + appid).html(language.loading);
							superSteamAsset.get($(".profile_small_header_texture a")[0].href + '/stats/' + appid, function (txt) {
								txt = txt.replace(/[ ]src=/g," data-src=");
								var parsedhtml = $.parseHTML(txt);
								$("#es_app_" + appid).html($(parsedhtml).find("#topSummaryAchievements"));
								$("#es_app_" + appid).find("img").each(function() {
									var src = $(this).attr("data-src");
									$(this).attr("src", src);
								});
								var BarFull,
								BarEmpty;
								if ($("#es_app_" + appid).html().match(/achieveBarFull\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/)) {
									BarFull = $("#es_app_" + appid).html().match(/achieveBarFull\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/)[1];
								}
								if ($("#es_app_" + appid).html().match(/achieveBarEmpty\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/)) {
									BarEmpty = $("#es_app_" + appid).html().match(/achieveBarEmpty\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/)[1];
								}
								BarFull = BarFull * .58;
								BarEmpty = BarEmpty * .58;
								var html = $("#es_app_" + appid).html();
								html = html.replace(/achieveBarFull\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/, "achieveBarFull.gif\" border='0' height='12' width=\"" + escapeHTML(BarFull.toString()) + "\"");
								html = html.replace(/achieveBarEmpty\.gif" border="0" height="12" width="([0-9]|[1-9][0-9]|[1-9][0-9][0-9])"/, "achieveBarEmpty.gif\" border='0' height='12' width=\"" + escapeHTML(BarEmpty.toString()) + "\"");
								html = html.replace("::", ":");
								$("#es_app_" + appid).html(html);
							});
						}
					}
				});
			}
		}
	}

	function add_cardexchange_links(game) {
		$(".badge_row").each(function (index, node) {
			var $node = $(node);
			var steamCardExchange = assetUrls.img_steamcardexchange;
			var gamecard = game || get_gamecard($node.find(".badge_row_overlay").attr('href'));
			if(!gamecard) return;
			$node.prepend('<div style="position: absolute; z-index: 3; top: 12px; right: 12px;" class="es_steamcardexchange_link"><a href="http://www.steamcardexchange.net/index.php?gamepage-appid-' + escapeHTML(gamecard) + '" target="_blank" alt="Steam Card Exchange" title="Steam Card Exchange"><img src="' + assetUrls.img_steamcardexchange + '" width="24" height="24" border="0" /></a></div>');
			$node.find(".badge_title_row").css("padding-right", "44px");
		});
	}

	function add_badge_filter() {

		var resetLazyLoader = function () {
			runInPageContext(function () {
				// Clear registered image lazy loader watchers (CScrollOffsetWatcher is found in shared_global.js)
				CScrollOffsetWatcher.sm_rgWatchers = [];

				// Recreate registered image lazy loader watchers
				$J('div[id^=image_group_scroll_badge_images_gamebadge_]').each(function(i,e){
					// LoadImageGroupOnScroll is found in shared_global.js
					LoadImageGroupOnScroll(e.id, e.id.substr(19));
				});
			});
		};

		function add_badge_filter_processing() {
			$('.is_link').each(function () {
				if (!($(this).html().match(/progress_info_bold".+\d/))) {
					$(this).css('display', 'none');
				} else if (parseFloat($(this).html().match(/progress_info_bold".+?(\d+)/)[1]) == 0) {
					$(this).css('display', 'none');
				} else {
					if ($(this).html().match(/badge_info_unlocked/)) {
						if (!($(this).html().match(/badge_current/))) {
							$(this).css('display', 'none');
						}
					}
					// Hide foil badges too
					if (!($(this).html().match(/progress_info_bold/))) {
						$(this).css('display', 'none');
					}
				}
			});
			resetLazyLoader();
		}

		if (window.location.href.match(/\/$/) || window.location.href.match(/p\=1$/)) {
			var filter_done = false;

			if ( $(".profile_small_header_texture a")[0].href == $(".playerAvatar:first a")[0].href.replace(/\/$/, "")) {
				var html =
					"<div style='text-align: right;'><span>"
					+ language.show
					+ ": </span>";
				html +=
					"<label class='badge_sort_option whiteLink es_badges' id='es_badge_all'><input type='radio' name='es_badge_sort' checked><span>"
					+ language.badges_all
					+ "</span></label>";
				html +=
					"<label class='badge_sort_option whiteLink es_badges' id='es_badge_drops'><input type='radio' name='es_badge_sort'><span>"
					+ language.badges_drops
					+ "</span></label>";
				html += "</div>";

				$('.profile_badges_header').append(html);

				$('#es_badge_all').on('click', function() {
					$('.is_link').css('display', 'block');
					resetLazyLoader();
				});

				$('#es_badge_drops').on('click', function (event) {
					event.preventDefault();
					$("#es_badge_drops").find("input").prop("checked", true);

					// Load additional badge sections if multiple pages are present
					if ($(".pagebtn").length > 0 && filter_done == false) {
						var base_url = window.location.origin + window.location.pathname + "?p=",
						last_page = parseFloat($(".profile_paging:first").find(".pagelink:last").text()),
						deferred = new $.Deferred(),
						promise = deferred.promise(),
						pages = [];

						for (page = 2; page <= last_page; page++) {
							pages.push(page);
						}

						$.each(pages, function (i, item) {
							promise = promise.then(function() {
								return $.ajax(base_url + item).done(function (data) {
									var html = $.parseHTML(data);
									$(html).find(".badge_row").each(function(i, obj) {
										$(".badges_sheet").append(obj);
									});
								});
							});
						});

						promise.done(function() {
							$(".profile_paging").css("display", "none");
							filter_done = true;
							add_badge_filter_processing();
						});

						deferred.resolve();
					}
					else {
						add_badge_filter_processing();
					}
				});
			}
		}
	}

	function add_badge_sort() {
		if ( $(".profile_small_header_texture a")[0].href == $(".playerAvatar:first a")[0].href.replace(/\/$/, "")) {
			if ($(".profile_badges_sortoptions").find("a[href$='sort=r']").length > 0) {
				$(".profile_badges_sortoptions").find("a[href$='sort=r']")
				.after("&nbsp;&nbsp;<a class='badge_sort_option whiteLink' id='es_badge_sort_drops'>" + escapeHTML(language.most_drops)	+ "</a>&nbsp;&nbsp;<a class='badge_sort_option whiteLink' id='es_badge_sort_value'>" + escapeHTML(language.drops_value) + "</a>");
			}

			var resetLazyLoader = function() {
				runInPageContext(function() {
					// Clear registered image lazy loader watchers (CScrollOffsetWatcher is found in shared_global.js)
					CScrollOffsetWatcher.sm_rgWatchers = [];

					// Recreate registered image lazy loader watchers
					$J('div[id^=image_group_scroll_badge_images_gamebadge_]')
					.each(function (i,e) {
						// LoadImageGroupOnScroll is found in shared_global.js
						LoadImageGroupOnScroll(e.id, e.id.substr(19));
					});
				});
			};

			function add_badge_sort_drops() {
				var badgeRows = [];
				$('.badge_row').each(function () {
					var push = new Array();
					if ($(this).html().match(/progress_info_bold".+\d/)) {
						push[0] = this.outerHTML;
						push[1] = $(this).find(".progress_info_bold").html().match(/\d+/)[0];
					} else {
						push[0] = this.outerHTML;
						push[1] = "0";
					}
					badgeRows.push(push);
					this.parentNode.removeChild(this);
				});

				badgeRows.sort(function (a,b) {
					var dropsA = parseInt(a[1],10);
					var dropsB = parseInt(b[1],10);

					if (dropsA < dropsB) {
						return 1;
					} else {
						return -1;
					}
				});

				$('.badge_row').each(function () {
					$(this).css("display", "none");
				});

				$(badgeRows).each(function() {
					$(".badges_sheet:first").append(this[0]);
				});

				$(".active").removeClass("active");
				$("#es_badge_sort_drops").addClass("active");
				resetLazyLoader();
			}

			var sort_drops_done = false;

			$("#es_badge_sort_drops").on("click", function() {
				if ($(".pagebtn").length > 0 && sort_drops_done == false) {
					var base_url = window.location.origin + window.location.pathname + "?p=",
					last_page = parseFloat($(".profile_paging:first").find(".pagelink:last").text()),
					deferred = new $.Deferred(),
					promise = deferred.promise(),
					pages = [];

					for (page = 2; page <= last_page; page++) {
						pages.push(page);
					}

					$.each(pages, function (i, item) {
						promise = promise.then(function() {
							return $.ajax(base_url + item).done(function(data) {
								var html = $.parseHTML(data);
								$(html).find(".badge_row").each(function(i, obj) {
									$(".badges_sheet").append(obj);
								});
							});
						});
					});

					promise.done(function() {
						$(".profile_paging").css("display", "none");
						sort_drops_done = true;
						add_badge_sort_drops();
					});

					deferred.resolve();
				} else {
					add_badge_sort_drops();
				}
			});

			$("#es_badge_sort_value").on("click", function() {
				var badgeRows = [];
				$('.badge_row').each(function () {
					var push = new Array();
					if ($(this).find(".es_card_drop_worth").length > 0) {
						push[0] = this.outerHTML;
						push[1] = $(this).find(".es_card_drop_worth").html();
					} else {
						push[0] = this.outerHTML;
						push[1] = language.drops_worth_avg;
					}
					badgeRows.push(push);
					$(this).remove();
				});

				badgeRows.sort(function(a, b) {
					var worthA = a[1];
					var worthB = b[1];

					if (worthA < worthB) {
						return 1;
					} else {
						return -1;
					}
				});

				$('.badge_row').each(function () { $(this).css("display", "none"); });

				$(badgeRows).each(function() {
					$(".badges_sheet:first").append(this[0]);
				});

				$(".active").removeClass("active");
				$(this).addClass("active");
				resetLazyLoader();
			});
		}
	}

	function add_achievement_sort() {

		if ($("#personalAchieve").length > 0 || $("#achievementsSelector").length > 0) {

				$("#tabs").before("<div id='achievement_sort_options' class='sort_options'>" + language.sort_by + "<span id='achievement_sort_default'>" + language.theworddefault + "</span><span id='achievement_sort_date' class='es_achievement_sort_link'>" + language.date_unlocked + "</span></div>");
				$("#personalAchieve, #achievementsSelector").clone().insertAfter("#personalAchieve, #achievementsSelector").attr("id", "personalAchieveSorted").hide();

				var achRows = [];
				$("#personalAchieveSorted").find(".achieveUnlockTime").each(function() {
					var push = new Array();
					push[0] = $(this).parent().parent().prev();
					$(this).parent().parent().next().remove();
					$(this).parent().parent().next().remove();
					$(this).parent().parent().next().remove();
					push[1] = $(this).parent().parent();
                                        $(this).parent().parent().parent().remove();
					var unlocktime = $(this).text().trim().replace(/^.+\: /, "").replace(/jan/i, "01").replace(/feb/i, "02").replace(/mar/i, "03").replace(/apr/i, "04").replace(/may/i, "05").replace(/jun/i, "06").replace(/jul/i, "07").replace(/aug/i, "08").replace(/sep/i, "09").replace(/oct/i, "10").replace(/nov/i, "11").replace(/dec/i, "12");
					var year = new Date().getFullYear();
					if ($(this).text().replace(/^.+\: /, "").match(/^\d/)) {
						var parts = unlocktime.match(/(\d+) (\d{2})(?:, (\d{4}))? \@ (\d+):(\d{2})(am|pm)/);
					} else {
						var parts = unlocktime.match(/(\d{2}) (\d+)(?:, (\d{4}))? \@ (\d+):(\d{2})(am|pm)/);
					}

					if (parts[3] === undefined) parts[3] = year;
					if (parts[6] == "pm" && parts[4] != 12) parts[4] = (parseFloat(parts[4]) + 12).toString();
					if (parts[6] == "am" && parts[4] == 12) parts[4] = (parseFloat(parts[4]) - 12).toString();

					if ($(this).text().replace(/^.+\: /, "").match(/^\d/)) {
						push[2] = Date.UTC(+parts[3], parts[2]-1, +parts[1], +parts[4], +parts[5]) / 1000;
					} else {
						push[2] = Date.UTC(+parts[3], parts[1]-1, +parts[2], +parts[4], +parts[5]) / 1000;
					}
					achRows.push(push);
				});

				achRows.sort();

				$(achRows).each(function() {
                                    $("#personalAchieveSorted").before(
                                            $("<div class='achieveRow'>").append(this[0], this[1])
                                    );
                                });

				$("#achievement_sort_default").on("click", function() {
					$(this).removeClass('es_achievement_sort_link');
					$("#achievement_sort_date").addClass("es_achievement_sort_link");
					$("#personalAchieve, #achievementsSelector").show();
					$("#personalAchieveSorted").hide();
				});

				$("#achievement_sort_date").on("click", function() {
					$(this).removeClass('es_achievement_sort_link');
					$("#achievement_sort_default").addClass("es_achievement_sort_link");
					$("#personalAchieve, #achievementsSelector").hide();
					$("#personalAchieveSorted").show();
				});
			}

	}

	function add_badge_view_options() {
		var html  = "<div style='text-align: right;'><span>" + escapeHTML(language.view) + ": </span>";
		html += "<label class='badge_sort_option whiteLink es_badges' id='es_badge_view_default'><input type='radio' name='es_badge_view' checked><span>" + escapeHTML(language.theworddefault) + "</span></label>";
		html += "<label class='badge_sort_option whiteLink es_badges' id='es_badge_view_binder'><input type='radio' name='es_badge_view'><span>" + escapeHTML(language.binder_view) + "</span></label>";
		html += "</div>";

		$('.profile_badges_header').append(html);

		$("#es_badge_view_default").on('click', function() {
			window.location.reload();
		});

		$("#es_badge_view_binder").on('click', function() {
			$('.is_link').each(function () {
				var stats = $(this).find("span[class$='progress_info_bold']").html();
				$(this).find("div[class$='badge_cards']").remove();
				$(this).find("div[class$='badge_title_stats']").css("display", "none");
				$(this).find("div[class$='badge_description']").css("display", "none");
				$(this).find("span[class$='badge_view_details']").remove();
				$(this).find("div[class$='badge_info_unlocked']").remove();
				$(this).find("div[class$='badge_progress_tasks']").remove();
				$(this).find("div[class$='badge_progress_info']").css("padding", "0");
				$(this).find("div[class$='badge_progress_info']").css("float", "none");
				$(this).find("div[class$='badge_progress_info']").css("margin", "0");
				$(this).find("div[class$='badge_progress_info']").css("width", "auto");
				$(this).find("div[class$='badge_title']").css("font-size", "12px");
				$(this).find("div[class$='badge_title_row']").css("padding-top", "0px");
				$(this).find("div[class$='badge_title_row']").css("padding-right", "4px");
				$(this).find("div[class$='badge_title_row']").css("padding-left", "4px");
				$(this).find("div[class$='badge_title_row']").css("height", "24px");
				$(this).find("div[class$='badge_row_inner']").css("height", "195px");
				$(this).find("div[class$='badge_current']").css("width", "100%");
				$(this).find("div[class$='badge_empty_name']").css("clear", "both");
				$(this).find("div[class$='badge_info_title']").css("clear", "both");
				$(this).find("div[class$='badge_info_image']").css("float", "center");
				$(this).find("div[class$='badge_info_image']").css("margin-left", "30px");
				$(this).find("div[class$='badge_empty_circle']").css("float", "center");
				$(this).find("div[class$='badge_empty_circle']").css("margin-left", "45px");
				$(this).find("div[class$='badge_content']").css("padding-top", "0px");
				$(this).css("width", "160px");
				$(this).css("height", "195px");
				$(this).css("float", "left");
				$(this).css("margin-right", "15px");
				$(this).css("margin-bottom", "15px");
				if (stats && stats.match(/\d+/)) {
					if (!($(this).find("span[class$='es_game_stats']").length > 0)) {
						$(this).find("div[class$='badge_content']").first().append("<span class='es_game_stats' style='color: #5491cf; font-size: 12px; white-space: nowrap;'>" + escapeHTML(stats) + "</span>");
					}
				}
				if ($(this).find("div[class$='badge_progress_info']").text()) {
					var card = $(this).find("div[class$='badge_progress_info']").text().trim().match(/(\d+)\D*(\d+)/)[1] + " / " + $(this).find("div[class$='badge_progress_info']").text().trim().match(/(\d+)\D*(\d+)/)[2];
					$(this).find("div[class$='badge_progress_info']").text(card);
				}
			});

			$(".es_steamcardexchange_link").remove();
			$(".badges_sheet").css("text-align", "center");
			$(".badges_sheet").css("margin-left", "32px");
			$(".badge_empty").css("border", "none");
			$("#footer_spacer").before('<div style="display: block; clear: both;"></div>');
		});
	}

	function add_gamecard_foil_link() {
		if ($(".progress_info_bold").length > 0) {
			$(".gamecards_inventorylink").append("<a class='btn_grey_grey btn_small_thin' href='" + escapeHTML(window.location) + "?border=1'><span>View Foil Badge Progress</span></a>");
		}
	}

	function add_gamecard_market_links(game) {
		var foil;
		var url_search = window.location.search;
		var url_parameters_array = url_search.replace("?","").split("&");
		var cost = 0;

		$.each(url_parameters_array,function(index,url_parameter){
			if(url_parameter=="border=1"){
				foil=true;
			}
		});

		superSteamAsset.get("http://store.steampowered.com/app/220/", function(txt) {
			var currency_symbol = currency.symbolFromString($(txt).find(".price, .discount_final_price").text().trim());
			var currency_type = currency.symbolToType(currency_symbol);

			superSteamAsset.get("https://steamwatcher.com/boiler/marketdata/cardprice.php?appid=" + game, function(txt) {
				var data = JSON.parse(txt);
				$(".badge_card_set_card").each(function() {
					var node = $(this);
					var cardname = $(this).html().match(/(.+)<div style=\"/)[1].trim().replace(/&amp;/g, '&');
					if (cardname == "") { cardname = $(this).html().match(/<div class=\"badge_card_set_text\">(.+)<\/div>/)[1].trim().replace(/&amp;/g, '&');; }

					var newcardname = cardname;
					if (foil) { newcardname += " (Foil)"; }

					for (var i = 0; i < data.length; i++) {
						if (data[i].name == newcardname) {
							var marketlink = "http://steamcommunity.com/market/listings/" + data[i].url;
							switch (currency_symbol) {
								case "R$":
								var card_price = currency.format(data[i].price_brl, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_brl);
								break;
								case "€":
								var card_price = currency.format(data[i].price_eur, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_eur);
								break;
								case "pуб":
								var card_price = currency.format(data[i].price_rub, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_rub);
								break;
								case "£":
								var card_price = currency.format(data[i].price_gbp, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_gbp);
								break;
								case "¥":
								var card_price = currency.format(data[i].price_jpy, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_jpy);
								break;
								default:
								var card_price = currency.format(data[i].price, currency_type);
								if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price);
								break;
							}
						}
					}

					if (!(marketlink)) {
						if (foil) { newcardname = newcardname.replace("(Foil)", "(Foil Trading Card)"); } else { newcardname += " (Trading Card)"; }
						for (var i = 0; i < data.length; i++) {
							if (data[i].name == newcardname) {
								var marketlink = "http://steamcommunity.com/market/listings/" + data[i].url;
								switch (currency_symbol) {
									case "R$":
									var card_price = currency.format(data[i].price_brl, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_brl);
									break;
									case "€":
									var card_price = currency.format(data[i].price_eur, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_eur);
									break;
									case "pуб":
									var card_price = currency.format(data[i].price_rub, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_rub);
									break;
									case "£":
									var card_price = currency.format(data[i].price_gbp, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_gbp);
									break;
									case "¥":
									var card_price = currency.format(data[i].price_jpy, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price_jpy);
									break;
									default:
									var card_price = currency.format(data[i].price, currency_type);
									if ($(node).hasClass("unowned")) cost += parseFloat(data[i].price);
									break;
								}
							}
						}
					}

					if (marketlink && card_price) {
						var html = "<a class=\"es_card_search\" href=\"" + marketlink + "\">" + language.lowest_price + ": " + card_price + "</a>";
						$(this).children("div:contains('" + cardname + "')").parent().append(html);
					}
				});
				if (cost > 0 && $(".profile_small_header_name .whiteLink").attr("href") == $("#headerUserAvatarIcon").parent().attr("href")) {
					cost = currency.format(cost, currency_type);
					$(".badge_empty_name:last").after("<div class='badge_info_unlocked' style='color: #5c5c5c;'>" + language.badge_completion_cost+ ": " + cost + "</div>");
					$(".badge_empty_right").css("margin-top", "7px");
					$(".gamecard_badge_progress .badge_info").css("width", "296px");
				}
			});
		});
	}

	function add_badge_completion_cost() {

		if ( $(".profile_small_header_texture :first a")[0].href == $(".playerAvatar:first a")[0].href.replace(/\/$/, "").replace(/\/$/, "")) {
			$(".profile_xp_block_right").append("<div id='es_cards_worth'></div>");
			superSteamAsset.get("http://store.steampowered.com/app/220/", function(txt) {
				var currency_symbol = currency.symbolFromString($(txt).find(".price, .discount_final_price").text().trim());
				var currency_type = currency.symbolToType(currency_symbol);
				var cur, total_worth = 0, count = 0;
				$(".badge_row").each(function() {
					var game = $(this).find(".badge_row_overlay").attr("href").match(/\/(\d+)\//);

					var foil = $(this).find("a:last").attr("href").match(/\?border=1/);
					var node = $(this);
					if (game) {

						var indexForGamecardString = game.input.indexOf("/gamecards/")+11;
						var appid = game.input.slice(indexForGamecardString);
						var gameid = appid.replace("/","");

						var url = "https://steamwatcher.com/boiler/marketdata/averagecardprice.php?appid=" + gameid + "&cur=" + currency_type.toLowerCase();
						//need to test foil url
						if (foil) { url = url + "&foil=true"; }

						superSteamAsset.get(url, function(txt) {
							var jsonString = JSON.stringify(txt)
							var parsedTxt = JSON.parse(jsonString);
							if ($(node).find("div[class$='badge_progress_info']").text()) {
								var card = $(node).find("div[class$='badge_progress_info']").text().trim().match(/(\d+)\D*(\d+)/);
							if (card) { var need = card[2] - card[1]; }
							}

							var cost = (need * parseFloat(parsedTxt)).toFixed(2);

							if ($(node).find(".progress_info_bold").text()) {
								var drops = $(node).find(".progress_info_bold").text().match(/\d+/);
								if (drops) { var worth = (drops[0] * parseFloat(parsedTxt)).toFixed(2);  }
							}

							if (worth > 0) {
								total_worth = total_worth + parseFloat(worth);
							}

							cost = currency.format(cost, currency_type);
							card = currency.format(worth, currency_type);
							worth_formatted = currency.format(total_worth, currency_type);

							if (worth > 0) {
								$(node).find(".how_to_get_card_drops").after("<span class='es_card_drop_worth'>" + escapeHTML(language.drops_worth_avg) + " " + escapeHTML(card) + "</span>")
								$(node).find(".how_to_get_card_drops").remove();
							}

							$(node).find(".badge_empty_name:last").after("<div class='badge_info_unlocked' style='color: #5c5c5c;'>" + escapeHTML(language.badge_completion_avg) + ": " + escapeHTML(cost) + "</div>");
							$(node).find(".badge_empty_right").css("margin-top", "7px");
							$(node).find(".gamecard_badge_progress .badge_info").css("width", "296px");
                                                        
                            $("#es_cards_worth").text(language.drops_worth_avg + " " + worth_formatted);
                                                        
                                                       /*
                                                        if ($(".pagebtn").length < 0 && total_worth > 0) {
								$("#es_cards_worth").text(language.drops_worth_avg + " " + worth_formatted);
							}
                                                    */
						});
					}


				});
			});
		}
	}

	function add_total_drops_count() {
		if ( $(".profile_small_header_texture a")[0].href == $(".playerAvatar:first a")[0].href.replace(/\/$/, ""))  {
			var drops_count = 0,
			drops_games = 0,
			booster_games = 0,
			game_tiles = [];

			if ($(".pagebtn").length > 0) {
				if (window.location.href.match(/\/$/) || window.location.href.match(/p\=1$/)) {
					$(".profile_xp_block_right").prepend("<span id='es_calculations' style='color: #fff;'>" + language.drop_calc + "</span>").css("cursor", "pointer");
					$("#es_calculations").click(function() {
						$(".profile_xp_block_right").css("cursor", "default");
						$("#es_calculations").text(language.loading);

						// First, get the contents of the first page
						$(".progress_info_bold").each(function(i, obj) {
							var parent = $(obj).parent().parent();
							if ($(parent).find(".progress_info_bold")[0]) {
								game_tiles.push(parent);
							}
						});

						// Now, get the rest of the pages
						var base_url = window.location.origin + window.location.pathname + "?p=",
						last_page = parseFloat($(".profile_paging:first").find(".pagelink:last").text()),
						deferred = new $.Deferred(),
						promise = deferred.promise(),
						pages = [];

						for (page = 2; page <= last_page; page++) {
							pages.push(page);
						}

						$.each(pages, function (i, item) {
							promise = promise.then(function() {
								return $.ajax(base_url + item).done(function(data) {
									var html = $.parseHTML(data);
									$(html).find(".progress_info_bold").each(function(i, obj) {
										var parent = $(obj).parent().parent();
										if ($(parent).find(".progress_info_bold")[0]) {
											game_tiles.push(parent);
										}
									});
								});
							});
						});

						promise.done(function() {
							add_total_drops_count_calculations(game_tiles);
						});

						deferred.resolve();
					});
				}
			} else {
				$(".profile_xp_block_right").prepend("<span id='es_calculations' style='color: #fff;'>" + language.drop_calc + "</span>");
				$(".progress_info_bold").each(function(i, obj) {
					var parent = $(obj).parent().parent();
					if ($(parent).find(".progress_info_bold")[0]) {
						game_tiles.push(parent);
					}
				});
				add_total_drops_count_calculations(game_tiles);
			}
			function add_total_drops_count_calculations(games) {
				$(games).each(function(i, obj) {
					var obj_count = obj.find(".progress_info_bold")[0].innerHTML.match(/\d+/);
					if (obj_count && obj_count[0]!='0') {
						drops_count += parseInt(obj_count[0]);
						drops_games = drops_games + 1;
					}
				});


				$(".profile_xp_block_right").html("<span id='es_calculations' style='color: #fff;'>" + language.card_drops_remaining.replace("__drops__", drops_count) + "<br>" + language.games_with_drops.replace("__dropsgames__", drops_games) + "</span>");

				superSteamAsset.get("http://steamcommunity.com/my/ajaxgetboostereligibility/", function(txt) {
					var eligible = $.parseHTML(txt);
					$(eligible).find(".booster_eligibility_games").children().each(function(i, obj) {
						booster_games += 1;
					});

					$("#es_calculations").append("<br>" + language.games_with_booster.replace("__boostergames__", booster_games));
				});
			}

			if ($(".badge_details_set_favorite").find(".btn_grey_black").length > 0) { $(".badge_details_set_favorite").append("<div class='btn_grey_black btn_small_thin' id='es_faq_link'><span>" + language.faqs + "</span></div>"); }
			$("#es_faq_link").click(function() {
				window.location = "http://steamcommunity.com/tradingcards/faq";
			});
		}

	}

	function add_friends_that_play() {
		var appid = window.location.pathname.match(/(?:id|profiles)\/.+\/friendsthatplay\/(\d+)/)[1];

		$.get('http://store.steampowered.com/api/appuserdetails/?appids=' + appid).success(function(data) {
			if (data[appid].success && data[appid].data.friendsown && data[appid].data.friendsown.length > 0) {
				// Steam Web API is awful, let's do it the easiest way.
				$.get('http://steamcommunity.com/my/friends/').success(function(friends_html) {
					friends_html = $(friends_html);

					var friendsown = data[appid].data.friendsown;

					var html = '<div class="mainSectionHeader friendListSectionHeader">';
					html += language.all_friends_own.replace('__friendcount__', friendsown.length);
					html += ' <span class="underScoreColor">_</span>';
					html += '</div>';

					html += '<div class="profile_friends" style="height: ' + (48 * friendsown.length / 3) + 'px;">';

					for (var i = 0; i < friendsown.length; i++) {
						var steamID = friendsown[i].steamid.slice(4) - 1197960265728;
						var friend_html = $(friends_html.find('.friendBlock[data-miniprofile=' + steamID + ']')[0].outerHTML);
						var friend_small_text = language.hours_short.replace('__hours__', Math.round(friendsown[i].playtime_twoweeks / 60 * 10) / 10);
						friend_small_text += ' / ' + language.hours_short.replace('__hours__', Math.round(friendsown[i].playtime_total / 60 * 10) / 10);
						var compare_url = friend_html.find('.friendBlockLinkOverlay')[0].href + '/stats/' + appid + '/compare';
						friend_small_text += '<br><a class="whiteLink friendBlockInnerLink" href="' + compare_url + '">' + language.view_stats + '</a>';
						friend_html.find('.friendSmallText').html(friend_small_text);
						html += friend_html[0].outerHTML;
					}

					html += '</div>';

					$('.friends_that_play_content').append(html);

					// Reinitialize miniprofiles by injecting the function call.

					var injectedCode = 'InitMiniprofileHovers();';
					var script = document.createElement('script');
					script.appendChild(document.createTextNode('(function() { '+ injectedCode +' })();'));
					(document.body || document.head || document.documentElement).appendChild(script);
				});
			}
		});
	}

	//Youtube
	function youtubeContentOnReady(appid) {
		if(userPrefs.showYoutubeVideo){
			youtubeLoader.loadYoutubePlayer(appid);
		} else {
			inlineScriptLoader.load('js/gamehighlightplayer_updated.js').then(()=>{
                return inlineScriptLoader.load('js/playerinit.js');
			});
		}
	}


	function add_decline_button() {
		if (window.location.href.match(/tradeoffers\/$/)) {
			$(".maincontent .profile_leftcol .tradeoffer").each(function(index) {
				var offerID = $(this).attr("id").replace("tradeofferid_", "");
				$(this).prepend("<a href='javascript:DeclineTradeOffer(\"" + offerID + "\");' style='background-image: url(" + assetUrls.img_decline + ");' class='btn_grey_grey btn_es_decline'>&nbsp;</a>");
			});
		}
	}

	function add_acrtag_warning() {

                        var acrtag_subids, acrtag_promise = (function () {
				var deferred = new $.Deferred();
				if (window.location.protocol != "https:") {
					// is the data cached?
					var expire_time = parseInt(Date.now() / 1000, 10) - 8 * 60 * 60;
					var last_updated = localStorageHelpers.getValue("acrtag_subids_time") || expire_time - 1;

					if (last_updated < expire_time) {
						// if no cache exists, pull the data from the website
						superSteamAsset.get("https://steamwatcher.com/boiler/acrtag/acrtagnumbers.php", function(txt) {
							acrtag_subids = txt;
							localStorageHelpers.setValue("acrtag_subids", acrtag_subids);
							localStorageHelpers.setValue("acrtag_subids_time", parseInt(Date.now() / 1000, 10));
							deferred.resolve();
						});
					} else {
						acrtag_subids = localStorageHelpers.getValue("acrtag_subids");
						deferred.resolve();
					}

					return deferred.promise();
				} else {
					deferred.resolve();
					return deferred.promise();
				}
			})();

			acrtag_promise.done(function(){
				var all_game_areas = $(".game_area_purchase_game");
				var acrtag = JSON.parse(localStorageHelpers.getValue("acrtag_subids"));

				$.each(all_game_areas,function(index,app_package){
					var subid = $(app_package).find("input[name='subid']").val();
					if (subid > 0) {
						if (acrtag["acrtag"].indexOf(subid) >= 0) {
							$(this).after('<div class="DRM_notice" style="padding-left: 17px; margin-top: 0px; padding-top: 20px; min-height: 28px;"><div class="gift_icon"><img src="' + assetUrls.img_trading + '" style="float: left; margin-right: 13px;"></div><div data-store-tooltip="' + language.acrtag_tooltip + '">' + language.acrtag_msg + '.</div></div>');
							runInPageContext("function() {BindStoreTooltip($('.DRM_notice [data-store-tooltip]')) }");
						}
					}
				});
			});

		//}
	}

	function add_review_toggle_button() {
		$("#review_create").find("h1").append("<div style='float: right;'><a class='btnv6_lightblue_blue btn_mdium' id='es_review_toggle'><span>▲</span></a></div>");
		$("#review_container").find("p, .avatar_block, .content").wrapAll("<div id='es_review_section'></div>");

		if (localStorageHelpers.getValue("show_review_section")) {
			$("#es_review_toggle").find("span").text("▼");
			$("#es_review_section").hide();
		}

		$("#es_review_toggle").on("click", function() {
			if (localStorageHelpers.getValue("show_review_section") == true) {
				$("#es_review_toggle").find("span").text("▲");
				$("#es_review_section").slideDown();
				localStorageHelpers.setValue("show_review_section", false);
			} else {
				$("#es_review_toggle").find("span").text("▼");
				$("#es_review_section").slideUp();
				localStorageHelpers.setValue("show_review_section", true);
			}
		});
	}

    function remove_supersteam_install_button () {
        $('#install-link').remove();
        $('.bottem-center').remove();
        $('.col-lg-2.col-md-2').remove();

		$("#super-steam-text").html("Thank you for installing Super Steam. <br>Step 1. Login to Steam <br> Step 2. Refresh the page and you will receive your keys.<br><a style='text-decoration:none;' href='http://store.steampowered.com/'>GO TO STEAM</a>");
    }

	// get preference values here
	function init () {
		if (startsWith(window.location.pathname, "/api")) return;
		if (startsWith(window.location.pathname, "/login")) return;
		if (startsWith(window.location.pathname, "/checkout")) return;
		if (startsWith(window.location.pathname, "/join")) return;

		language = localization.getLanguage();

		// Check if the user is signed in
		var signedInPromise = (function () {
			var deferred = new $.Deferred();
			var _isSignedIn = false;
			if (window.location.protocol != "https:") {
				if ($("#global_actions").find(".playerAvatar").length > 0) {
					var user_name2 = $("#global_actions");
					var not_an_profile_url = true;
					var user_name = $("#global_actions").find(".playerAvatar")[0].outerHTML.match(/\/id\/(.+?)"/);

					if(user_name === null){
						not_an_profile_url = false;
						user_name = $("#global_actions")
						.find(".playerAvatar")[0]
						.outerHTML.match(/\profiles\/(.+?)"/);
					}
					if (user_name) {
						if (localStorageHelpers.getValue("steamID")) {
							_isSignedIn = localStorageHelpers.getValue("steamID");
							//test if there is a ssGUID set, if not, get one
							if(localStorageHelpers.getValue("ssGUID")){
								ss_guid = localStorageHelpers.getValue("ssGUID");
								steamKey.getSteamKey(_isSignedIn, ss_guid);
							}else{
                                time = (Math.round(Date.now() / coeff)*coeff);
                                steamKey.getGUID(_isSignedIn,time);
							}

							deferred.resolve(_isSignedIn);
						}else {
							if (not_an_profile_url) {
								superSteamAsset.get("http://steamcommunity.com/id/" + user_name[1])
								.done(function(txt) {
									_isSignedIn = txt.match(/steamid"\:"(.+)","personaname/)[1];
									//check if GUID is set, if it is, get steamkey
									//with steamkey check to see if GUID
									//
									if(localStorageHelpers.getValue("ssGUID")){
										ss_guid = localStorageHelpers.getValue("ssGUID");
										steamKey.getSteamKey(_isSignedIn, ss_guid);
									}else{
										time = (Math.round(Date.now() / coeff)*coeff);
										steamKey.getGUID(_isSignedIn,time);
									}
									localStorageHelpers.setValue("steamID", _isSignedIn);
									deferred.resolve(_isSignedIn);
								});
							}else{
								superSteamAsset.get("http://steamcommunity.com/profiles/" + user_name[1])
								.done(function(txt) {
									_isSignedIn = txt.match(/steamid"\:"(.+)","personaname/)[1];
									if(localStorageHelpers.getValue("ssGUID")){
										ss_guid = localStorageHelpers.getValue("ssGUID");
										steamKey.getSteamKey(_isSignedIn, ss_guid);
									}else{
										time = (Math.round(Date.now() / coeff)*coeff);
										steamKey.getGUID(_isSignedIn,time);
									}
									localStorageHelpers.setValue("steamID", _isSignedIn);
									deferred.resolve(_isSignedIn);
								});
							}
						}
					}
					else {
						localStorageHelpers.delValue("ssGUID");
						localStorageHelpers.delValue("steamID");
						deferred.resolve(_isSignedIn);
					}
				}
				else {
					localStorageHelpers.delValue("ssGUID");
					localStorageHelpers.delValue("steamID");
					deferred.resolve(_isSignedIn);
				}
			}
			else {
				deferred.resolve(_isSignedIn);
			}
			return deferred.promise(_isSignedIn);
		})();

		$.when(
			userPrefsUtils.getAsync(),
			signedInPromise,
			currency.determineUserCurrency(),
			earlyAccess.load(),
			superSteamAsset.getAssetUrlHash()
		)
		.done(function (
			userPrefsResult,
			signedInResult,
			currencyResult,
			earlyAccessResult,
			assetUrlHashResult
		) {
			// populate globals
			userPrefs = userPrefsResult;

			is_signed_in = signedInResult;
			user_currency = currencyResult;
			ea_appids = earlyAccessResult;
			assetUrls = assetUrlHashResult;
			var showACRTAG = true;
			userPrefs.showMetaCriticScores = true;
			userPrefs.showAppDescription = true;
			showcustombg = false;
			showlanguagewarninglanguage = false;
			showlanguagewarning = false;

			// On window load...
			add_super_steam_options();
			add_fake_country_code_warning();
			removeInstallSteamButton();
			remove_about_menu();
			add_header_links();
			process_early_access();
			
			switch (window.location.host) {
				case "www.super-steam.net":
					remove_supersteam_install_button();
					break;
				case "super-steam.net":
					remove_supersteam_install_button();
					break;
				case "store.steampowered.com":
				switch (true) {
					case /^\/cart\/.*/.test(window.location.pathname):
					add_empty_cart_button();
					break;

					case /^\/app\/.*/.test(window.location.pathname):
					var appid = get_appid(window.location.host + window.location.pathname);
					add_app_page_wishlist_changes(appid);
					hide_age_gate(appid);
					drm_warnings("app");
					youtubeContentOnReady(appid);
					add_metacritic_userscore();
					add_steamreview_userscore(appid);
					add_widescreen_certification(appid);
					add_hltb_info(appid);
					add_pcgamingwiki_link(appid);
					add_steamdb_links(appid, "app");
					add_familysharing_warning(appid);
					add_steamchart_info(appid);
					add_steamspy_info(appid);
					add_app_badge_progress(appid);
					add_dlc_checkboxes();
					add_astats_link(appid);
					add_acrtag_warning();
					add_review_toggle_button();
					customize_app_page();
					add_dlc_page_link(appid);
					add_steamcardexchange_link(appid);
					add_app_page_highlights();
					show_pricing_history(appid, "app");
					add_4pack_breakdown();
					display_purchase_date();
					show_regional_pricing();

					display_coupon_message(appid);
					
					break;

					case /^\/sub\/.*/.test(window.location.pathname):
					var subid = get_subid(window.location.host + window.location.pathname);
					
					drm_warnings("sub");
					subscription_savings_check();
					show_pricing_history(subid, "sub");
					add_steamdb_links(subid, "sub");
					add_acrtag_warning();
					show_regional_pricing();
					break;

					case /^\/agecheck\/.*/.test(window.location.pathname):
					send_age_verification();
					break;

					case /^\/account\/.*/.test(window.location.pathname):
					account_total_spent();

					return;
					break;

					case /^\/steamaccount\/addfunds/.test(window.location.pathname):
					add_custom_wallet_amount();
					break;

					case /^\/search\/.*/.test(window.location.pathname):
					endless_scrolling();
					add_hide_button_to_search();
					break;

					case /^\/sale\/.*/.test(window.location.pathname):
					show_regional_pricing();
					break;

					// Storefront-front only
					case /^\/$/.test(window.location.pathname):
					add_popular_tab();
					add_allreleases_tab();
					add_carousel_descriptions();

					window.setTimeout(function() { customize_home_page(); }, 1000);
					break;
				}

				/* Highlights & data fetching */
				start_highlights_and_tags();

				// Storefront homepage tabs.
				bind_ajax_content_highlighting();
				break;

				case "steamcommunity.com":
				add_wallet_balance_to_header();

				switch (true) {
					case /^\/(?:id|profiles)\/.+\/wishlist/.test(window.location.pathname):

					appdata_on_wishlist();

					add_wishlist_notes();
					fix_wishlist_image_not_found();
					add_empty_wishlist_buttons();
					add_wishlist_filter();
					add_wishlist_discount_sort();
					add_wishlist_total();
					add_wishlist_ajaxremove();

					start_highlights_and_tags();
					break;

					case /^\/(?:id|profiles)\/.+\/\b(home|myactivity|status)\b/.test(window.location.pathname):
					start_friend_activity_highlights();
					bind_ajax_content_highlighting();
					break;

					case /^\/(?:id|profiles)\/.+\/inventory/.test(window.location.pathname):
					bind_ajax_content_highlighting();
					inventory_market_prepare();
					hide_empty_inventory_tabs();
					add_badge_crafting_completion();
					break;

					case /^\/(?:id|profiles)\/(.+)\/games/.test(window.location.pathname):
					add_gamelist_filter();
					add_gamelist_common();
					add_gamelist_sort();
					totaltime();
					totalsize();
					add_gamelist_achievements();



					break;

					case /^\/(?:id|profiles)\/.+\/badges/.test(window.location.pathname):

					add_cardexchange_links();

					add_badge_sort();
					add_badge_view_options();
					add_total_drops_count();
					add_badge_filter();
					add_badge_completion_cost();
					break;

					case /^\/(?:id|profiles)\/.+\/stats/.test(window.location.pathname):
					add_achievement_sort();
					break;

					case /^\/(?:id|profiles)\/.+\/gamecard/.test(window.location.pathname):
					var gamecard = get_gamecard(window.location.pathname);
					add_cardexchange_links(gamecard);
					add_gamecard_market_links(gamecard);
					add_gamecard_foil_link();
					break;

					case /^\/(?:id|profiles)\/.+\/friendsthatplay/.test(window.location.pathname):
					add_friends_that_play();
					break;

					case /^\/(?:id|profiles)\/.+\/tradeoffers/.test(window.location.pathname):
					add_decline_button();
					break;

					case /^\/(?:id|profiles)\/.+/.test(window.location.pathname):
					add_community_profile_links();
					add_wishlist_profile_link();
					fix_profile_image_not_found();
					break;

					case /^\/(?:sharedfiles|workshop)\/.*/.test(window.location.pathname):
					hide_greenlight_banner();
					break;
					case /^\/market\/.*/.test(window.location.pathname):

					loadInventory.getInventory().then(() => {
						highlight_market_items();
						bind_ajax_content_highlighting();
					});

					add_market_total();
					add_active_total();
					add_lowest_market_price();
					break;

					case /^\/app\/.*/.test(window.location.pathname):
					var appid = get_appid(window.location.host + window.location.pathname);
                    click_through_mature_filter();
					add_steamdb_links(appid, "gamehub");
					break;

					case /^\/games\/.*/.test(window.location.pathname):
					var appid = document.querySelector( 'a[href*="http://steamcommunity.com/app/"]' );
					appid = appid.href.match( /(\d)+/g );
					add_steamdb_links(appid, "gamegroup");
					break;
				}
				break;
			}
		});

	};

	init();

})();
