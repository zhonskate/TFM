# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo ''


sleep 2
# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "noderuntime","path": "/ws","dependencies": "echo ","run":"node test.js"}' \
    localhost:3000/registerRuntime
echo ''