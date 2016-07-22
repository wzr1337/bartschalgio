var firebase = require("firebase"),
    logger = require("./logger"),
    path = require("path"),
    express = require('express'),
    router = express.Router();

firebase.initializeApp({
  serviceAccount: path.join(__dirname, "../config/firebase.json"),
  databaseURL: "https://bartschlagio.firebaseio.com/"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = firebase.database();
var ref = db.ref("sprinklertimes");

router.get('/', function(req, res) {
  // http://nerderiagarden:3000/events/?spinkler=someId&from=1469134153708&to=1469134157269

  var fromTime = parseInt(req.query.from); //timestamp
  var toTime = parseInt(req.query.to); //timestamp
  var sprinkler = req.query.spinkler;
  if (!sprinkler) {
    var err = new Error("Missing query parameter 'sprinkler'. E.g. '/events/?spinkler=123456789&from=1469134153708&to=1469134157269'");
    res.status(400);
    res.json({
      status: "error",
      message: err.message
    });
    return;
  }

  // build a query
  var sprinklerEvents = ref.orderByChild("timestamp");
  if (fromTime) {
    sprinklerEvents = sprinklerEvents.startAt(fromTime);
  }
  if (toTime) {
    sprinklerEvents = sprinklerEvents.endAt(toTime);
  }

  //listen to the query
  sprinklerEvents.once('value', (snapshot) => {
    // client side filtering for values
    var events = snapshot.val();
    var _events = [];
    for (var key in events) {
      var e = events[key];
      if (e.sprinkler !== sprinkler) {
        delete events[key];
      }
      else {
        _events.push(events[key]);
      }
    }
    const ret = {
      status: "ok",
      data: (null === events) ? [] : _events
    }
    res.json(ret);
  });
});

var pushEvent = (sprinkler, volume, duration) => {
  logger.log("setting")
  var eventRef = ref.push();
  eventRef.update({
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    durationInSeconds: duration,
    sprinkler: sprinkler,
    volumeInLiters: volume
  }).then(() => {
    logger.log("Event logged remotely: ", eventRef.key);
  });
};


module.exports = {
  routes: router,
  push: pushEvent
};
