FROM node
ENV DOCKERVERSION=18.03.1-ce
RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKERVERSION}.tgz \
  && tar xzvf docker-${DOCKERVERSION}.tgz --strip 1 \
  -C /usr/local/bin docker/docker \
  && rm docker-${DOCKERVERSION}.tgz
RUN mkdir /ws
WORKDIR /ws
RUN npm install --silent zeromq@5.2.0 winston@3.3.3
COPY *.js* /ws/
EXPOSE 2000 2001 2002 2003
CMD ["node", "/ws/worker.js"]

