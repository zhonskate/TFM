# registerRuntime

curl --header "Content-Type: application/json" -X POST --data '{"image":"python-runtime"}' localhost:3000/registerRuntime

# registerFunction

curl -X POST -F module=@/Users/zhon/Repos/TFM/src/runtimes/python/test-function/python.tar.gz localhost:3000/registerFunction

