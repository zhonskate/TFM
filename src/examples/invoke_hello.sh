#!/bin/bash

# This script opens 4 terminal windows.

i="0"

while [ $i -lt $1 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"hello", "params": {}}' \
localhost:3000/invokeFunction
echo -e ''
i=$[$i+1]
done