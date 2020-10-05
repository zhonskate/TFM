# Deploy registry

docker run -d -v faasRegistry:/var/lib/registry -p 5000:5000 --name faas-registry registry:2

 