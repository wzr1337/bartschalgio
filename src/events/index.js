var firebase = require("../firebase"),
    logger = require("../lib/logger"),
    express = require('express'),
    router = express.Router();

const REFNAME = (process.env.NODE_ENV === 'production') ? "events" : "dev_events";
var ref = firebase.db.ref(REFNAME);

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
  var sprinklerEvents = ref.orderByChild("start");
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

var pushEvent = (sprinkler, volume, start, end) => {
  var err = [];
  if(!sprinkler) {
    err.push(new Error("`sprinkler` parameter undefined, can not push"));
  }
  if(!volume) {
    err.push(new Error("`volume` parameter undefined, can not push"));
  }
  if(!start) {
    err.push(new Error("`start` parameter undefined, can not push"));
  }
  if(!end) {
    err.push(new Error("`end` parameter undefined, can not push"));
  }
  if (err.length > 0) {
    for (var i = 0; i < err.length; i++) {
      logger.error(err[i].message);
    }
    return;
  }


  var eventRef = ref.push();
  eventRef.update({
    end: end,
    start: start,
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
