<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

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
//$sql = "INSERT INTO `userNames` (`userName`) VALUES ('pmcter1')";
$userName = $_POST['data'];
$sql = "INSERT INTO `supersteam_wordpress`.`userNames` (`id`, `updated`, `userName`) VALUES (NULL, '0000-00-00 00:00:00', 'Dr. Pyrococc.us')";
$result = $db_connection->mysql_query($sql);

/*
while($row = $result->fetch_assoc()){
	foreach($row as $value){
		//printf ("%s\n",$value);
	}
}*/
//echo $row['id'];
//echo $value['id'];
//echo $value;

//$sqlX = "DELETE FROM `gameKeys` WHERE `gameKey` = '".$value."'";
//$resultX = $db_connection->query($sqlX);

?>
