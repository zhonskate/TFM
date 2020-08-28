# TODO

* Api. Crear las rutas.

* BBDD.

* Runtimes, como se hacen, se necesita meter codigo para comunicarse?

* Funciones. Se guardan en la BBDD. Como guardarlas y como cargarlas. ZIP?

## INVESTIGAR

* Bindeo de volumen a un contenedor corriendo?
  * use docker copy

## Creación de contenedores

* Se crea cada contenedor con el formato `incrementalID-runtime`. En el momento de crear la función se buscará un contenedor válido en el caso de que exista, y la invocación a dicha funcion tomará el numero del incrementalID del contenedor. Si no existiera un runtime prewarm para dicha funcion se crea nuevo.

## organizacion

* se debe seguir un esquema de centralizacion. Separar los hilos en los workers. Es decir, cada uno de los workers debe partirse en miniworkers para no bloquear.