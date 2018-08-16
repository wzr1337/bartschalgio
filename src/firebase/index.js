var firebase = require("firebase"),
    path = require("path");

const FIREBASECONFIG = path.join(__dirname, "../../config/firebase.json");

firebase.initializeApp({
  serviceAccount: FIREBASECONFIG,
  databaseURL: "https://bartschlagio.firebaseio.com/"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules

module.exports = {
    db: firebase.database()
};
  