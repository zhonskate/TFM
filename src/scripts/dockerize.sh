
# build the worker

cp ../worker.js ../../docker/worker
cp ../invoke.js ../../docker/worker
cp ../utils.js ../../docker/worker
cp ../faas-conf.json ../../docker/worker
docker build -t faas-worker ../../docker/worker

# build the broker

cp ../broker.js ../../docker/broker
cp ../faas-conf.json ../../docker/broker
docker build -t faas-broker ../../docker/broker

# build the db

cp ../db.js ../../docker/db
cp ../faas-conf.json ../../docker/db
docker build -t faas-db ../../docker/db

# build the api

cp ../api.js ../../docker/api
cp ../utils.js ../../docker/api
cp ../invoke.js ../../docker/api
cp ../faas-conf.json ../../docker/api
docker build -t faas-api ../../docker/api