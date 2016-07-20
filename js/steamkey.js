(function(){

    define("get-steam-key", function () {
        var $ = require('jquery');

        var _steamKey = {

            getSteamKey: function(userID){
                
                console.log("steamkeys ran");
                function displayKeyBanner (data) {
                    console.log("data ran");
                    console.log(data);
                    if (data[0] !== "false"){
                        if (data[0] === "noKeys"){
                            $('body').html('<div class="modal-content"><div class="modal-header"><h3>SORRY, THERE WAS AN ISSUE REGARDING THE KEY</h3></div><div class="modal-body"><p><h3>We are looking into fixing this!</h3></p><a href="http://store.steampowered.com/" id="returnLink">Return to Steam Website</a></div><div class="modal-footer"><h3>SORRY FOR THE INCONVIENCE</h3></div></div>');
                        }else{
                            $('body').html('<div class="modal-content"><div class="modal-header"><h3>YOUR STEAM KEY IS BELOW!</h3></div><div class="modal-body"><p id="steamKey"></p><a href="http://store.steampowered.com/" id="returnLink">Return to Steam Website</a></div><div class="modal-footer"><h3>HAVE FUN!</h3></div></div>');
                            $('#steamKey').html(data.toString());
                        }
                    }
                }
                 
                return $.ajax({
                    type: "POST",
                    url: "http://www.super-steam.net/userRequest.php",
                    data: {userID:userID},
                    dataType: "json"
                }).then(displayKeyBanner);
                
            }


        }

        return _steamKey;

    });
})();