i=0

while [ $i -lt $1 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"largehellonode", "params": {}}' \
localhost:3000/invokeFunction
echo ''
i=$(( $i + 1 ))
done