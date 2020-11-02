# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo ''

# registerFunction

curl -X POST \
-F module=@../runtimes/python/dice/python.tar.gz \
localhost:3000/registerFunction/pythonruntime/dice
echo ''

# invoke Function

i=0

while [ $i -lt $1 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"dice", "params": {"roll":"4d6"}}' \
localhost:3000/invokeFunction
echo ''
i=$(( $i + 1 ))
done