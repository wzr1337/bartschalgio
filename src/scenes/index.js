var express = require('express'),
    sprinklers = require('../sprinklers'),
    router = express.Router();


const scenes = [
  {
    id: 5577300001,
    uri: "/scenes/5577300001",
    name: "all-in",
    isActive: false,
    currentSprinkler: 0,
    timeline: [
      {
        sprinkler: 7755300003,
        runtimeSeconds: 1800
      },
      {
        sprinkler: 7755300017,
        runtimeSeconds: 900
      },
      {
        sprinkler: 7755300004,
        runtimeSeconds: 1800
      }
    ]
  }
]

/*
 * A matcher function for spinkler matching
 *
 * @returns true if sprinkler matches input
 */
const matchScene = function (scene) {
  return scene.id === Number(this);
};

router.get('/:id?', (req, res) => {
  if (!req.params.id) {
    // send a list of all secenes
    res.status(200);
    var ret = [];
    for (var i = 0; i < scenes.length; i++) {
      ret.push(scenes[i]);
    }
    return res.json(ret);
  }
  //else lets return the sprinkler
  var scene = scenes.find(matchScene, req.params.id);
  if (!scene) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({
      error: err.message
    });
  }
  // get the actual status
  res.status(200);
  return res.json(scene);
});

router.post('/:id?', (req, res) => {
  if (!req.params.id) {
    // send a list of all secenes
    res.status(500);
    return res.json({
      error: "creation not implemented"
    });
  }
  //else lets return the sprinkler
  var scene = scenes.find(matchScene, req.params.id);
  if (!scene) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({
      error: err.message
    });
  }
  // get the actual status
  if (req.body.hasOwnProperty("isActive")) {
    if (req.body.isActive === true) {
        scene.isActive = true;
        scene.currentSprinkler = 0;
        clearTimeout(scene.timeout);
        delete scene.timeout;
        scene.timeout = nextSprinkler(scene).then(()=> {
          res.status(200);
          return res.json(scene);
        });
    }
    else {
        scene.isActive = false;
        sprinklers.changeSprinklerState(scene.timeline[scene.currentSprinkler].sprinkler, {
          isActive: false
        }).then(() => {
          clearTimeout(scene.timeout);
          delete scene.timeout;
        });
        scene.currentSprinkler = 0;
        res.status(200);
        return res.json(scene);
    }
  }
  else {
    res.status(400);
    return res.json({
      error: "Missing isActive flag"
    });
  }
});

async function nextSprinkler(scene) {
  if (scene.timeline.length < scene.currentSprinkler + 1) {
    clearTimeout(scene.timeout);
    delete scene.timeout;
    return;
  }
  const sprinkler = scene.timeline[scene.currentSprinkler];
  console.log(sprinkler.sprinkler)
  // switch it on
  await sprinklers.changeSprinklerState(sprinkler.sprinkler, {
      isActive: true
    });
  return setTimeout(async () => {
    // switch it off
    await sprinklers.changeSprinklerState(sprinkler.sprinkler, { isActive: false });
    scene.currentSprinkler++;
    scene.setTimeout = nextSprinkler(scene);
  }, sprinkler.runtimeSeconds * 1000);
}

module.exports = {
  routes: router
};
