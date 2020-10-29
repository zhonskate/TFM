# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "noderuntime","path": "/ws","dependencies": "echo ","run":"node test.js"}' \
    localhost:3000/registerRuntime
echo -e ''

# registerFunction

curl -X POST \
-F module=@../runtimes/node/hello/hello.tar.gz \
localhost:3000/registerFunction/noderuntime/hellonode
echo -e ''

# invoke Function

curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"hellonode", "params": {}}' \
localhost:3000/invokeFunction
echo -e ''

# check runtimes

curl localhost:3000/runtimes
echo -e ''

# check Functions

curl localhost:3000/functions
echo -e ''

# check calls

curl localhost:3000/calls
echo -e ''

# check specific call

curl localhost:3000/call/1
echo -e ''
