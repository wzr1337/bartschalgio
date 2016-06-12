var Gpio = require('onoff').Gpio;                    // Constructor function for Gpio objects.


// inits
var sprinklers = [2,3,4,17,21,22,10,9];



// Toggle the state of the LED on a sprinkler every 2000ms 'count' times.
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

// blink them all
for (var i = 0; i < sprinklers.length; i++) {
  blinkGpio(sprinklers[i], 10);
}
