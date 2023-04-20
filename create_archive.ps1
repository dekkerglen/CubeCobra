
$files = Get-ChildItem -Path . -Exclude ".git","private","temp",".env","node_modules"

Compress-Archive -Path $files -DestinationPath Archive.zip
