var express = require('express'),
    firebase = require("../firebase"),
    sprinklers = require('../sprinklers'),
    path = require('path'),
    logger = require("../lib/logger"),
    cjson = require('cjson'),
    router = express.Router();

const scenariosRaw = cjson.load(path.join(__dirname, "../../config/scenarios.json"));
const BASE_URI = 'scenarios';
const REFNAME = (process.env.NODE_ENV === 'production') ? "scenarios" : "dev_scenarios";
var scenariosRef = firebase.db.ref(REFNAME);
let scenarios = {};


/**
 * Register for changes on the sprinklers on firebase
 *
 */
const registerForFirebaseEvents =  () => {
  scenariosRef.on('child_changed', async (snapshot) => {
    const scenario = snapshot.toJSON();
    logger.log(`${scenario.id}(${scenario.name}) was set remotely`);
    scenario.fb_path = snapshot.ref.toString().substring(snapshot.ref.root.toString().length);
    await setScenarioState(scenario.id, {state: scenario.state });
  })
}

const repeatScenario = async (fn, hh = 0, mm = 0, ss = 0) => {
  logger.debug(hh,mm,ss)
  var msToWait = (hh*60*60 +mm*60 +ss)*1000;
  // wait
  logger.info("waiting", msToWait, "ms for next scenario run");
  await sleep(msToWait);
  fn();
  await repeatScenario(fn, hh, mm, ss);
}

const init = async () => {
  // flush the sprinklers data to have unique entries
  try {
    await scenariosRef.remove();
    registerForFirebaseEvents();
    logger.log("Scenarios removal succeeded.");
  }
  catch (error) {
    logger.error("Scenarios removal failed: " + error.message)
  };
  for (const scenario of scenariosRaw /*let index = 0; index < scenarios.length; index++*/) {
    //let scenario = scenarios[index];
    scenario.uri = "/" + BASE_URI + "/" + scenario.id;
    delete scenario.currentSprinkler;
    scenario.state = "stopped";
    const ref = await scenariosRef.push(scenario);
    scenario.fb_path = ref.toString().substring(ref.root.toString().length);
    scenarios[scenario.id] = scenario;
    logger.info(`Registered ${scenario.id}(${scenario.name}) with firebase`);
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
    return res.json(Object.values(scenarios));
  }
  //else lets return the sprinkler
  var scenario = scenarios[req.params.id];
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
  if (!scenarios[req.params.id]) {
    var err = new Error("Object not found");
    res.status(404);
    return res.json({
      error: err.message
    });
  }
  // get the actual status
  if (req.body.hasOwnProperty("state")) {
    const resp = await setScenarioState(req.params.id, req.body);
    logger.info("Set Scenario", scenario.id);
    res.status(resp.status);
    return res.json(scenarios[req.params.id]);
  }
  else {
    res.status(400);
    return res.json({
      error: "Missing state property"
    });
  }
});

async function setScenarioState(scenarioId, body) {
  if (!scenarioId) throw new Error("missing scenarioId");
  return new Promise(async (resolve, reject) => {
    logger.info("Setting scenario state to", body.state);
    if (body.state === "start") {
      // set it shutdown
      scenarios[scenarioId].state = body.state;
      delete scenarios[scenarioId].currentSprinkler;
      scenarios[scenarioId].state = "running";
      await firebase.db.ref(scenarios[scenarioId].fb_path).update({state: scenarios[scenarioId].state});
      logger.log(`scenario ${scenarioId}(${scenarios[scenarioId].name}) ${scenarios[scenarioId].state}`);
      runScenario(scenarioId);
      resolve({status: 200});
    }
    else if (body.state === "stop") {
      scenarios[scenarioId].state = body.state;
      await firebase.db.ref(scenarios[scenarioId].fb_path).update({state: scenarios[scenarioId].state});
      logger.log(`scenario ${scenarioId}(${scenarios[scenarioId].name}) ${scenarios[scenarioId].state}`);
      await sprinklers.setSprinklerState(scenarios[scenarioId].currentSprinkler, {
        isActive: false
      });
      delete scenarios[scenarioId].currentSprinkler;
      scenarios[scenarioId].state = "stopped";
      await firebase.db.ref(scenarios[scenarioId].fb_path).update({state: scenarios[scenarioId].state});
      logger.log(`scenario ${scenarioId}(${scenarios[scenarioId].name}) ${scenarios[scenarioId].state}`);
      resolve({status: 200});
    }
    else {
      logger.info("UNable to set scenario state", body.state, "not recognized, use start/stop");
    }
  });
}

const sleep = require('util').promisify(setTimeout)

const runScenario = async (scenarioId) => {
  if (!scenarioId) throw new Error("missing scenarioId");
  
  logger.info("running scenario:", scenarios[scenarioId].timeline);
  for (const item of scenarios[scenarioId].timeline) {
    if (scenarios[scenarioId].state !== "running") break; // break the loop
    logger.info(`${scenarios[scenarioId].name} activates sprinkler ${item.sprinkler} based on timeline`);
    scenarios[scenarioId].currentSprinkler = item.sprinkler;
    // switch it on
    await sprinklers.setSprinklerState(item.sprinkler, { isActive: true });
    // wait
    await sleep(item.runtimeSeconds * 1000);
    // switch off
    await sprinklers.setSprinklerState(item.sprinkler, { isActive: false });
    logger.info(`${scenarios[scenarioId].name} de-activates sprinkler ${item.sprinkler} based on  timeline`);
  }
  // if daily run is activated, do it
  if (scenarios[scenarioId].runDaily) {
    await repeatScenario(() => { 
      logger.info(`daily ${scenarios[scenarioId].runDaily.HH}:${scenarios[scenarioId].runDaily.MM}:${scenarios[scenarioId].runDaily.SS}`)
      runScenario(scenarioId)
    }, scenarios[scenarioId].runDaily.HH, scenarios[scenarioId].runDaily.MM, scenarios[scenarioId].runDaily.SS);
  }
  // stop scenario once all sprinklers were run
  await setScenarioState(scenarioId, {state: "stopped"});

}


module.exports = {
  routes: router
};
