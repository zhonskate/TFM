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


