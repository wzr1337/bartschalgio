var express = require('express'),
    firebase = require("../firebase"),
    sprinklers = require('../sprinklers'),
    path = require('path'),
    logger = require("../lib/logger"),
    cjson = require('cjson'),
    router = express.Router();

const scenarios = cjson.load(path.join(__dirname, "../../config/scenarios.json"));
const BASE_URI = 'scenarios';
const REFNAME = (process.env.NODE_ENV === 'production') ? "scenarios" : "dev_scenarios";
var scenariosRef = firebase.db.ref(REFNAME);


/**
 * Register for changes on the sprinklers on firebase
 *
 */
const registerForFirebaseEvents =  () => {
  scenariosRef.on('child_changed', async (snapshot) => {
    const scenario = snapshot.toJSON();
    logger.log(`${scenario.id}(${scenario.name}) was set remotely`);
    scenario.fb_path = snapshot.ref.toString().substring(snapshot.ref.root.toString().length);
    await setScenarioState(scenario, {state: scenario.state });
  })
}

const init = async () => {
  // flush the sprinklers data to have unique entries
  try {
    await scenariosRef.remove();
    registerForFirebaseEvents();
    logger.log("Remove succeeded.")
  }
  catch (error) {
    logger.error("Remove failed: " + error.message)
  };
  for (let index = 0; index < scenarios.length; index++) {
    let scenario = scenarios[index];
    scenario.uri = "/" + BASE_URI + "/" + scenario.id;
    scenario.currentSprinkler = 0;
    scenario.state = "stopped";
    const ref = await scenariosRef.push(scenario);
    scenario.fb_path = ref.toString().substring(ref.root.toString().length);
    updateScenarioGlobally(scenario);
    logger.info(`Registered ${scenario.id}(${scenario.name}) with the server`);
  }
}

init();

/*
 * A matcher function for spinkler matching
 *
 * @returns true if sprinkler matches input
 */
const matchScenario = function (scenario) {
  return scenario.id === Number(this);
};

router.get('/:id?', (req, res) => {
  if (!req.params.id) {
    // send a list of all secenes
    res.status(200);
    return res.json(scenarios);
  }
  //else lets return the sprinkler
  var scenario = scenarios.find(matchScenario, req.params.id);
  if (!scenario) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({
      error: err.message
    });
  }
  // get the actual status
  res.status(200);
  return res.json(scenario);
});

router.post('/:id?', async (req, res) => {
  if (!req.params.id) {
    // send a list of all secenes
    res.status(500);
    return res.json({
      error: "creation not implemented"
    });
  }
  //else lets return the sprinkler
  var scenario = scenarios.find(matchScenario, req.params.id);
  if (!scenario) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({
      error: err.message
    });
  }
  // get the actual status
  if (req.body.hasOwnProperty("state")) {
    const resp = await setScenarioState(scenario, req.body);
    logger.info("Set Scenario", scenario.id);
    res.status(resp.status);
    return res.json(scenario);
  }
  else {
    res.status(400);
    return res.json({
      error: "Missing state property"
    });
  }
});

async function setScenarioState(scenario, body) {
  return new Promise(async (resolve, reject) => {
    logger.info("Setting scenario isActive flag to", body.state);
    // scenario = scenarios.find(matchScenario, scenario.id);
    if (body.state === "start") {
         // set it shutdown
      scenario.state = body.state;
      scenario.currentSprinkler = 0;
      await firebase.db.ref(scenario.fb_path).update(scenario);
      clearTimeout(scenario.timeout);
      delete scenario.timeout;
      scenario.timeout = nextSprinkler(scenario).then(async ()=> {
        scenario.state = "running";
        await firebase.db.ref(scenario.fb_path).update({ state: scenario.state });
        updateScenarioGlobally(scenario);
        resolve({status: 200});
      });
      updateScenarioGlobally(scenario);
    }
    if (body.state === "stop") {
        scenario.state = body.state;
        await firebase.db.ref(scenario.fb_path).update({ state: body.state });
        updateScenarioGlobally(scenario);
        sprinklers.setSprinklerState(scenario.timeline[scenario.currentSprinkler].sprinkler, {
          isActive: false
        }).then(async () => {
          clearTimeout(scenario.timeout);
          scenario.state = "stopped";
          await firebase.db.ref(scenario.fb_path).update({ state: scenario.state });
          delete scenario.timeout;
          updateScenarioGlobally(scenario);
        });
       //delete scenario.currentSprinkler;
      resolve({status: 200});
    }
  });
}

function updateScenarioGlobally(scenario) {
  const index = scenarios.findIndex(matchScenario, scenario.id);
  scenarios[index] = scenario;
}


async function nextSprinkler(scenario) {
  logger.info("nextSprinkler for scenario:", scenario.id)
  if (scenario.timeline.length < scenario.currentSprinkler + 1) {
    clearTimeout(scenario.timeout);
    delete scenario.timeout;
    return;
  }
  const sprinkler = scenario.timeline[scenario.currentSprinkler];
  // switch it on
  await sprinklers.setSprinklerState(sprinkler.sprinkler, {
      isActive: true
    });
  return setTimeout(async () => {
    // switch it off
    await sprinklers.setSprinklerState(sprinkler.sprinkler, { isActive: false });
    scenario.currentSprinkler++;
    scenario.setTimeout = nextSprinkler(scenario);
  }, sprinkler.runtimeSeconds * 1000);
}

module.exports = {
  routes: router
};
