#! /usr/bin/env node

var express = require('express'),
    os = require("os"),
    hostname = os.hostname(),
    app = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    colors = require('colors'),
    Gpio = require('onoff').Gpio;                    // Constructor function for Gpio objects.

//settings
const SPRINKLER_BASE_URI = 'sprinklers';
const sprinklerPins = [2,3,4,17,21,22,10,9];
// parse application/json
app.use(bodyParser.json())


/*
 * Filter the sprinkler object for serialization
 *
 * @param spinkler [object] the sprinkler object
 * @returns the filtered object
 */
const _toObject = (sprinkler) => {
  return {
    uri: sprinkler.uri,
    id: sprinkler.id,
    name: sprinkler.name,
    gpio: sprinkler.gpio.gpio,
    isActive: sprinkler.isActive
  }
}

// inits
var sprinklers = [];
var init = () => {
  console.log(colors.grey("[INFO] Initializing sprinkler pins."));
  for (var i = 0; i < sprinklerPins.length; i++) {
    var sprinkler = {
      uri: '/' + path.join(SPRINKLER_BASE_URI, i.toString()),
      id: i,
      name: "",
      gpio: new Gpio(sprinklerPins[i], 'out'),
      isActive: false
    };
    sprinkler.gpio.writeSync(1);
    sprinklers.push(sprinkler);
  }
  console.log(colors.grey("[INFO] Initialized", sprinklers.length, "sprinklers"));
}

/*
 * A matcher function for spinkler matching
 *
 * @returns true if sprinkler matches input
 */
const matchSprinkler = function(sprinkler) {
  return sprinkler.id === Number(this);
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
  //else lets return the sprinkler
  var sprinkler = sprinklers.find(matchSprinkler, req.params.id);

  if (!sprinkler) {
    var err = new Error('Object not found');
    res.status(404);
    return res.json({error : err.message});
  }

  var isActive = (req.body.isActive === true) || (req.body.isactive === true);
  console.log(isActive);
  if(req.body.hasOwnProperty('isActive') || req.body.hasOwnProperty('isactive')) {
    sprinkler.isActive = isActive;
    sprinkler.gpio.writeSync(isActive ? 0 : 1);
    res.status(200);
  }

  if(req.body.hasOwnProperty('name')) {
    sprinkler.name = req.body.name;
    res.status(200);
  }

  if (res.statusCode === 200) {
    return res.json(_toObject(sprinkler));
  }

  var err = new Error('No processable payload in request body');
  res.status(400);
  return res.json({error : err.message});
});

var server = app.listen(process.env.PORT || 3000, () => {
  console.log(colors.green("[INFO]"), "Server running on PORT", server.address().port);
});


// actual inits
init();
