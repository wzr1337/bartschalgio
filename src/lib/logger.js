var colors = require('colors');

const logger = (function () {
  const plotDate = () => {
    return new Date().toISOString();
  }

  return {
    log: function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(colors.white(plotDate(), "[LOG]"));
        console.log.apply(console, args);
    },
    warn: function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(colors.yellow(plotDate(), "[WARN]"));
        console.warn.apply(console, args);
    },
    info: function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(colors.grey(plotDate(), "[INFO]"));
        console.warn.apply(console, args);
    },
    error: function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(colors.red(plotDate(), "[ERROR]"));
        console.error.apply(console, args);
    },
    debug: () => {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(colors.yellow(plotDate(), "[DEBUG]"));
        console.log.apply(console, args);
    }
  }
}());

module.exports = exports = logger;
