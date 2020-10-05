FROM node
ENV DOCKERVERSION=18.03.1-ce
RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKERVERSION}.tgz \
  && tar xzvf docker-${DOCKERVERSION}.tgz --strip 1 \
  -C /usr/local/bin docker/docker \
  && rm docker-${DOCKERVERSION}.tgz
RUN mkdir /db
WORKDIR /db
RUN npm install --silent zeromq@5.2.0 winston@3.3.3 lokijs@1.5.10 del@5.1.0
COPY db.js /db/db.js
EXPOSE 2002
CMD ["node", "/db/db.js"]

