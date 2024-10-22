echo 'removing faas-registry...'

docker rm -f faas-registry

echo 'removing faas-zookeeper...'

docker rm -f faas-zookeeper

echo 'removing faas-api...'

docker rm -f faas-api

echo 'removing faas-db...'

docker rm -f faas-db

echo 'removing faas-broker...'

docker rm -f faas-broker

echo 'removing faas-worker...'

docker rm -f faas-worker

echo 'removing network...'

docker network rm faas

echo 'removing volumes...'

docker volume rm log-vol

docker volume rm uploads-vol