# Deploy registry

echo 'creating network...'

docker network create faas

echo 'creating log volume...'

docker volume create log-vol

echo 'creating uploads volume...'

docker volume create uploads-vol

echo 'launching faas-registry...'

docker run -d -v faasRegistry:/var/lib/registry -p 5000:5000 --name faas-registry registry:2

echo 'launching faas-api...'

docker run -d -p 3000:3000 -v log-vol:/ws/logs -v uploads-vol:/ws/uploads --net=faas --name faas-api faas-api

echo 'launching faas-db...'

docker run -d -v log-vol:/ws/logs --net=faas --name faas-db faas-db

echo 'launching faas-worker...'

docker run -d -v log-vol:/ws/logs -v /var/run/docker.sock:/var/run/docker.sock -v uploads-vol:/ws/uploads --net=faas --name faas-worker faas-worker

echo 'attaching to log...'

docker exec faas-worker tail -f /ws/logs/combined.log

 