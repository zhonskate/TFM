# FaaS

## Historia

- paradigma serverless. Nativo a la arquitectura cloud, etc, etc

## Definición

Cuando hablamos de FaaS o funciones como servicio nos referimos a un concepto bastante concreto.
Se trata de la ejecución de trozos de código __arbitrarios__ bajo demanda en una plataforma ajena al usuario.  <!-- TODO: refrasear -->
Este código debería ser _stateless_, lo que quiere decir que no debería almacenar ni requerir ningún tipo de estado previo.
Cada ejecución de dicho código sería independiente y aislada, y, en el caso de querer mantener un estado, éste se situará en un sistema externo al FaaS, como una base de datos.

La gran mayoría de sistemas FaaS se componen de infinidad de elementos, tales como colas o _proxies_, sin embargo, si tomamos como referencia la definición de la arquitectura, estos elementos no son esenciales para su cumplimiento.
Para que un faas se considere como tal debe cumplir únicamente dos funciones básicas:

* __Recibir el código de la función a ejecutar.__

  Esta recepción de código se puede realizar de cualquier manera, aunque lo más común es hacerlo mediante algún tipo de API.
  Junto con el código se deben especificar las dependencias externas que puedan ser necesarias (o pasarse en un binario).
  De la misma manera se deberá especificar el lenguaje en el que se ha escrito el código de la función, para poder ejecutarla como es debido.

* __Ejecutar el código de la función.__

  El proceso de ejecución de código es el siguiente el FaaS recibe una llamada, en la que se encuentra la función a ejecutar (el nombre o el propio código) y sus parámetros de entrada.
  Con esta información deberá cargar un entorno en el que el código se pueda ejecutar y devolver el resultado.
  Los casos más comunes y sencillos son funciones con lenguajes interpretados, pues no han de ser precompilados, pero existen FaaS que admiten la ejecución de código de lenguajes compilados.

Ésta definición es quizás un poco ambigua, pero no se puede especificar más, pues ya se entra en casos concretos. Algunos ejemplos extraños de lo que se podría considerar un FaaS:

* Una ejecución de una casilla de Jupyter en un despliegue externo al que te han concedido acceso.

  La carga de código se realiza de manera interactiva, mientras se escribe la función.
  La ejecución la realiza un kernel externo y devuelve el resultado.
  El usuario es ajeno al funcionamiento interno y no puede modificarlo

* Llamar a una función `eval` desde la consola del navegador.

  La carga de código se realiza en el propio momento de escribir la función.
  La ejecución la realiza el propio navegador, haciendo uso de su intérprete de JavaScript y devuelve el resultado en la propia terminal.
  En este caso el usuario puede que si que conozca el sistema, pero no tiene por qué ser el encargado de desplegarlo ni de mantenerlo.

Estos ejemplos, aunque válidos para reflejar la amplitud del término función como servicio, no son para nada representativos de las plataformas más comunes.
Estas plataformas añaden algunas funcionalidades extra, que las hacen más adecuadas para aplicaciones que basen su arquitectura en el paradigma. 
Algunas de estas funcionalidades serían:

* Autoescalado: Una función variará los recursos asignados a su ejecución en función de la carga automáticamente.

* Cola de peticiones: Si el sistema no puede atender una petición en un momento en concreto, esta se encolará para ejecutarse más tarde.

* Gateway: Se suele designar un componente que se encargue de recibir todo tipo de peticiones y transmitirlas al resto de componentes del sistema.

* Aislamiento entre funciones: Muy importante, en el caso de que las funciones sean stateless, el sistema debería proporcionar medidas para asegurar que el estado parcial de una función no se puede recuperar por otra.

...

## Coste temporal

Se puede realizar un cálculo de lo que va a tardar una ejecución de una función en una determinada plataforma conociendo su arquitectura.
Para ello vamos a ir desgranando cada uno de los tiempos que componen su ciclo de vida:

* __Carga del código__, esto comprende desde el momento en que se realiza la invocación hasta el momento en el que la primera intrucción del código entra en el kernel.
Este tiempo puede variar considerablemente en función de los mecanismos de carga que emplee el sistema.
Es interesante separar este tiempo en dos secciones:

  * __Tiempo de aprovisionamiento:__ Es el tiempo que se tarda en desplegar la unidad de computación sobre la que se va a ejecutar la función.
  Este tiempo puede ser cero en el caso de que la unidad ya esté levantada, es lo que se llama un _warm start_.
  Por otro lado, puede ser bastante costoso, por ejemplo en el caso de que nuestra unidad de computación fuera una máquina virtual.
  El caso más común es que esta unidad sea un contenedor.
  En este caso, no tener la unidad desplegada en el momento de que se produzac la llamada supone levantar el contenedor, lo que cuesta un tiempo del orden de magnitud de un segundo `(cita requerida)`, es lo que se llama un cold start.

  * __Carga del runtime:__ Se trata del tiempo que se tarda en cargar todas las librerías necesarias para la ejecución de cualquier fragmento arbitrario de código en el lenguaje.
  
    <!-- ampliar con mas info sobre runtimes -->
    
    Este tiempo puede variar considerablemente, por ejemplo, un ejecutable de Go no necesita a penas código extra para funcionar, pues es compatible con el kernel de linux directamente.
    Un ejecutable de Java necesitará toda la JVM para correr, lo cual puede aumentar este tiempo de carga.

  * __Carga de dependencias:__ Es el tiempo en el cual se cargan las dependencias externas, proporcionadas por el usuario.
  Todo este código debe ser cargado en memoria para su uso.
  El tiempo depende en gran medida del tamaño de la librería a importar. `citar a Stenbom` 

  * __Carga del código:__ Se trata del tiempo que se tarda en gargar en memoria el código de la función que el usuario ha entregado.

* __Ejecución del código__, que comprende desde que termina el tiempo de carga hasta que finaliza la ejecución del código.
Este tiempo va a ser estático, solamente va a depender del tamaño de la función y del poder de cómputo de la infraestructura subyacente.
Dos ejecuciones de la misma función en el mismo sistema bajo las mismas condiciones deberían tener tiempos de ejecución muy parejos. <!-- en un faas que funcione con contenedores como unidad de ejecución no va a ser siempre asi, pues el kernel es compartido y el schedule puede tener otras faenas en un momento dado. Vamos, que las condiciones no son iguales-->

<!-- TODO: Tiempo de retorno de resultados? considerar -->

## Comparativa

* cuantos recursos se asignan un contenedor?

  * OpenFaaS: __Depende__ de la infraestructura sobnre la que corra.
  Es posible modificar estos límites en el [yaml de configuración](https://docs.openfaas.com/reference/yaml/#function-memorycpu-limits).

  * OpenWhisk: __Depende__ de la configuración del invoker.
  Se establece un tamaño global, es decir, todas las funciones utilizan la misma cantidad de recursos.

  * Fission:

  * kubeless:

* Reusables entre distintas ejecuciones de una misma función?

  * OpenFaaS: __Sí__.
  [Watchdog](https://github.com/openfaas/faas/tree/master/watchdog) hace el enrutado de las invocaciones a un contenedor activo.

  * OpenWhisk: __Sí__.

  * Fission:

  * kubeless:

* Reusables entre distintas funciones de un mismo runtime?

  * OpenFaaS: __No__.
  El código se sube haciendo un build y un push de la imagen de docker.
  Cada función es una imagen, por lo que al final se pueden pormenorizar y gestionar individualmente. Una vez está creada ya funcionará por su cuenta.

  * OpenWhisk: _No debería_

  * Fission:

  * kubeless:

* Reusables entre distintas funciones de un mismo runtime para un único usuario?

  * OpenFaaS: __No__.
  El código se sube haciendo un build y un push de la imagen de docker.
  Cada función es una imagen, por lo que al final se pueden pormenorizar y gestionar individualmente. Una vez está creada ya funcionará por su cuenta.

  * OpenWhisk: _No debería_

  * Fission:

  * kubeless:

* Reusables entre distintas funciones de un mismo runtime para distintos usuarios?

  * OpenFaaS: __No__.
  El código se sube haciendo un build y un push de la imagen de docker.
  Cada función es una imagen, por lo que al final se pueden pormenorizar y gestionar individualmente. Una vez está creada ya funcionará por su cuenta.

  * OpenWhisk: _No debería_

  * Fission:

  * kubeless:

* De qué forma se carga el código de las funciones, es decir, cómo se lleva hasta el worker.

  * OpenFaaS: Se realiza un build de una imagen de docker.
  La imagen se descarga de un registry y se corre, a no ser que haya una imagen corriendo para esa función y namespace (autoscaler).
  Es decir solo cuando se escala de 0 a 1 contenedores.

  * OpenWhisk: leer a stenbom

  * Fission:

  * kubeless:

* Coste temporal según nuestro modelo.

  * OpenFaaS:
    
    * Cold start: aprovisionamiento -> underlying (kubernetes, docker swarm).
    Carga de runtimes, dependencias y código -> docker create.

  * OpenWhisk: leer a stenbom

  * Fission:

  * kubeless:

* Qué obligaciones debe cumplir el código.

  * OpenFaaS: Las peticiones a la función deberán tener encuenta su entrada y salida.
  Watchdog levanta un servidor HTTP, por lo que todas las funciones van a porder ser accedidas mediante una API, que forwardeará el gateway.

  * OpenWhisk: Las acciones tienen como entrada un diccionario de tipo clave-valor, en forma de JSON, y lo mismo como salida.
  Para poder crear una acción ésta tiene que contar con estos elementos y tener un archivoque se pueda utilizar como entrypoint.
  Se pueden hacer invocaciones síncronas y asíncronas, haciendo que el cliente se bloquee o no según se desee.
  Las funciones se pueden encadenar en lo que se denomina secuencias (al acabar una acción se invoca la siguiente, tomando como entrada los elementos de salida de ésta).

    Cosas a tener en cuenta:
  
    * Las funciones deberían ser **idempotentes**. El sistema no lo fuerza, y puede haber ventajas sabiendo que una función puede ejecutarse dos veces en el mismo nodo.
  
    * Una acción se ejecuta dentro de un contenedor, que se podría reutilizar (Aislamiento).
  
    * Las invocaciones a una función no están ordenadas.
  
    * No se garantiza que las acciones sean atómicas.
  
    * Las acciones tienen dos fases: Inicialización y ejecución. Pueden suceder los warm starts   (Una invocación de una acción se ejecuta en un contenedor ya inicializado).
  
    * El tiempo máximo de ejecución e inicialización puede ser configurado. Si se supera se   devuelve un error.


  * Fission:

  * kubeless:

* Explicar la precarga de código, si hacen y cómo es esta. Algoritmo de cold start.

  * OpenFaaS: Depende del autoscaler.
  En caso de no querer cold starts se puede configurar que una función no escale hasta cero.
  El autoescalado siempre va a crear contenedores nuevos haciendo un docker run, y luego el load balancer reparte la carga entre las instancias.
  No hay oráculo.

  * OpenWhisk: oraculillo.

  * Fission:

  * kubeless: