'use strict';

var elasticsearch = require('elasticsearch');
var lodash = require('lodash');
var debug = require('debug')('plugins:elastic');

function ElasticPlugin(rawConfig, ee) {
  var self = this;
  self._report = [];

  var config = _reconcileConfigs(rawConfig);

  debug.enabled = config.logLevel === 'trace'

  debug('artillery plugin elastic.config: ' + JSON.stringify(config));

  var client = new elasticsearch.Client({
    host: {
      host: config.host,
      port: config.port,
      auth: config.user + ':' + config.password
    },
    log: config.logLevel
  });

  client.info();

  ee.on('stats', function (statsObject) {
    debug('on.stats()');

    var stats = statsObject.report();

    if (config.enableUselessReporting) {
      self._report.push({ timestamp: stats.timestamp, value: 'test' });
    }

    var cleanedStats = _cleanStats(stats, config.skipList, config.defaultValue);
    var success = _sendToElastic(client, cleanedStats, 'stats', config.indexPrefix);

  });

  ee.on('done', function (stats) {
    debug('on.done()');

    var cleanedStats = _cleanStats(stats, config.skipList, config.defaultValue);
    var success = _sendToElastic(client, cleanedStats, 'done', config.indexPrefix);
  });

  return this;
}

ElasticPlugin.prototype.report = function report() {
  if (this._report.length === 0) {
    return null;
  } else {
    this._report.push({
      timestamp: 'aggregate',
      value: { test: 'aggregate test' }
    });
    return this._report;
  }
};

function _sendToElastic(client, stats, type, indexPrefix) {
  client.index({
    index: indexPrefix,
    type: type,
    body: stats,
  }, function (error, response) {
    if (error)
      debug(JSON.stringify(error));

    debug(JSON.stringify(response));

    debug('elastic request done');
    return true;
  });
}

// Cleans the object from properties that are on the skiplist
function _cleanStats(value, skipList, defaultValue) {
  var cleanedStats = {};

  for (var propertyKey in value) {
    if (value.hasOwnProperty(propertyKey)) {
      if (lodash.includes(skipList, propertyKey)) {
        delete value[propertyKey];
      }
    }
  }

  // Set to defaultvalue
  _forceDefaultValues(value, defaultValue);

  return value;
}

function _forceDefaultValues(obj, defaultValue) {
  for (var prop in obj) {
    if (obj[prop] === Object(obj[prop])) {
      if (lodash.isEmpty(obj[prop])) {
        delete obj[prop];
      } else {
        _forceDefaultValues(obj[prop], defaultValue);
      }
    }
    else if (lodash.isNull(obj[prop]) || lodash.isNaN(obj[prop])) {
      obj[prop] = defaultValue;
    }
  }
};

function _generateSkipList(input) {
  let skipList = ['latencies']; //always skip these

  // Add any values passed in by the user
  if (lodash.isString(input)) {
    let inputWithoutSpaces = input.replace(/\s/g, '');
    skipList = skipList.concat(inputWithoutSpaces.split(','));
  }
  return skipList;
}

function _reconcileConfigs(config) {
  return {
    host: config.plugins.elastic.host || 'localhost',
    port: config.plugins.elastic.port || 9200,
    user: config.plugins.elastic.user || 'elastic',
    password: config.plugins.elastic.password || 'changeme',
    logLevel: config.plugins.elastic.logLevel || "trace",
    indexPrefix: config.plugins.elastic.indexPrefix || 'artillery',
    closingTimeout: config.plugins.elastic.timeout || 0,
    defaultValue: config.plugins.elastic.default || 0,
    skipList: _generateSkipList(config.plugins.elastic.skipList),
    // This is used for testing the plugin interface
    enableUselessReporting: config.plugins.elastic.enableUselessReporting
  }
}

module.exports = ElasticPlugin;

// Exported for testing purposes...
module.exports._generateSkipList = _generateSkipList;
module.exports._cleanStats = _cleanStats;
module.exports._reconcileConfigs = _reconcileConfigs;