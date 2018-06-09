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
    autoShutOffSeconds: device.autoShutOffSeconds,
    autoEndsAt: device.autoEndsAt,
    startedAt: device.startedAt,
    remaining: device.autoEndsAt- Date.now()
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
  const ret = changeSprinklerState(req.params.id, req.body);
  res.status(ret.status);
  return res.json(ret.body);
});

async function changeSprinklerState(id, states) {
  // else lets return the sprinkler
  var sprinkler = sprinklers.find(matchSprinkler, id);
  var statusCode;

  logger.info(`changeSprinklerState(${id})`);

  // fi no sprinler was found, retun an error
  if (!sprinkler) {
    var err = new Error('Object not found');
    return {
      status: 404,
      body: {
        error: err.message
      }
    };
  }

  // check for changes in isActive state, set the GPIO and set the response code to 200
  var isActive = (states.isActive === true) || (states.isactive === true);

  if (sprinkler.isActive === isActive) {
    logger.info("Doing nothing, current state", sprinkler.isActive, "equals desired state", isActive);
    return {
      status: 200,
      body: _toObject(sprinkler)
    }
  }

  if (states.hasOwnProperty('isActive') || states.hasOwnProperty('isactive')) {
    sprinkler.isActive = isActive;

    function endSprinkling(sprinkler) {
      //make sure the timeout is not running anymore
      clearTimeout(sprinkler.shutOffTimeOut);
      events.push(sprinkler.id.toString(), sprinkler.sprinklingRateLitersPerSecond, sprinkler.startedAt, Date.now());
      delete sprinkler.startedAt;
      delete sprinkler.autoEndsAt;
      sprinkler.gpio.writeSync(1);
      sprinkler.isActive = false; // make sure it is set to false, even if it already is
    }

    if (isActive && !sprinkler.startedAt) {
      // start sprinkling
      sprinkler.startedAt = Date.now();
      sprinkler.autoEndsAt = sprinkler.startedAt + (sprinkler.autoShutOffSeconds * 1000);
      sprinkler.gpio.writeSync(0);

      // automatically shutOff the sprinkler after configured time
      if (sprinkler.autoShutOffSeconds > 0) {
        clearTimeout(sprinkler.shutOffTimeOut);
        sprinkler.shutOffTimeOut = setTimeout(() => {
          logger.info("Automatic sprinkler shut off:", sprinkler.id);
          endSprinkling(sprinkler);
        }, sprinkler.autoShutOffSeconds * 1000);
      }
    } else {
      // end immediately
      logger.info("Manual sprinkler shut off:", sprinkler.id);
      delete sprinkler.startedAt;
      delete sprinkler.autoEndsAt;
      endSprinkling(sprinkler);
    }

    statusCode = 200;
  }

  // check for name changes
  if (states.hasOwnProperty('name')) {
    sprinkler.name = states.name;
    statusCode = 200;
  }

  // if everything was sucessfully processed, send 200 repsonse
  if (statusCode === 200) {
    logger.log("new gpio state:", _toObject(sprinkler));
    return {
      status: statusCode,
      body: _toObject(sprinkler)
    };
  }

  // There was nothing found to process in the body
  var err = new Error('No processable payload in request body');
  return {
    status: 400,
    body: {
    error: err.message
    }
  };
}

module.exports = {
  routes: router,
  changeSprinklerState: changeSprinklerState,
  init: init
};
