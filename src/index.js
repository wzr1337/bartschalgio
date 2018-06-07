#! /usr/bin/env node

var express = require('express'),
    os = require("os"),
    hostname = os.hostname(),
    app = express(),
    path = require('path'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    bodyParser = require('body-parser'),
    logger = require("./lib/logger"),
    cjson = require('cjson'),
    auth = require('./auth'),
    events = require('./events'),
    sprinklers = require('./sprinklers');

const conf = cjson.load(path.join(__dirname, "../config/server.json"));

//settings
const SPRINKLER_BASE_URI = 'sprinklers';
const EVENTS_BASE_URI = 'events';

// parse application/json
app.use(bodyParser.json())

// enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// nano Auth
// app.use(auth.authorize('/auth'));

// log queries
app.use((req, res, next) => {
  logger.info(req.method, req.originalUrl);
  next();
});

var routes = [];
// include the events route
app.use('/events', events.routes);
// include the sprinlers route
app.use('/sprinklers', sprinklers.routes);
// include the sprinlers route
app.use('/auth', auth.routes);


// list all sprinklers on GET /
app.get('/', function(req, res) {
  var services = {
    [SPRINKLER_BASE_URI] : {
      uri: '/' + SPRINKLER_BASE_URI + '/'
    },
    [EVENTS_BASE_URI] : {
      uri: '/' + EVENTS_BASE_URI + '/'
    }
  }
  res.status(200);
  res.json(services);
});

//var server = app.listen(process.env.PORT || conf.port || 3000, () => {
//  logger.log("Server running on PORT", server.address().port);
//});


var privateKey  = fs.readFileSync(conf.https.privateKey);
var certificate = fs.readFileSync(conf.https.publicKey);

var credentials = {key: privateKey, cert: certificate};

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(process.env.HTTPS_PORT || conf.https.port || 8443, () => {
  logger.log("HTTPS Server running on PORT", httpsServer.address().port);
})
httpServer.listen(process.env.PORT || conf.port || 3000, () => {
  logger.log("HTTP Server running on PORT", httpServer.address().port);
});


// actual inits
sprinklers.init(); //@TODO: remove
