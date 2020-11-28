# Deploy registry

echo 'creating network...'

docker network create faas

echo 'creating log volume...'

docker volume create log-vol

echo 'creating uploads volume...'

docker volume create uploads-vol

echo 'launching faas-registry...'

docker run -d -v faasRegistry:/var/lib/registry -p 5000:5000 --name faas-registry registry:2

echo 'launching zookeeper'

docker run -d --net=host --name faas-zookeeper zookeeper:3.4
# docker run -d -p 2181:2181 --name faas-zookeeper zookeeper:3.4

echo 'launching faas-db...'

docker run -d -v log-vol:/ws/logs --net=host --name faas-db faas-db

echo 'launching faas-broker...'

docker run -d -v log-vol:/ws/logs --net=host --name faas-broker faas-broker

echo 'launching faas-worker 0...'

# docker run -d -v log-vol:/ws/logs -v /var/run/docker.sock:/var/run/docker.sock -v uploads-vol:/ws/uploads --net=faas --name faas-worker-0 faas-worker

echo 'launching faas-worker 1...'

# docker run -d -v log-vol:/ws/logs -v /var/run/docker.sock:/var/run/docker.sock -v uploads-vol:/ws/uploads --net=faas --name faas-worker-1 faas-worker

echo 'launching faas-api...'

docker run -d -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v log-vol:/ws/logs -v /tmp/uploads:/ws/uploads --net=host --name faas-api faas-api

echo 'attaching to log...'

docker exec faas-api tail -f /ws/logs/combined.log

 