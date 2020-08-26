# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "pip3 install -r requirements.txt","run":"python3 test.py"}' \
    localhost:3000/registerRuntime

# registerFunction

curl -X POST \
-F module=@/Users/zhon/Repos/TFM/src/runtimes/python/test-function/python.tar.gz \
localhost:3000/registerFunction/pythonruntime/dice

# invoke Function

curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"dice", "params": {"roll":"4d6"}}' \
localhost:3000/invokeFunction

