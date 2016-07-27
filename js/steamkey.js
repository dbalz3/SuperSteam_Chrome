(function(){

    define("get-steam-key", function () {
        var $ = require('jquery');

        var _steamKey = {

            getSteamKey: function(userID){
                
                console.log("steamkeys ran");
                function displayKeyBanner (data) {
                    console.log("data ran");
                    //console.log(data);
                    if (data[0] !== "false"){
                        if (data[0] === "noKeys"){
                            $('body').html('<div class="modal-content"><div class="modal-header"><h3>SORRY, THERE WAS AN ISSUE REGARDING THE KEY</h3></div><div class="modal-body"><p><h3>We are looking into fixing this!</h3></p><a href="http://store.steampowered.com/" id="returnLink">Return to Steam Website</a></div><div class="modal-footer"><h3>SORRY FOR THE INCONVIENCE</h3></div></div>');
                        }else{
                            
                            //WORK ON THIS STUFF HERE! 
                            var stringData = JSON.stringify(data);
                            
                            var keyA = stringData.substring(2, 25);
                            var keyB = stringData.substring(26, 49);
                            var keyC = stringData.substring(50, 73);
                            var keyD = stringData.substring(74, 97);
                            var keyE = stringData.substring(98, 121);
                            
                            var count = 0;
                            var keyCount = stringData.indexOf('Key');
                            
                            while (keyCount !== -1) {
                              count++;
                              keyCount = stringData.indexOf('Key', keyCount + 1);
                            }

                            console.log(count); 
                            
                            
                            //this code below works!!!
                            $('body').html('<div class="modal-content"><div class="modal-header"><h3>YOUR STEAM KEY IS BELOW!</h3></div><div class="modal-body"><p id="steamKeyA"></p><br><p id="steamKeyB"></p><br><p id="steamKeyC"></p><br><p id="steamKeyD"></p><br><p id="steamKeyE"></p><a href="http://store.steampowered.com/" id="returnLink">Return to Steam Website</a></div><div class="modal-footer"><h3>HAVE FUN!</h3></div></div>');
                            $('#steamKeyA').html(keyA.toString());
                            $('#steamKeyB').html(keyB.toString());
                            $('#steamKeyC').html(keyC.toString());
                            $('#steamKeyD').html(keyD.toString());
                            $('#steamKeyE').html(keyE.toString());
                            //$('#steamKey').html(data.toString());
                           
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