# Keypoints

In this documents we are gonna answer simple questions asked about each technology. These questions refer to some key aspects that we have to take into account in order to compare them. 

Those questions will be:

- **Supported Runtimes:** Either a list of the runtimes/languages available or if it's possible to have custom runtimes. In the latest case specify the requisites to create your own runtimes.

- **Code and depencences:** Specify the way to load the code and its dependences.

- **Function requisites:** What is a function in this context? What elements are compulsory for the function to work and what constraints do they have. Focus on I/O.

- **Deployment method:** Does it deploy in K8s, Docker or where?

- **Autoscaling policies:** Are configurable? Which part of the stack takes care of them? Is scale-to-zero possible? Focus on container reusal and *warmification*.

- **Triggers:** Supported types, hor are they invoked, etc.

- **Multi-tenancy:** Is multi-tenancy supported? In which way?

- **Platform security:** How is the platform secured agaist authentication and authorization threats.

- **Isolation:** Who provides execution isolation? Is it enough?

## **OpenFaaS**

- **Supported runtimes:**

The runtimes are called Templates. OpenFaas supports many of them [by default](https://github.com/openfaas/templates) and shows [how to use them](https://docs.openfaas.com/cli/templates/). Templates are basically a `template.yml` and a `Dockerfile`.

Basicamente, crea un Dockerfile arbitrario, añade watchdog y un health ckeck. En el template le tienes que pasar a la opción fprocess el entrypoint. Las funciones serán handlers que se ejecutarán en base al entrypoint que hayas pasado.

Ver el apartado de _isolation_ para comprender watchdog y sus modos, ya que es bastante interesante.

- **Code and dependences:**

Las dependencias se gestionan a nivel de Template, pero se pueden gestionar también a nivel de función, con mecanismos para ello (i.e Nodejs y el package.json).

El código se sube haciendo un build y un push de la imagen de docker. Cada función es una imagen, por lo que al final se pueden pormenorizar y gestionar individualmente. Una vez está creada ya funcionará por su cuenta.

- **Function requisites:**

Las peticiones a la función deberán tener encuenta su entrada y salida. Watchdog levanta un servidor HTTP, por lo que todas las funciones van a porder ser accedidas mediante una API, que forwardeará el gateway.

- **Deployment Method:**

OpenFaaS funciona con K8s y Docker Swarm.

- **Autoscaling Policies:**

Based on policies specified in AlertManager, read from Prometheus. Requests per second is the default setting. Totalmente configurable, se puede es calar en base a multiples requisitos y de multiples maneras. Para el escalado a cero se tiene que habilitar un idler. Bien el que ofrece OpenFaaS [por defecto](https://github.com/openfaas-incubator/faas-idler) o uno propio.

- **Triggers:**

[Aquí](https://docs.openfaas.com/reference/triggers/) se especifican los tipos de triggers soportados. Pero, en resumen, funciona con todo.

- **Multi-tenancy:**

OpenFaas es una plataforma que soporta la multi-tenancy.

- **Platform Security:**

OpenFaas tiene un [plugin de autencticación básico](https://github.com/openfaas/faas/tree/master/auth/basic-auth) por defecto, pero también soporta otros plugins con OAUTH2 para proteger la API.

- **Isolation:**

Watchdog se encarga del aislamiento. En el caso de hacer uso de [Watchdog Classic](https://github.com/openfaas/faas/tree/master/watchdog), se hace un fork de proceso por invocación. En el caso de utilizar [of-watchdog](https://github.com/openfaas-incubator/of-watchdog/blob/master/README.md) se mantiene el proceso activo. 

## **OpenWhisk**

- **Supported runtimes:**

- **Code and dependences:**

- **Function requisites:**

- **Deployment Method:**

- **Autoscaling Policies:**

- **Triggers:**

- **Multi-tenancy:**

- **Platform Security:**

- **Isolation:**

## **Fission**

- **Supported runtimes:**

- **Code and dependences:**

- **Function requisites:**

- **Deployment Method:**

- **Autoscaling Policies:**

- **Triggers:**

- **Multi-tenancy:**

- **Platform Security:**

- **Isolation:**

## **Kubeless**

- **Supported runtimes:**

- **Code and dependences:**

- **Function requisites:**

- **Deployment Method:**

- **Autoscaling Policies:**

- **Triggers:**

- **Multi-tenancy:**

- **Platform Security:**

- **Isolation:**