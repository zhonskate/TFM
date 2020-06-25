# Propuesta

* Pool de contenedores prewarm. Heuristica a definir. Compartida entre distintos usuarios.

  * Como se miden los recursos que se le van a prestar a cada usuario?

* Cada llamada es un prewarm start. El paso de cargar el código se hace una vez por llamada. Esto implica que el contenedor siempre se tira al acabar la ejecución.

* Runtimes públicos con dependencias públicas (python-numpy). Usuarios pueden elegir compartir runtimes privados, como una especie de hub.

* Openwhisk utilizando el invoker del imperial? Cambiar politicas de cold starts.

* Justificar el aislamiento. Ratio de reutilizacion de contenedores - 0. Aplicar t'ecnicas para que el reinicio sea lo maas rapido posible.