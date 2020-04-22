# Comparativa FaaS

## OpenFaaS

- Free to use
- Completely open source
- lots of adopters
- Integration with kubernetes, OpenShift, docker swarm and containerd.

### CLI

- build
- push
- deploy
- templates
- secret managing

### Features

- Autoscaling
    - Scaling to 0: see faas-idler (interesting approach).

It seems that containers are warm no matter what. Taht means once the container is invoked it can be triggeres as many times as needed. Security?

Can we assume that a single user will just invoke its functions? Multi tenancy


## OpenWhisk (apache-ibm)

- Deploys a yaml with embedded code
- k8s
- Concept of package (preassembled set of functions?)
- https://thenewstack.io/behind-scenes-apache-openwhisk-serverless-platform/ veri nice article will look into that

## Kubeless (bitnami)


## Fission
