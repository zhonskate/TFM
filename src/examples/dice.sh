# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo -e ''

# registerFunction

curl -X POST \
-F module=@../runtimes/python/dice/python.tar.gz \
localhost:3000/registerFunction/pythonruntime/dice
echo -e ''

# invoke Function

curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"dice", "params": {"roll":"4d6"}}' \
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

