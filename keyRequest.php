<?php
ini_set('display_errors', 'On');
error_reporting (E_ALL);

//unless this is the only script that will be accessing the DB
//please make a DB object that you can include on all scripts
//so you dont have to keep re-defining these
define("DB_HOST", "127.0.0.1");
define("DB_NAME", "supersteam_wordpress");
define("DB_USER", "root");
define("DB_PASS", "LZ3^=vghsql1!");




// create a database connection
$db_connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// change character set to utf8 and check it
if (!$db_connection->set_charset("utf8"))
{
    $errors[] = $db_connection->error;
}

// check if user or email address already exists
$sql = "SELECT gameKey FROM gameKeys LIMIT 1;";

$result = $db_connection->query($sql);

while($row = $result->fetch_assoc()){
	foreach($row as $value){
		//printf ("%s\n",$value);
	}
}
//echo $row['id'];
//echo $value['id'];
echo $value;

$sqlX = "DELETE FROM `gameKeys` WHERE `gameKey` = '".$value."'";
$resultX = $db_connection->query($sqlX);

?>
