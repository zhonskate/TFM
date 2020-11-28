registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo ''

# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "noderuntime","path": "/ws","dependencies": "echo ","run":"node test.js"}' \
    localhost:3000/registerRuntime
echo ''

# # registerFunction

# curl -X POST \
# -F module=@../runtimes/python/dice/python.tar.gz \
# localhost:3000/registerFunction/pythonruntime/dice
# echo ''

# sleep 2
# # registerFunction

curl -X POST \
-F module=@../runtimes/python/hello/hello.tar.gz \
localhost:3000/registerFunction/pythonruntime/hello
echo ''

sleep 2
# # registerFunction

# curl -X POST \
# -F module=@../runtimes/node/dice/dice.tar.gz \
# localhost:3000/registerFunction/noderuntime/dicenode
# echo ''

# sleep 2
# # registerFunction

curl -X POST \
-F module=@../runtimes/node/hello/hello.tar.gz \
localhost:3000/registerFunction/noderuntime/hellonode
echo ''

# curl -X POST \
# -F module=@../runtimes/node/large_hello/large_hello.tar.gz \
# localhost:3000/registerFunction/noderuntime/largehellonode
# echo ''