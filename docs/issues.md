# Preguntas respecto al FaaS

- Seguridad (acceder a recursos de ejecuciones anteriores y aislamiento)

- Método de despliegue/ infraestrucutra (Kubernetes, o docker autogestionado)

- Runtimes soportados.

- Forma de cargar el código y sus dependencias (Imágenes de docker, archivos ejecutables con descriptores de requisitos,etc)

- I/O De que forma se hacen las peticiones y que datos se mandan, así como las respuestas, JSON, texto plano?

- Triggers, como se van a lanzar las funciones y qué es lo que hay que exponer.

- Política de autoescalado, scale to zero, idling de contenedores, rutinas para mantenerlos warm.


