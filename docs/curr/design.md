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