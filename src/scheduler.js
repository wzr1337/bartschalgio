#! /usr/bin/env node
'use strict'

var request = require('request-promise');
var schedule = require('node-schedule');

const HOST = "127.0.0.1:3000"



console.log("Running the Sprinkler scheduler..");

function setSprinkler(id, isActive) {
  console.log("Setting Sprinkler %d", id, "to", isActive);
  if(typeof(id) !== "number" || typeof(isActive) === "undefined") throw new Error("Need id to be a number and isActive being defined");
  var options = {
      method: 'POST',
      uri: "http://" + HOST +"/sprinklers/" + id,
      body: {
        isActive: isActive
      },
      json: true // Automatically stringifies the body to JSON
  };

  return request.post(options)
    .then(function(resp) {
      console.log(resp);
    });
}

var j = schedule.scheduleJob({second: 0}, function(){
  setSprinkler(1, true);
});

var k = schedule.scheduleJob({second: 30}, function(){
  setSprinkler(1, false);
});
