# Cosas que quedan por hacer

## Corto plazo

Cosas que hay que solventar para YA.

* **Arreglar las llamadas a la BD para actualizar las calls con los outputs.** Hacer lo propio para la API, es decir, mandar la info de los outputs para que la sirva.

* **Encontrar un fix para las invocaciones bloqueantes**. ATM cada worker solo puede invocar una función porque el thread se bloquea. Paralelizar esto de alguna manera, mediante los miniworkers (ver [status](./status.md)) o otra abstracción (llamadas asincronas en bash).

* **Comunicar las subidas a los workers**. Los archivos que se suben cuando se registra una función se guardan en la API. Se tienen que llevar a los workers. Por ahora se utiliza un volumen de docker bindeado a los dos contenedores. Se debería arreglar, pues cuando se ejecuten bajo demonios de docker diferentes (separación física) no se podrá gastar este método. Se puede hacer mandando un multipart por zmq pero xdddd. Una vez separados se puede hacer en bash directamente, pero hay que ir con cuidado para que en un único nodo no pete. Quizás archivos de configuración para decir dónde se despliega cada cosa (?).

## Medio plazo

Una vez todo sea funcional, sin precarga de nada, la arquitectura y las comms funcionen bien y todo esté separado como se supone que tiene que estar.

* **Políticas de invocación**. Deben existir tres políticas de invocación, según el nivel de precarga de los contenedores.

  * **Nada**: Una vez llega la llamada se crea el contenedor con el runtime, se le pasa el código y los requirements, se le pasa el input y se ejecuta. Luego se elimina el contenedor y no se relanza nada. Es el caso base.

  * **Warm-Runtime**: Según los runtimes disponibles que tenga el worker y en base a una heurística a determinar se mantiene una pool de contenedores con runtimes precargados. Esto quiere decir que cuando llegue la invocación de la función se pasa el código y los requirements, se instalan, se pasa el input y se ejecuta. Luego se elimina el contenedor y se pregarga uno nuevo con el runtime que marque la heurística. Si se recibe una invocación de una función que utiliza un runtime no precargado se deberá proceder como en el caso base.

  * **Warm-Function**: Según las funciones disponibles en el worker y en base a una heurística se mantiene una pool de funciones. Estas solo deben recibir el input y ejecutarlo. Cuando acaben se precarga otra función. Al igual que en Warm-runtime si llega una función no precargada caemos a caso base.

  Estas políticas son propias de cada worker, y se deberá realizar una heurística en la API también, para en el caso de que haya dos workers, por ejemplo uno con `Nada` y otro con `Warm-runtime`, mandar todas las funciones del mismo runtime a el que los precarga.

* **Orquestación**. Hacer un despliegue multinodo de toda esta historia sin volvernos locos. Quizás utilizar k8s pero tampoco es algo primordial. Básicamente apañarlo para que no se tarde 30 mins en desplegar y que no se tenga que hacer a mano, lo típico, que sea replicable y se pueda tirar y levantar easy.

## Largo plazo

> Side note: Todo esto me molaria tenerlo antes del 15 de Nov, que hay que escribir una memoria xDDD

Esta es la parte de test, básicamente hacer tests que valgan la pena y compararlos entre ellos. Todo esto cuando tengamos un sistema que se pueda gastar.

* **Codear tests en diferentes lenguajes**. Node y Python serán fáciles por su manera de tratar las dependencias, me molaría tener más lenguajes para poder hacer overflow en la política `Warm-Runtime`, pero se puede hacer igual cargando más o menos dependencias. Tener bastante heterogeneidad de tests y pensarlos de cara al testing. Todo esto se pensará en un futuro, pero tenerlo en cuenta.

* **Realizar las pruebas**. Todo el flujo de preparar experimentos, realizarlos y recopilar y visualizar los resultados. Lo mismo que los tests, hay que pensar que se quiere hacer (casos donde todo es bonito y casos donde todo peta) y darle.

## Opt

Cosas que no son requisito per se pero que molaría hacerlas.

* **CLI**. Pues eso, que se pueda gastar bien bacano el bicho.

* **Logs**. Tengo un winston por ahi funcionando, ahora se hace un agrupe de los logs utilizando un volumen docker (cómo me molan) que va a petar cuando no lo corra todo en local. Supongo que configurando bien los remotos de winston irá, pero bueno, los logs son accesibles por separado así que cero drama.


