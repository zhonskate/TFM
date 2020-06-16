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

  * __Carga del runtime:__

  * __Carga de dependencias:__

  * __Carga del código:__

* __Ejecución del código__, que comprende desde que termina el tiempo de carga hasta que finaliza la ejecución del código.
Este tiempo va a ser estático, solamente va a depender del tamaño de la función y del poder de cómputo de la infraestructura subyacente.
Dos ejecuciones de la misma función en el mismo sistema bajo las mismas condiciones deberían tener tiempos de ejecución muy parejos. <!-- en un faas que funcione con contenedores como unidad de ejecución no va a ser siempre asi, pues el kernel es compartido y el schedule puede tener otras faenas en un momento dado. Vamos, que las condiciones no son iguales-->

<!-- TODO: Tiempo de retorno de resultados? considerar -->