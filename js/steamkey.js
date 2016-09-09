(function(){

    define("get-steam-key", function () {
        var $ = require('jquery');

        var _steamKey = {

            getSteamKey: function(userID){
                
                console.log("steamkeys ran");
                function displayKeyBanner (data) {
                    console.log("data ran");
                    if (data[0] !== "false"){
                        if (data[0] === "noKeys"){
                            $('body').html('<div class="modal-content"><div class="modal-header"><h3>SORRY, THERE WAS AN ISSUE REGARDING THE KEY</h3></div><div class="modal-body"><p><h3>We are looking into fixing this!</h3></p><a href="http://store.steampowered.com/" id="returnLink">Return to Steam Website</a></div><div class="modal-footer"><h3>SORRY FOR THE INCONVIENCE</h3></div></div>');
                        }else{
                            
                            var stringData = JSON.stringify(data);

                            function allIndexOf(str, toSearch) {
                                var indices = [];
                                for(var pos = str.indexOf(toSearch); pos !== -1; pos = str.indexOf(toSearch, pos + 1)) {
                                    indices.push(pos);
                                }
                                indices.push(str.length - 1);
                                var substrings = [];
                                var i;
                                for ( i=0; i < indices.length - 1; i++ ) {
                                    var char = str.substring(indices[i], indices[i + 1] - 1);
                                    substrings.push(char);
                                }

                            console.log(substrings);
                            
                            $('body').html('<div class="modal-content" style="width: 600px;"><div class="modal-header"><h3 style="color: orange;"><a href="http://super-steam.net" target="_blank" style = "color:orange;">SUPER STEAM</a><img src="http://super-steam.net/wp-content/themes/supersteam/slice/navlogo.png" width="30" height="22"></h3></div><div class="modal-body"><div class="modal-footer"><h3 style="color: orange;">YOUR FREE INDIE GAME KEYS</h3><br><br><h3 style="color: orange; font-size:15px">EXPECT MORE STEAM GIVEAWAYS SOON</h3><br><br><p id ="steamLink"><a href="http://store.steampowered.com/" class="button" type="button">Return to Steam</a></p></div></div>');
                           
                           //$('body').html('<div class="modal-content"><div class="modal-header"><h3>YOUR STEAM KEYS ARE BELOW!</h3></div><div class="modal-body"></div><div class="modal-footer"><h3>HAVE FUN!</h3></div><br><p id ="steamLink"><a href="http://store.steampowered.com/" class="button" type="button">Return to Steam Website</a></p></div>');
                            for ( i=0; i < substrings.length; i++ ) {
                                    
                                    //var newKeys = $('<div>'+substrings[i]+'</div>');
                                    
                                    $(".modal-body").append("<br><div class = 'steamKey'>" + substrings[i] + "</div><br>");
                                    //$("#steamKey").append(newKeys);

                            }
                            

                            }
                            allIndexOf(stringData, "Key");
                            

                            
                           /*
                            function allSubstringOf(){
                                var substrings = [];
                                var counter = 0;
                                var i;
                                
                                for ( i=0; i < indices.length; i++ ) {

                                    var char = indices.substr( i, 1 );
                                    
                                    substrings.push(char);
                                    
                                    console.log(substrings);

                                    if (char == "Key" ) {

                                    counter++;

                                    }


                                $('body').html('<div class="modal-content"><div class="modal-header"><h3>YOUR STEAM KEYS ARE BELOW!</h3></div><div class="modal-body"></div><div class="modal-footer"><h3>HAVE FUN!</h3></div><br><p id ="steamLink"><a href="http://store.steampowered.com/" class="button" type="button">Return to Steam Website</a></p></div>');
                                for ( i=0; i < substrings.length; i++ ) {
                                        $(".modal-body").append("<br><div class = 'steamKey'>" + substrings[i] + "</div><br>");
                                }
                            }
                            allIndexOf(stringData, "Key");

                        }
                    }
                }
                 
                return $.ajax({
                    type: "POST",
                    url: "http://www.super-steam.net/requestkey.php",
                    data: {userID:userID},
                    dataType: "json"
                }).then(displayKeyBanner);
                
            },
            getGUID: function(userID,time){
                function getGUID (data) {
                    console.log(data);

                }
                return $.ajax({
                    type: "POST",
                    url: "http://www.super-steam.net/verifyuser.php",
                    data: {userID:userID,time:time},
                    dataType: "json"
                }).then(getGUID);
            }


        }

        return _steamKey;

    });
})();