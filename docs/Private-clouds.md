# Private clouds runtime spec

Aquí se mostrarán los runtimes que permiten cada uno de los proveedores de cloud privados. Así como su especificación y curiosidades.

## Aws Lambda

Lambda ofrece [diversos runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html), tales como Node, Python, Ruby, Java, Go y .Net. También permite la creación de runtimes propios, esto se hace creando una layer en una imagen con los elementos del runtime y bootsrapeándola. La información está [aquí](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-walkthrough.html).

## GCloud functions

La lista de runtimes se encuentra [aquí](https://cloud.google.com/functions/docs/concepts/exec), permite diversas versiones de node, python, go y java. No se puede hacer uso de runtimes propios.

[Cloud run](https://cloud.google.com/run). Lanza un contenedor en el cloud y autoescala. nada de funciones, contenedores enteros.

## Azure functions

Azure soporta los lenguajes mostrados [aquí](https://docs.microsoft.com/en-gb/azure/azure-functions/supported-languages). También permite el uso de handlers propios, para ello nos ofrece esta [guía](https://docs.microsoft.com/en-gb/azure/azure-functions/functions-custom-handlers). Básicamente es exponer un endpoint HTTP y responder de cierta manera ciertas peticiones para que Azure lo interprete de forma válida.

## IBM Cloud functions

Basicamente un deployment de openwhish en su cloud.

OpenWhisk proporciona una [lista de runtimes oficiales](https://github.com/apache/openwhisk/blob/master/docs/actions.md#languages-and-runtimes) aunque también permite crear runtimes propios. El funcionamiento de la creación de estos runtimes se explica [aquí](https://github.com/apache/openwhisk/blob/master/docs/actions-new.md). En resumen, debe implementar la interfaz de acción, una API REST que se define en base a tres métodos:

  - Inicialización ( _POST /init_ ): El runtime debe ser capaz de recibir el payload de inicialización (el código).

  - Activación ( _POST /run_ ) El runtime debe ser capaz de aceptar los argumentos de la llamada, preparar el contexto, correr la función y devolver el resultado.

  - Logging: El runtime debe ser capaz de redirigir `stdout` y `stderr`.

  A parte de esto, para que OpenWhisk lo reconozca, se tiene que dar de alta, creando archivos como su manifiesto.