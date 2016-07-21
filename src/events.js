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
    for (var key in events) {
      var e = events[key];
      if (e.sprinkler !== sprinkler) {
        delete events[key];
      }
    }
    res.json(events);
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
