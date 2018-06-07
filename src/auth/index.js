// authentication and authorization

var express = require('express'),
    app = express(),
    router = express.Router(),
    cjson = require('cjson'),
    path = require('path'),
    md5 = require('md5'),
    jsonfile = require('jsonfile'),
    logger = require("../lib/logger");


const AUTHFILE = path.join(__dirname, "../../config/auth.json");
const auth = jsonfile.readFileSync(AUTHFILE);
jsonfile.spaces= 2; //configure jsonfile

// inits
var sprinklers = [];
var init = () => {
  logger.info("[Auth] service spinning up");
}

//logger.error(decodeAuthorizationHeader("Basic dXNlcjpwYXNzd29yZA=="));
//logger.error(("Basic " + (new Buffer("user:password")).toString('base64')));

/**
 * Decode the basic authorization header
 * 
 * @param {string} auth 
 * 
 * @return {object} user and password as object {user: <String>, password: <String>}
 */
function decodeAuthorizationHeader(auth) {
  if (/Basic (.*)/.test(auth)) {
    var b64string = auth.match(/Basic (.*)/);
    var user_pass = Buffer.from(b64string[1], 'base64').toString().split(':');
    if (user_pass) {
      return {
        user: user_pass[0],
        password: user_pass[1]
      }
    }
  }
  return undefined;
}

function checkPassword(password, hash) {
  return md5(auth.salt + password) === hash;
}

function randomString(length) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var result = '';
  for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

/**
 * 
 * @param {*} whitelist a list of routes that bypass authorization
 */
function authorize(whitelist) {
  whitelist = whitelist || [];
  return function (req, res, next) {
    if(whitelist.indexOf(req.url) !== -1) {
      next();
      return;
    }
    console.log(req.get("Authorization"), /Bearer (\w+)/.test(req.get("Authorization")))
    if (req.get("Authorization")) {
      if (!/Bearer (\w+)/.test(req.get("Authorization"))) {
        res.status(401).send("No Bearer Token found in Authorization Header");
        return;
      }
      var key = req.get("Authorization").match(/Bearer (\w+)/)[1];
      var validKeys = Object.keys(auth.users).map((k) => auth.users[k].accessToken); // get the keys prior 7.0 Node
      console.log(validKeys);
      if (key && validKeys.indexOf(key) >= 0) {
        next();
        return;
      }
    }
    res.status(401).send("Unauthorized");
  }
};

router.post('/', (req, res) => {
  if(!req.get("Authorization")) {
    var err = new Error("No Authorization header found!");
    res.status(403);
    return res.json({error : err.message});
  }
  // decode header
  var login = decodeAuthorizationHeader(req.get("Authorization"));
  if (login && Object.keys(auth.users).indexOf(login.user) !== -1) {
    var user = auth.users[login.user];
    if (checkPassword(login.password, user.password)) {
      if(!user.accessToken || (new Date(user.tokenExpires)) < (new Date())) {
        res.status(201);
        // set new token
        auth.users[login.user].accessToken = user.accessToken = randomString(16);
        var aYearFromNow = new Date();
        // set new expiry in +1 years
        auth.users[login.user].expires = (new Date(aYearFromNow.setFullYear(aYearFromNow.getFullYear() + 1))).toString();
        // save it
        jsonfile.writeFileSync(AUTHFILE, auth);
        return res.json({access_token: user.accessToken});
      }
      res.status(200);
      return res.json({access_token : user.accessToken});
    }
    else {
      var err = new Error('Invalid password');
      res.status(403);
      return res.json({error : err.message});
    }
  }
  else {
    var err = new Error('Invalid username');
    res.status(403);
    return res.json({error : err.message});
  }
});


module.exports = {
  routes: router,
  init: init,
  authorize: authorize
};