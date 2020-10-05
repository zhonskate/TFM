
# build the worker

cp ../worker.js ../../docker/worker
cp ../invoke.js ../../docker/worker
cp ../utils.js ../../docker/worker
docker build -t faas-worker ../../docker/worker

# build the db

cp ../db.js ../../docker/db
docker build -t faas-db ../../docker/db

# build the api

cp ../api.js ../../docker/api
cp ../utils.js ../../docker/api
cp ../invoke.js ../../docker/api
docker build -t faas-api ../../docker/api