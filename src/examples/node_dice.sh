# registerRuntime

curl --header "Content-Type: application/json" \
    -X POST \
    --data '{"image": "noderuntime","path": "/ws","dependencies": "echo ","run":"node test.js"}' \
    localhost:3000/registerRuntime
echo -e ''

# registerFunction

curl -X POST \
-F module=@../runtimes/node/dice/dice.tar.gz \
localhost:3000/registerFunction/noderuntime/dicenode
echo -e ''

# invoke Function

i="0"

while [ $i -lt $1 ]
do
curl --header "Content-Type: application/json" \
-X POST --data '{"funcName":"dicenode", "params": {"roll":"4d6"}}' \
localhost:3000/invokeFunction
echo -e ''
i=$[$i+1]
done

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

