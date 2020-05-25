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

  OpenWhisk proporciona una [lista de runtimes oficiales](https://github.com/apache/openwhisk/blob/master/docs/actions.md#languages-and-runtimes) aunque también permite crear runtimes propios. El funcionamiento de la creación de estos runtimes se explica [aquí](https://github.com/apache/openwhisk/blob/master/docs/actions-new.md). En resumen, debe implementar la interfaz de acción, una API REST que se define en base a tres métodos:

  - Inicialización ( _POST /init_ ): El runtime debe ser capaz de recibir el payload de inicialización (el código).

  - Activación ( _POST /run_ ) El runtime debe ser capaz de aceptar los argumentos de la llamada, preparar el contexto, correr la función y devolver el resultado.

  - Logging: El runtime debe ser capaz de redirigir `stdout` y `stderr`.

  A parte de esto, para que OpenWhisk lo reconozca, se tiene que dar de alta, creando archivos como su manifiesto.

- **Code and dependences:**

  El código será bien texto plano o un binario. Se pasa a la función init cuando la acción se instancia. Las dependecias se podrán añadir, bien subiendo el código como un binario o creando un runtime nuevo que las contenga. En el caso de node, por ejemplo, se puede subir un módulo entero comprimido y ejecutar su index.js, con todas las dependencias que lleva ya incluidas.

- **Function requisites:**

  Las acciones tienen como entrada un diccionario de tipo clave-valor, en forma de JSON, y lo mismo como salida. Para poder crear una acción ésta tiene que contar con estos elementos y tener un archivoque se pueda utilizar como entrypoint. Se pueden hacer invocaciones síncronas y asíncronas, haciendo que el cliente se bloquee o no según se desee. Las funciones se pueden encadenar en lo que se denomina secuencias (al acabar una acción se invoca la siguiente, tomando como entrada los elementos de salida de ésta).

  Cosas a tener en cuenta:

  - Las funciones deberían ser **idempotentes**. El sistema no lo fuerza, y puede haber ventajas sabiendo que una función puede ejecutarse dos veces en el mismo nodo.

  - Una acción se ejecuta dentro de un contenedor, que se podría reutilizar (Aislamiento).

  - Las invocaciones a una función no están ordenadas.

  - No se garantiza que las acciones sean atómicas.

  - Las acciones tienen dos fases: Inicialización y ejecución. Pueden suceder los warm starts (Una invocación de una acción se ejecuta en un contenedor ya inicializado).

  - El tiempo máximo de ejecución e inicialización puede ser configurado. Si se supera se devuelve un error.

- **Deployment Method:**

  OpenWhisk ofrece [diversas formas](https://openwhisk.apache.org/documentation.html#openwhisk_deployment) de ser desplegado. Lo más estable es sobre Kubernetes, pudiendo hacer uso de Helm. Para entornos de pruebas se puede desplegar directamente con Docker compose. Acepta despliegues haciendo uso algunas opciones de IaaC de Vagrant y Ansible también.

- **Autoscaling Policies:**

  cant find anything about autoscaling

- **Triggers:**

  los triggers están desacoplados de las acciones, para ello se asocian haciendo uso de las reglas. Todas las acciones asociadas a un trigger se activan cuando este se dispara. Tiene una integración bastante completa, permitiendo eventos comoMensajes en colas, cambios en bases de datos, llamadas a una API, etc.

  Se pueden limitar, estableciendo un numero máximo de llamadas por minuto a un trigger en concreto.

- **Multi-tenancy:**

  Openwhisk permite la multi-tenancy. Existe una funcionalidad llamada wskadmin que permite la creación y edición de los namespaces, usuarios y sus permisos y límites.

- **Platform Security:**

  Users identify as themselves with a id/key o through a third-party authentication system as OAuth. [Source](https://medium.com/openwhisk/developing-serverless-backends-with-openwhisk-and-api-gateway-integrations-954c2528f4db).

- **Isolation:**

  Muy realcionado con autoscaling. Se pueden reutilizar contenedores para diversas invocaciones, eso seguro, pero no encuentro la politica de openwhisk para decidir que un 
  

## **Fission**

- **Supported runtimes:**

  Existe una [lista](https://docs.fission.io/docs/languages/) de lenguajes soportados. Se pueden crear nuevos entornos modificando los antiguos, es decir, cogiendo la imagen, añadiendo dependencias y resubiéndola. Por lo que se puede intuir se tienen que poder crear entornos de cero, estos deberían implementar alguna de las versiones de la interfaz. No he podido encontrar más info al respecto.

- **Code and dependences:**

  El código puede ser, bien un archivo independiente sin dependencias o un conjunto de librerías y código, bien en forma de carpeta o comprimido en binario. Para su uso se hará una llamada a la API correspondiente, según el entorno utilizado soporte.

- **Function requisites:**

  El código o el código y las dependencias, según el caso. Las finciones están ligadas a un entorno en concreto, y se asocian a un path de la plataforma, convirtiendo esto en su entrypoint. En caso de subirse comprimidas, los archivos tiene  que seguir cierta estructura, vista [aquí](https://docs.fission.io/docs/usage/package/). 

- **Deployment Method:**

  Kubernetes. It can be installed using Helm. 

- **Autoscaling Policies:**

  Depende del tipo de executor que se elija. PoolManager solo mantiene activa una isntancia de la misma función a la vez, y tiene contenedores warm con todas las funciones que hayan sido invocadas, para, en el caso de ser llamadas, instanciar una de ellas. PoolManager **no escala**. En el caso de newDeployment, escala sin límite, puduendo ser configurado el numero de instancias mínimas (conf [aquí](https://docs.fission.io/docs/usage/executor/)). Sacrifica el cold start por la capacidad de servir tráfico masivo.

  En cuanto al scale-to-zero, PoolManager lo hace, aunque no elimina totalmente el coste computacional. NewDeployment es capaz de hacerlo en el caso en el que sea configurado así.

- **Triggers:**

  Es un binding entre un evento y la invocación de una función. Fissionpermite el uso de triggers basados en peticiones HTTP, lanzados mediante timer,basados en colas de mensajes (como Kafka, NATS, etc.), así como basados en even-tos de Kubernetes Watch.

- **Multi-tenancy:**

  Fission soporta multi tenancy, diferentes usuarios, namespaces y roles. Más info [aquí](https://github.com/fission/fission/blob/master/Documentation/wip/Multi-tenancy.mdc)

- **Platform Security:**

  [xdd](https://github.com/fission/fission/issues/1611). Issue abierto desde nov 2018.

- **Isolation:**

  Pods are not discarded after execution. They are reused as needed, one single pod accepting multiple requests.

## **Kubeless**

- **Supported runtimes:**

  Kubeless ofrece un amplio conjunto de [runtimes listos para ser usados](https://kubeless.io/docs/runtimes/). Por otro lado, ofrece una [guía](https://github.com/kubeless/runtimes/blob/master/DEVELOPER_GUIDE.md#runtime-image-requirements) sobre como crear runtimes propios. Estos runtimes deben seguir una serie de especificaciones, como levantar un servidor que reciba las llamadas o contestar ciertas rutas con ciertos resultados. Lo más curioso es que Kubeless los añade a su set de runtimes en caso de que sean correctos. No sé si se pueden utilizar por ellos mismos, pero parece bastante hacky en caso de ser así.

- **Code and dependences:**

  Both the code and dependeces are loaded dynamically, through the designated API.

- **Function requisites:**

  [Aquí](https://kubeless.io/docs/advanced-function-deployment/) se puede ver la especificación de la función. Acepta muchos campos y requisitos, pero es esecial pasarle un handler, así como sus dependencias y un evento, en el que se registrarán los argumentos de la llamada.

- **Deployment Method:**

  Kubernetes.

- **Autoscaling Policies:**

  Kubeless utiliza el HPA de kubernetes para las funciones de autoescalado. [Aquí](https://kubeless.io/docs/autoscaling/) se puede observar su funcionamiento. Se permite el escalado a zero.

- **Triggers:**

  Kubeless soporta diferentes tipos de [Triggers](https://kubeless.io/docs/triggers/) Principalmente HTTP, cronjobs y PubSub.

- **Multi-tenancy:**

  It's possible. It's achieved with different intances of Kubeless deployed in several namespaces. See more [here](https://kubeless.io/docs/function-controller-configuration/)

- **Platform Security:**

  Control over the function deployment or invocation can be granted through the K8s mechanism, an OAuth token can be used. See [this](https://kubeless.io/docs/function-controller-configuration/). 

- **Isolation:**

  Por lo que veo las funciones permiten multiples llamadas. La creacion y borrado de funciones se supeditan al autoscaler.