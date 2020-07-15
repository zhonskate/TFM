# DESIGN

## API

### Create Runtime

* Parameters: Docker Image.

* Description: Add the image to the registry

### Create Function

* Parameters: runtime name, Code

* Description: create the function, add it to the function database to be carried to the containers once one is run.

### Run Function

* Parameters: Function name, input arguments

* Description: Fetch the function from the DB, then get a warm container and inject it, pass the parameters then delete the container and add another one to the pool

TODO: Fix drawio on the flows, advantages, etc of the approach.

## Design decisions

### Runtimes

Los runtimes establecen un compromiso entre flexibilidad y tiempo de carga. A más generales, más funciones harán uso del mismo, por lo que se puede precargar en mas casos (acertar la heurística más veces). A más específicos, menos dependencias se tienen que cargar cuando se lleve el código.

Para nuestra arquitectura es interesante hacerlos bastante específicos, pues la carga de código siempre va a entrar en tiempo de ejecución, mientras que la de runtime se puede hacer por detrás.

Se puede adaptar toda la arquitectura a funciones, sin todo el tema de los runtimes.

### Pool heuristics

Media de ejecuciones de cada uno de los runtimes (con ventana). Siempre que haya cola se levanta el runtime de la siguiente funcion que se vaya a ejecutar, es decir, al 100% de carga todo son cold starts.

### Performance

El sistema, en algunos casos, es mas lento que uno en el que se mantengan contenedores levantados. 

En el caso óptimo todo son prewarm starts, es decir, todas las llamadas que llegan encuentran inmediatamente un contenedor precargado con su runtime. En el peor caso todo son cold starts.

En caso de que haya muchas funciones que compartan runtime pero roten con menor frecuencia que el tiempo de idling de su sistema pero mayor que el de la precarga del runtime en el nuestro, el nuestro sería más rapido. Cold vs prewarm. En sistemas saturados con funciones alternas rendirian mas o menos igual.

Nuestro sistema se beneficia de funciones de larga duracion, pues el tiempo de carga tiene un menor impacto en estos casos.

