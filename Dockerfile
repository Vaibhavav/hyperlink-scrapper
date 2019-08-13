FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . /usr/src/app
CMD [ "node", "index.js" ]
