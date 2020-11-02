# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo ''

# registerFunction

curl -X POST \
-F module=@../runtimes/python/hello/hello.tar.gz \
localhost:3000/registerFunction/pythonruntime/hello
echo ''

# invoke Function

i=0

while [ $i -lt $1 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"hello", "params": {}}' \
localhost:3000/invokeFunction
echo ''
i=$(( $i + 1 ))
done