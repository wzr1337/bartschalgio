#! /usr/bin/env node

var express = require('express'),
    os = require("os"),
    hostname = os.hostname(),
    app = express(),
    path = require('path'),
    logger = require("../lib/logger"),
    cjson = require('cjson'),
    events = require('../events'),
    router = express.Router(),
    Gpio;

const BASE_URI = 'sprinklers';

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
  Gpio = require('onoff').Gpio; // Constructor function for Gpio objects.
}
else {
  Gpio = GpioMock; // Constructor function for Gpio objects.
}

const sprinklerConf = cjson.load(path.join(__dirname, "../../config/sprinklers.json"));
if (!Array.isArray(sprinklerConf) || sprinklerConf.length < 1) {
  throw new Error("Configuration file is missing at least one sprinkler configuration.");
}

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
    sprinklingRateLitersPerSecond: device.sprinklingRateLitersPerSecond,
    autoShutOffSeconds: device.autoShutOffSeconds
  }
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// inits
var sprinklers = [];
var init = () => {
  logger.info("Initializing sprinkler pins.");
  for (var i = 0; i < sprinklerConf.length; i++) {
    var device = sprinklerConf[i];
    var id = (device.id || getRandomInt(1e8,1e10));
    var sprinkler = {
      uri: '/' + path.join(BASE_URI, id.toString()),
      id: id,
      name: device.name,
      gpio: new Gpio(device.gpio, 'out'),
      isActive: device.isActiveByDefault || false,
      sprinklingRateLitersPerSecond: device.sprinklingRateLitersPerSecond || 0,
      autoShutOffSeconds: device.autoShutOffSeconds || 0
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

// retrieve information for a particular sprinkler or a list of sprinklers
router.get('/:id?', (req, res) => {
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

router.post('/:id?', (req, res) => {
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

    function endSprinkling(sprinkler) {
      logger.info("Automatically shutting off sprinkler", sprinkler.id);
      //make sure the timeout is not running anymore
      clearTimeout(sprinkler.shutOffTimeOut);
      events.push(sprinkler.id.toString(), sprinkler.sprinklingRateLitersPerSecond, sprinkler.startedAt, Date.now());
      delete sprinkler.startedAt;
      sprinkler.gpio.writeSync(1);
    }

    if (isActive && !sprinkler.startedAt) {
      // start sprinkling
      sprinkler.startedAt = Date.now();
      sprinkler.gpio.writeSync(0);

      // automatically shutOff the sprinkler after configured time
      if (sprinkler.autoShutOffSeconds > 0) {
        clearTimeout(sprinkler.shutOffTimeOut);
        sprinkler.shutOffTimeOut = setTimeout(() => {
          endSprinkling(sprinkler);
        }, sprinkler.autoShutOffSeconds * 1000)
      }
    }
    else {
      // end immediately
      endSprinkling(sprinkler);
    }

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

module.exports = {
  routes: router,
  init: init
};
