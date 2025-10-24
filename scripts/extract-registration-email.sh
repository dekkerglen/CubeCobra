#!/bin/bash

EMAIL_HTML=$(curl --silent 'localhost.localstack.cloud:4566/_aws/ses?email=support@cubecobra.com' | jq '.messages[0].RawData' | sed -e 's/=\\r\\n//g')
REGISTER_REGEX='(http:\/\/localhost:8080\/user\/register\/confirm\/.{32,36}\/.{32,36})'
if [[ $EMAIL_HTML =~ $REGISTER_REGEX ]]
then
    echo "Open the following URL to complete registration"
    echo "${BASH_REMATCH[1]}"
else
    echo "Unable to extract the registration email, sorry."
fi