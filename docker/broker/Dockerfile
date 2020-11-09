FROM node
RUN mkdir /ws
WORKDIR /ws
RUN npm install --silent zeromq@5.2.0 winston@3.3.3 node-zookeeper-client@1.1.0
COPY *.js* /ws/
EXPOSE 2000 2001 2002 2003
CMD ["node", "--trace-warnings", "/ws/broker.js"]