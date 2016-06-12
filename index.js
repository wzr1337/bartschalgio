var sprinklers = [2,3,4,17,21,22,10,9];
var Gpio = require('onoff').Gpio;                    // Constructor function for Gpio objects.

// Toggle the state of the LED on GPIO #14 every 200ms 'count' times.
// Here asynchronous methods are used. Synchronous methods are also available.
function blink(sprinkler, count) {
  //var sprinkler = new Gpio(pin, 'out'); //Export GPIO as output
  if (count <= 0) {
    return sprinkler.unexport();
  }

  sprinkler.read(function (err, value) { // Asynchronous read.
    if (err) {
      throw err;
    }
    console.log("state %d on GPIO_%d", value, sprinkler.gpio);

    sprinkler.write(value ^ 1, function (err) { // Asynchronous write.
      if (err) {
        throw err;
      }
    });
  });

  setTimeout(function () {
    blink(sprinkler, count - 1);
  }, 2000);
};

function blinkGpio(pin, repeat) {
   blink(new Gpio(pin, 'out'), repeat);
}


blinkGpio(sprinklers[0], 10);
blinkGpio(sprinklers[1], 10);
blinkGpio(sprinklers[2], 10);
blinkGpio(sprinklers[3], 10);
