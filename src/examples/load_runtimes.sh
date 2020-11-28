# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "pythonruntime","path": "/ws","dependencies": "echo ","run":"python3 test.py"}' \
    localhost:3000/registerRuntime
echo ''


sleep 5
# registerRuntime

i=0

while [ $i -lt 20 ]
do

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "noderuntime'${i}'","path": "/ws","dependencies": "echo ","run":"node test.js"}' \
    localhost:3000/registerRuntime
echo ''

sleep 5

i=$(( $i + 1 ))
done

