var express = require('express'),
    os = require("os"),
    hostname = os.hostname(),
    app = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    Gpio = require('onoff').Gpio;                    // Constructor function for Gpio objects.

//settings
const SPRINKLER_BASE_URI = 'sprinklers';
const sprinklerPins = [2,3,4,17,21,22,10,9];
// parse application/json
app.use(bodyParser.json())

// inits
var sprinklers = [];
var init = () => {
  for (var i = 0; i < sprinklerPins.length; i++) {
    sprinklers.push({
      uri: '/' + path.join(SPRINKLER_BASE_URI, i.toString()),
      id: i,
      name: "",
      gpio: new Gpio(sprinklerPins[i], 'out'),
      isActive: false
    });
    sprinklers[i].gpio.write(1, function (err) { // Asynchronous write.
      if (err) {
        console.log(err);
      }
    });
  }
}

function matchSprinkler(sprinkler) {
  return sprinkler.id === Number(this);
}

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
  var services = {
    [SPRINKLER_BASE_URI] : {
      uri: '/' + SPRINKLER_BASE_URI + '/'
    }
  }
  res.status(200);
  res.json(services);
});

app.get('/' + path.join(SPRINKLER_BASE_URI, ':id?'), (req, res) => {
  if(!req.params.id) {
    // send a list of all sprinklers
    res.status(200);
    return res.json(sprinklers);
  }
  //else lets return the sprinkler
  var sprinkler = sprinklers.find(matchSprinkler, req.params.id);
  if (!sprinkler) {
    res.status(404);
    res.send('Object not found');
  }
  res.status(200);
  return res.json(sprinkler);
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
  if(req.body.hasOwnProperty('isActive') || req.body.hasOwnProperty('isactive')) {
    sprinkler.isActive = isActive;
    sprinkler.gpio.write(isActive ? 1 : 0, function (err) { // Asynchronous write.
      if (err) {
        console.log(err);
      }
    });
    res.status(200);
  }

  if(req.body.hasOwnProperty('name')) {
    sprinkler.name = req.body.name;
    res.status(200);
  }

  if (res.statusCode === 200) {
    return res.json(sprinkler);
  }

  var err = new Error('No processable payload in request body');
  res.status(400);
  return res.json({error : err.message});
});

var server = app.listen(3000, () => {
  console.log("Server running on PORT %d", server.address().port);
});


// actual inits
init();
