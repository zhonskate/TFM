# Eliminating cold starts through container reuse

## Idea general

Para evitar los cold starts voy a reestablecer el contenedor a el punto en el que estaba antes de cargar la función. Es decir, voy a reestablecer todos los registros, memoria y sistema de archivos del contenedor (manipulando sus procesos) al estado en el que se encontraban cuando se hizo el checkpoint.

## Techs

* ptrace

* Cgroups

* CRIU Project

* containerd - runc

* Amazon firecracker

## Temporal isolation

_When a user’s code uses more than the heap available, calls to brk are inevitable, and the
size of this area of memory will change. What should we do with this memory when
restoring the process? Leave it? Let us assume that the memory may be used to store
sensitive credit rating information on customers. It should not be possible for the next user’s
function that runs to simply read that information straight from memory. This leaves us
32
with two options. Zero the memory and leave the program break where it is, or change the
break back to where it was.

Zeroing will leave more memory than needed for the next execution. Solution -> PARASITE.

_CRIU’s approach to running code in the tracees execution context is to inject a parasite [35]. A
parasite is a blob of position independent code that can execute outside of the processes
normal stack, and remove itself when it has completed running, leaving the container in the
same state as it was before injection (minus changes caused by the parasite code itself).
Parasites are powerful, but complex, they have to be compiled into assembly instructions for
a particular machine, and must communicate with our tracer over a socket to receive
command parameters._

## Warm containers

Always keep warm containers for every runtime -> **Fission** (POOL). 

Change the scheduler to just redirect function requests to invokers with that runtime.

## **-------------------------------------------------------------**

## Resumen por capítulos

### Abstract

Reestablecer los contenedores basándose directamente en los procesos de linux subyacentes para reducir los cold starts, con la finalidad de aumentar el aislamiento temporal.

### Intro

Se comenta muy brevemente:

* FaaS y su situación histórica.

* Qué son los cold starts y por qué son un motivo a mejorar.

* El método de check and restore aplicado a procesos. Tiene sentido utilizarlo? Puede ser un buen approach.

### Background

* Evolución histórica: Mainframes -> serverless.

* Definición de Serverless

* Arquitectura Serverless: casos
  
  * Cold start - no container available

  * Warm start

  * Cold start - all resources are already set

* Openwhisk. Por qué se ha elegido (soporte, open source). prewarm containers. scheduling alg.

* Cold starts, algunas referencias y variabilidad en tiempos. No adecuadas para según qué casos de uso

* Progreso reciente en serverless:

    * optimizaciones en contenedores
    
      Oakes et al: evitar el uso de namespaces, bind-mount en lugar de RAFN, reusar cgroups.

      Uso de zygotes: forkear un proceso con las dependencias ya cargadas. Solo usable con lenguajes interpretados.

    * Aislamiento de lenguajes. Utilizar lenguajes aislados por defecto (RUST). Proyecto WebAssembly.

    * Unikernels. VMs con sistemas operativos capados. El aislamiento se produce a nivel de hipervisor. Al ser tan ligeros se pueden desplegar rápidamente.

    * Amazon Firecracker. Básicamente un unikernel, gastando KMV por bajo. El inicio del runtime y librerías es inevitable.

* Project Approach: Se va a utilizar checkpoint/restore de procesos sobre contenedores de linux (runc, el estándar).

* Elementos esenciales de los contenedores:

  * Procesos: prevenir ciertas capacidades de los procesos para su restauración, como la syscall de fork.

  * Ptrace: Herramienta que se usará para la intervención sobre los procesos. Se coloca antes del handler de señales, parando el proceso pero permitiendo su inspección y modificación. Gracias a esto el proceso se ve como una colección de datos y su modificación en el tiempo.

  * Contenedores: Principal diferencia con VMs es que comparten el kernel.
    
    Namespaces - privilegios, cgroups - acceso cpu, layered file system.

* Checkpoint and restore:

  Checkpoint & Restore in Userspace (CRIU)
  No hay que recargar el estado entero del proceso, solo la diferencia.

  * Checkpoint:

    Congelar recursivamente el proceso y sus hijos. Añade código parásito que se borra para leer direcciones de memoria.

  * Restore:

    Fork hasta encontrar el pid deseado. Recarga de memoria mediante un blob. 

* Runtimes de lenguaje.
 
  Carga dinámica de código, muy fácil en lenguajes interpretados.

### Refunction

Capa encima de containerd. Toma el control del contenedor y hace el restore. Es un restore más rápido que un cold start de openWhisk. Invoker custom para probar.

### The Worker: Restoring Live Processes

* Preparation: 

  Snapshot del contenedor preparado, docker save y subida a Amazon S3. 
  La comunicación del host se realiza por stdin, en lugar de utilizar sockets, pues su reestablecimiento es mucho más sencillo.

* function loading:

  * Partes del cold start: Creación, carga del runtime, carga de dependencias.

  El checkpoint se realizará después de la carga del runtime -> una snapshot por runtime. Dependencias y código más tarde (dinámicamente). Handlers para la carga y ejecución de código en el runtime.

### Isolation

* Importancia del aislamiento. Crítica.

  Diferencia entre aislamiento temporal y espacial. No entra en criticar el aislamiento de la tecnología (contenedores).

* Approach de refunction.

  Recarga de elementos a bajo nive, como la memoria en el restore. 

  En caso de que se detecte comportamiento sospechoso (apertura de sockets, etc) se elimina totalmente el contenedor y se asume un cold start.

* control de contenedores.

  Se debe detectar el punto en el que el runtime se ha cargado pero la función todavía no, para establecer justo ahí el checkpoint.
  Para ello se realizaba un baile de señales, pero no se podía estandarizar, por lo que se usa stdin y stdout en el proceso padre e hijo. Para procesos multithread se realiza una arquitectura de barrier haciendo uso de directivas de go.

### Checkpoint

Para reestablecer el contenedor hay que reestablecer los siguientes elementos: 

* Registros: ptrace permite la lectura y sobreescritura de registros.

* Memoria: copiar todas las zonas de memoria "escribible" en tiempo de runtime. El resto no van a ser alteradas. El kernel de CRIU marca con un soft dirty bit las páginas de memoria alteradas, y éstas son las que se regeneran.

  * Cambios en el tamaño de la memoria: se pide más memoria con malloc() una vez finalizado, el break del programa no se encuentra en el mismo sitio. Dos opciones:
  
    * Dejar el break donde está y borrar la memoria. Solución sucia, pues cada vez los contenedores alojan más memoria de la que necesitan.

    * Devolver el break a su punto inicial. Código que se ejecutaría por el propio contenedor en la rutina de restore. El approach de CRIU es un parásito, código posicionalmente independiente, que se ejecuta fuera del stack normal de procesos y se autoelimina cuando acaba de correr.

      _CRIU’s approach to running code in the tracees execution context is to inject a parasite [35]. A parasite is a blob of position independent code that can execute outside of the processes normal stack, and remove itself when it has completed running, leaving the container in the same state as it was before injection (minus changes caused by the parasite code itself). Parasites are powerful, but complex, they have to be compiled into assembly instructions for a particular machine, and must communicate with our tracer over a socket to receive command parameters. The way parasite blobs are inserted into the user’s address space may offer us a way to avoid complete parasite injection. The parasite must be placed somewhere, like an area of memory created by an mmap syscall. This syscall must also be run from the processes execution context. In order to do this compel, CRIU’s parasite injection library, finds the first executable area of memory, and changes the instruction to be a syscall instruction using PTRACE_PEEK/POKEDATA. After properly setting the registers for the relevant syscall (in this case mmap), the process is allowed to run the syscall, then stopped on its return. The instruction and registers can now be replaced to what it was, returning the process back to its original state. This method of syscall injection is enough to let us run arbitrary syscalls inside the processes execution context._
  
      Al proceder de esta manera la memoria queda liberada y es utilizable de nuevo.

    * Nuevas areas de memoria: reparsear `/proc/pid/maps` y usar `munmap`.

    * Areas de memoria borradas: Se interpretan como comportamiento malicioso. Parada por completo del contenedor y cold start.
  
  * Sistema de archivos: se detectan nuevos archivos mediante la lectura de `/proc/maps`. Se elimina todo lo que hay en tmp montandoun nuevo directorio encima del existente.

  * Otros tipos de estado: se cierran todos los sockets de red y se limpian las señales del sistema en cola.

### Library Loading

Cargado de dependencias en tiempo de ejecución. Paso de librerías por stdin como bytes en raw. Fácil de ejecutar para lenguajes interpretados, en java se utiliza el ClassLoader.

* Hacia el cargado de librerías en tiempo cero. Elegir entre: 
  
  * cargado de dependencias antes de ejecución -> pool común de dependencias para todas las funciones de un runtime. Problemas de compatibilidad, no es posible tener dependencias custom.

  * Cargado de dependencias en tiempo de ejecución. Más lento.

  * Cargado incremental. Se presuponen unas dependencias populares. En el caso de no ser adecuadas para la función se hace un rollback volviendo al checkpoint original sin dependencias y se cargan. Este approach no se ha contemplado en el proyecto.

### The invoker

El invoker es la pieza de openWhisk que se encarga de la gestión de contenedores. Es la pieza que sustituye este proyecto. El nuevo invoker sustituye la eliminación de contenedores por el reeestablecimiento. 

### Methodology

Se ha desarrollado en go y haciendo uso de runc, containerd, etc.

* Testing: Tests de correccion y unitarios.

### Evaluation

Demostrar el restoring seguro y la mejora de rendimiento.

* Experimental setup: componentes utilizados, tamaño de clusters, etc.

* cold starts: 

  * Low throughput:

    Se cambia el keep warm time a 20 segundos. Funciones sin dependencias. Resultados excelentes.
  
  * Concurrent requests: escalar de 0 a 24. Resultados excelentes.

  * Mejoras de throughput: saturacion en diversidad de funciones. Resultados excelentes.

  * Tiempos de reestablecimiento:
    
    * Tipo de runtime: varía mucho. 

    * Librerias: tiempo de carga dependiente del tamaño.

    * Uso de memoria: Tiempo de reestablecimiento constante, independiente de la memoria

  * Overhead de memoria en el reestablecimiento: hay runtimes que ocupan más en memoria por su tamaño. tradeoff con tiempo de procesamiento

  * Overhead de ptrace: despreciable.
      

### Conclusion

recap y trabajos futuros. 