# Hyperlink Scrapper

#####Pre-Requisites
1. Docker Installed.
2. Nodejs Installed.
3. Docker-compose installed.

To run this application please follow the commands -

1. sudo docker-compose build
2. sudo docker-compose up

The architecture uses Nodejs for scrapping hyperlinks,
MongoDb for storing the hyperlinks with the required information and RabbitMq for maintaining queue of un scrapped urls. 
To maintain authenticity with the website many user agents have been pre-defined which are randomly selected for each request.

On trial run of this program i have scrapped a total of 30000 hyperlinks without getting blocked by the website with a concurrency of 5 requests at a time. 