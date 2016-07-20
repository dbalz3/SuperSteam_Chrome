<?php
?>
<head>
    <link rel="chrome-webstore-item" href="https://chrome.google.com/webstore/detail/omkbdlmmegdiaohdnfoomogoibapgcof">
    <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
</head>
<body>
<button onclick="chrome.webstore.install('https://chrome.google.com/webstore/detail/omkbdlmmegdiaohdnfoomogoibapgcof', successCallback, failureCallback)" id="install-button">Add to Chrome</button>
<script>
if (chrome.app.isInstalled) {
  document.getElementById('install-button').style.display = 'none';
    
}

function successCallback()
{
    document.getElementById('install-button').style.display = 'none';
    alert("did it")
    console.log("This is working!");
    
    var test = $.ajax({
                type: 'POST',
                url: 'keyRequest.php',
                success: function(value) {
                    alert(value);
                    //console.log(value);
                    //$("p").text(value);

                    }
        });
     
}

function failureCallback()
{
    alert("didn't do it")
}

</script>
    
    
</body>