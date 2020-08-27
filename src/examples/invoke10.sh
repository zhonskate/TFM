#!/bin/bash

# This script opens 4 terminal windows.

i="0"

while [ $i -lt 10 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"dice", "params": {"roll":"4d6"}}' \
localhost:3000/invokeFunction
echo -e ''
i=$[$i+1]
done