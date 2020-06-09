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
    const scenarioUpdateFromFirebase = snapshot.toJSON();
    logger.log(`${scenarioUpdateFromFirebase.id}(${scenarioUpdateFromFirebase.name}) was set remotely`);
    scenarioUpdateFromFirebase.fb_path = snapshot.ref.toString().substring(snapshot.ref.root.toString().length);
    scenarioUpdateFromFirebase.currentSprinkler = scenarios[scenarioUpdateFromFirebase.id].currentSprinkler;
    logger.info(`updating scenario ${scenarioUpdateFromFirebase.id}(${scenarioUpdateFromFirebase.name})`);
    const currentState = scenarios[scenarioUpdateFromFirebase.id].state;
    scenarios[scenarioUpdateFromFirebase.id] = scenarioUpdateFromFirebase;
    if (scenarioUpdateFromFirebase.state !== currentState) await setScenarioState(scenarioUpdateFromFirebase.id, {state: scenarioUpdateFromFirebase.state});
  })
}

const repeatScenario = async (fn, hh = 0, mm = 0, ss = 0) => {
  var msToWait = (hh*60*60 +mm*60 +ss)*1000;
  // wait
  logger.info("waiting", msToWait, "ms for next scenario run");
  await sleep(msToWait);
  fn();
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


/// !!! This need rewriting as the local cache in this.scenarios holds all the correct information after the child ChannelMergerNode, it might conflict with REST Access..
/// The method is invoked double every time it call itself, so quickly adds thousands of runs
async function setScenarioState(scenarioId, state) {
  if (!scenarioId) throw new Error("missing scenarioId");
  const scenario = scenarios[scenarioId];
  return new Promise(async (resolve, reject) => {
    switch (state.state) {
      case "start":
        delete scenarios[scenarioId].currentSprinkler;
        await firebase.db.ref(scenario.fb_path).update({state: "running"});
        logger.log(`scenario ${scenarioId}(${scenario.name}) set to "running"`);
        runScenario(scenarioId);
        resolve({status: 200});
        break;
      case "stop":
        scenarios[scenarioId].state = "stopping";
        await firebase.db.ref(scenario.fb_path).update({state: "stopping"});
        await sprinklers.setSprinklerState(scenario.currentSprinkler, {
          isActive: false
        });
        delete scenarios[scenarioId].currentSprinkler;
        scenarios[scenarioId].state = "stopped";
        await firebase.db.ref(scenarios[scenarioId].fb_path).update({state: "stopped"});
        logger.log(`scenario ${scenarioId}(${scenario.name}) set to "stopped"`);
        resolve({status: 200});
        break;
      default:
        const err = new Error(`scenario ${scenarioId}(${scenario.name}) set to "${scenario.state}" failed, as unknown`)
        logger.error(err.message);
        reject({status: 500, error: err.message});
        break;
    }
  });
}

const sleep = require('util').promisify(setTimeout)

const runScenario = async (scenarioId) => {
  if (!scenarioId) throw new Error("missing scenarioId");
  let currentScenario = scenarios[scenarioId];
  logger.info("running scenario:", currentScenario.timeline);
  let runs = Object.values(currentScenario.runs || []);
  logger.info(runs)
  const now = (new Date).toUTCString();
  runs.push(now);
  await firebase.db.ref(currentScenario.fb_path).update({runs});
  for (const idx in currentScenario.timeline) {
    const item = currentScenario.timeline[idx];
    logger.error("item:", item)
    if (scenarios[scenarioId].state !== "running") break; // break the loop => MUST NOT use the `currentScenario` variable as it would not reflect changes while running
    scenarios[scenarioId].currentSprinkler = item.sprinkler;
    logger.error("Scenario cache: ", scenarios[scenarioId])
    // switch it on
    logger.info(`${currentScenario.name} activates sprinkler ${item.sprinkler} based on timeline`);
    await sprinklers.setSprinklerState(item.sprinkler, { isActive: true });
    // wait
    await sleep(item.runtimeSeconds * 1000);
    // switch off
    logger.info(`${currentScenario.name} de-activates sprinkler ${item.sprinkler} based on  timeline`);
    await sprinklers.setSprinklerState(item.sprinkler, { isActive: false });
  }
  // if daily run is activated, do it
  if (currentScenario.runDaily) {
    await repeatScenario(() => { 
      logger.info(`daily ${currentScenario.runDaily.HH}:${currentScenario.runDaily.MM}:${currentScenario.runDaily.SS}`)
      runScenario(scenarioId)
    }, currentScenario.runDaily.HH, currentScenario.runDaily.MM, currentScenario.runDaily.SS);
  }
  // stop scenario once all sprinklers were run
  await setScenarioState(scenarioId, {state: "stop"});

}


module.exports = {
  routes: router
};
