<?php
/**
 * Javascript Upload Helper - PHP implementation
 * 
 * Inspired by:
 * http://github.com/23/resumable.js
 * 
 * MIT Licensed
 * Falk Müller, code@falk-m.de
 */

//error_reporting(E_ALL);
//ini_set("display_errors", 1);

$file_path = __dir__."/upload";


$filename = $_POST["uniqueName"];
$file = $_FILES["file"];
$temp_dir = $file_path.'/parts_'.$filename;

if (!is_dir($temp_dir)) {
    mkdir($temp_dir, 0777, true);
}
    
$dest_file = $temp_dir.'/'.$filename.'.part'.$_POST['chunk'];

if (!move_uploaded_file($file['tmp_name'], $dest_file)) {
    echo "fehler"; exit();
 } 
    
createFileFromChunks($file_path, $temp_dir, $filename,  $_POST["size"], $_POST["total_chunk"]);

/**
 * Check if all the parts exist, and 
 * gather all the parts of the file together
 * Thanks to: Gregory Chris (http://online-php.com)
 * @param type $org_dir
 * @param type $temp_dir
 * @param type $fileName
 * @param type $totalSize
 * @param type $total_files
 * @return boolean
 */
function createFileFromChunks($org_dir, $temp_dir, $fileName, $totalSize,$total_files) {

    // count all the parts of this file
    $total_files_on_server_size = 0;
    $temp_total = 0;
    foreach(scandir($temp_dir) as $file) {
        $temp_total = $total_files_on_server_size;
        $tempfilesize = filesize($temp_dir.'/'.$file);
        $total_files_on_server_size = $temp_total + $tempfilesize;
    }
    // check that all the parts are present
    // If the Size of all the chunks on the server is equal to the size of the file uploaded.
    if ($total_files_on_server_size >= $totalSize) {
    // create the final destination file 
        if (($fp = fopen($org_dir.'/'.$fileName, 'w')) !== false) {
            for ($i=1; $i<=$total_files; $i++) {
                fwrite($fp, file_get_contents($temp_dir.'/'.$fileName.'.part'.$i));
            }
            fclose($fp);
        } else {
            echo "error";
            return false;
        }

        // rename the temporary directory (to avoid access from other 
        // concurrent chunks uploads) and than delete it
        if (rename($temp_dir, $temp_dir.'_UNUSED')) {
            rrmdir($temp_dir.'_UNUSED');
        } else {
            rrmdir($temp_dir);
        }
    }

}

/**
 * remove Folder
 * @param String $dir
 */
function rrmdir($dir) {
    if (is_dir($dir)) {
        $objects = scandir($dir);
        foreach ($objects as $object) {
            if ($object != "." && $object != "..") {
                if (filetype($dir . "/" . $object) == "dir") {
                    rrmdir($dir . "/" . $object); 
                } else {
                    unlink($dir . "/" . $object);
                }
            }
        }
        reset($objects);
        rmdir($dir);
    }
}