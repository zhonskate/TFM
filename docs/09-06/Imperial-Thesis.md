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

### Library Loading

### The invoker

### Methodology

### Evaluation

### Conclusion
