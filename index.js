const req = require('request');
const db = require('mongoose');
db.connect("mongodb://mongo/rentomojo", {useNewUrlParser: true});
require("./model");
const URL = require('url');
const amqp = require('amqplib/callback_api');
const urlModel = db.model("urls");
const startingUrl = 'https://medium.com';
const REQ_DOMAIN = 'medium.com';
const hyperlinkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
const urlQueue = [];
Array.prototype.enqueue = function (item) {
    this.push(item);
    return this
};
Array.prototype.dequeue = function () {
    return this.shift()
};
const finalObject = [];
var CUR_CONCURRENCY = 0;
const MAX_CONCURRENCY = 5;
let ch = null;


setTimeout(function () {
    amqp.connect('amqp://guest:guest@rabbitmq?heartbeat=60', function (err, conn) {
        if (err) {
            console.log('error occured in rabbit connection', err);
            process.exit(2);
        } else {
            conn.createChannel(function (err, channel) {
                ch = channel;

                ch.assertQueue('urlqueue', {
                    durable: true
                }, function (err, q) {
                    console.log('urlqueue');
                    ch.bindQueue('urlqueue', 'amq.topic', 'urlqueue');
                    console.log('created binding urlqueue');
                });
                ch.sendToQueue('urlqueue', new Buffer(startingUrl));

                var request = req.defaults({
                    headers: {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'}
                });
                const ua = ['Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9a1) Gecko/20070308 Minefield/3.0a1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/74.0.3729.157 Safari/537.36', 'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0', 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_6; en-en) AppleWebKit/533.19.4 (KHTML, like Gecko) Version/5.0.3 Safari/533.19.4', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10; rv:33.0) Gecko/20100101 Firefox/33.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36', 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36', 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1', 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36', 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.83 Safari/537.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36'];

                function downloadPage(link) {
                    CUR_CONCURRENCY++;
                    return new Promise((resolve, reject) => {
                        request(link, (error, response, body) => {
                            if (error || !response) reject(error);
                            if (response && response.statusCode != 200) {
                                if (response.statusCode == 429) {
                                    console.log("Going into hibernation for 200s, useragent and ip blocked by ", REQ_DOMAIN);
                                    setTimeout(function () {
                                        // main()
                                    }, 200000);
                                }
                                reject('Invalid status code <' + response.statusCode + '>');
                            }
                            resolve(body);
                        });
                    });
                }

                const checkAndEnqueueURL = link => {
                    if (!(link.slice(0, 40).includes(REQ_DOMAIN) && (link.includes('http')))) {
                        // main()
                    } else {
                        let url = URL.parse(link, true);
                        finalObject.push({
                            href: url.href,
                            url: ((url.hostname) ? url.hostname
                                                 : '') + url.pathname,
                            queryString: (url.query
                                          ? Object.keys(url.query).filter((item) => !item.includes(';'))
                                          : [])
                        });
                        urlModel.findOne({
                            url: url.hostname + url.pathname
                        }, function (err, dbLink) {
                            if (err) {
                                console.trace('error in mongo query', err)
                            } else if (dbLink) {
                                dbLink.paramList = [...new Set([...dbLink.paramList, ...((typeof url.query == "object" && url.query)
                                                                                         ? Object.keys(url.query).filter((item) => !item.includes(';'))
                                                                                         : [])])];
                                dbLink.referenceCount += 1;
                                dbLink.save();
                            } else if (!err && !dbLink) {
                                ch.sendToQueue('urlqueue', new Buffer(link));
                                let urlObjectRaw = {
                                    url: ((url.hostname) ? url.hostname
                                                         : '') + url.pathname,
                                    referenceCount: 1,
                                    paramList: (url.query
                                                ? Object.keys(url.query).filter((item) => !item.includes(';'))
                                                : [])
                                };
                                let urlObject = new urlModel(urlObjectRaw);
                                try {
                                    urlObject.save((e, r) => {
                                    })
                                } catch (e) {

                                }
                                // console.log("CUR_CONCURRENCY",CUR_CONCURRENCY);
                            }
                            console.log('CUR_CONCURRENCY', CUR_CONCURRENCY);
                            // main();
                        });
                    }
                };
                ch.prefetch(1);
                ch.consume('urlqueue', function (msg) {
                        msg = msg.content && msg.content.toString();
                        if (CUR_CONCURRENCY < MAX_CONCURRENCY) {
                            console.log(msg);
                            while (CUR_CONCURRENCY < MAX_CONCURRENCY && msg) {
                                let user_agent = ua[Math.floor(Math.random() * ua.length)];
                                request = req.defaults({
                                    headers: {'User-Agent': user_agent}
                                });
                                downloadPage(msg).then(function (res) {
                                    // console.log(res)
                                    CUR_CONCURRENCY--;
                                    while ((link = hyperlinkRegex.exec(res)) !== null) {
                                        checkAndEnqueueURL(link[2])
                                    }
                                }).catch(err => {
                                    CUR_CONCURRENCY--;
                                    console.log(err)
                                });
                            }
                            if (!msg && CUR_CONCURRENCY == 0) {
                                console.log('All links already scrapped for this page');
                                process.exit(2)
                            }
                        } else {
                            ch.sendToQueue('urlqueue', new Buffer(msg));
                        }
                    }, {noAck: true}
                );
            });
        }
    });
}, 10000)