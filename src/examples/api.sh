# registerRuntime

curl --header "Content-Type: application/json" -X POST --data '{"image":"python-runtime","path":"/tmp"}' localhost:3000/registerRuntime

# registerFunction

curl -X POST -F module=@/Users/zhon/Repos/TFM/src/runtimes/python/test-function/python.tar.gz localhost:3000/registerFunction/python-runtime/dice

# invoke Function

curl --header "Content-Type: application/json" -X POST --data '{"funcName":"dice", "params": {"a":1,"b":2}}' localhost:3000/invokeFunction

