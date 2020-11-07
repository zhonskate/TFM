FROM node
RUN mkdir /ws
WORKDIR /ws
RUN npm install --silent zeromq@5.2.0 winston@3.3.3 lokijs@1.5.10 del@5.1.0 
COPY *.js* /ws/
EXPOSE 2002
CMD ["node", "/ws/db.js"]

