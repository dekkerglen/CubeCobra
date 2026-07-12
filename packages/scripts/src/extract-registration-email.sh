#!/bin/bash

REGISTER_REGEX='http://localhost:8080/user/register/confirm/[a-f0-9-]+/[a-f0-9-]+'
URL=$(curl --silent 'localhost.localstack.cloud:4566/_aws/ses' | grep -oE "$REGISTER_REGEX" | tail -1)

if [ -n "$URL" ]; then
    echo "Open the following URL to complete registration"
    echo "$URL"
else
    echo "Unable to extract the registration email, sorry."
fi