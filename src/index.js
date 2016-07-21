#! /usr/bin/env node

var express = require('express'),
    os = require("os"),
    hostname = os.hostname(),
    app = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    logger = require("./logger"),
    cjson = require('cjson'),
    events = require('./firebase'),
    Gpio;                    // Constructor function for Gpio objects.

/// mock gpio
function GpioMock(gpio, direction) {
  this.direction = direction;
  this.gpio = gpio;
  this.writeSync = (state) => {
    this.state = state;
    logger.info("Setting mocked gpio state:", this.state, "for gpio", this.gpio);
    return;
  }
  this.readSync = (state) => {
    logger.info("Reading mocked gpio state:", this.state, "for gpio", this.gpio);
    return this.state;
  }
}
///

if (process.env.NODE_ENV === 'production') {
  Gpio = require('onoff').Gpio;
}
else {
  Gpio = GpioMock;
}

const conf = cjson.load(path.join(__dirname, "../config/config.json"));
if (!conf.devices) {
  throw new Error("Configuration file is missing a devices property.");
}
if (!Array.isArray(conf.devices) || conf.devices.length < 1) {
  throw new Error("Configuration file is missing at least one device configuration.");
}

//settings
const SPRINKLER_BASE_URI = 'sprinklers';
// parse application/json
app.use(bodyParser.json())

// enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// log queries
app.use((req, res, next) => {
  logger.info(req.method, req.originalUrl);
  next();
});

// include the events route
app.use('/events', events.routes);

/*
 * Filter the device object for serialization
 *
 * @param spinkler [object] the sprinkler object
 * @returns the filtered object
 */
const _toObject = (device) => {
  return {
    uri: device.uri,
    id: device.id,
    name: device.name,
    gpio: device.gpio.gpio,
    isActive: device.isActive,
    sprinklingRateLitersPerSecond: device.sprinklingRateLitersPerSecond
  }
}

// inits
var sprinklers = [];
var init = () => {
  logger.info("Initializing sprinkler pins.");
  for (var i = 0; i < conf.devices.length; i++) {
    var device = conf.devices[i];
    var sprinkler = {
      uri: '/' + path.join(SPRINKLER_BASE_URI, (device.id || i).toString()),
      id: device.id || i,
      name: device.name,
      gpio: new Gpio(device.gpio, 'out'),
      isActive: device.isActiveByDefault || false,
      sprinklingRateLitersPerSecond: device.sprinklingRateLitersPerSecond || 0
    };
    logger.info("Initializing", JSON.stringify(_toObject(sprinkler)));
    sprinkler.gpio.writeSync(sprinkler.isActive?0:1);
    sprinklers.push(sprinkler);
  }
  logger.info("Initialized", sprinklers.length, "sprinklers");
}

/*
 * A matcher function for spinkler matching
 *
 * @returns true if sprinkler matches input
 */
const matchSprinkler = function(device) {
  return device.id === Number(this);
};

// list all sprinklers on GET /
app.get('/', function(req, res) {
  var services = {
    [SPRINKLER_BASE_URI] : {
      uri: '/' + SPRINKLER_BASE_URI + '/'
    }
  }
  res.status(200);
  res.json(services);
});

// retrieve information for a particular sprinkler or a list of sprinklers
app.get('/' + path.join(SPRINKLER_BASE_URI, ':id?'), (req, res) => {
  if(!req.params.id) {
    // send a list of all sprinklers
    res.status(200);
    var ret = [];
    for (var i = 0; i < sprinklers.length; i++) {
      ret.push(_toObject(sprinklers[i]));
    }
    return res.json(ret);
  }
  //else lets return the sprinkler
  var sprinkler = sprinklers.find(matchSprinkler, req.params.id);
  if (!sprinkler) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({error : err.message});
  }
  // get the actual status
  sprinkler.isActive = !sprinkler.gpio.readSync();
  res.status(200);
  return res.json(_toObject(sprinkler));
});

app.post('/' + path.join(SPRINKLER_BASE_URI, ':id?'), (req, res) => {
  if(!req.params.id) {
    // send a list of all sprinklers
    var err = new Error("You can not create sprinklers.. I mean.. how would you?");
    res.status(400);
    return res.json({error : err.message});
  }
  // else lets return the sprinkler
  var sprinkler = sprinklers.find(matchSprinkler, req.params.id);

  // fi no sprinler was found, retun an error
  if (!sprinkler) {
    var err = new Error('Object not found');
    res.status(404);
    return res.json({error : err.message});
  }

  // check for changes in isActive state, set the GPIO and set the response code to 200
  var isActive = (req.body.isActive === true) || (req.body.isactive === true);
  if(req.body.hasOwnProperty('isActive') || req.body.hasOwnProperty('isactive')) {
    sprinkler.isActive = isActive;
    sprinkler.gpio.writeSync(isActive ? 0 : 1);
    res.status(200);
  }

  // check for name changes
  if(req.body.hasOwnProperty('name')) {
    sprinkler.name = req.body.name;
    res.status(200);
  }

  // if everything was sucessfully processed, send 200 repsonse
  if (res.statusCode === 200) {
    logger.log("new gpio state:", _toObject(sprinkler));
    return res.json(_toObject(sprinkler));
  }

  // There was nothing found to process in the body
  var err = new Error('No processable payload in request body');
  res.status(400);
  return res.json({error : err.message});
});

var server = app.listen(process.env.PORT || conf.port || 3000, () => {
  logger.log("Server running on PORT", server.address().port);
});


// actual inits
init();
