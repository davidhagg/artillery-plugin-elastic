var assert = require('chai').assert;
var ElasticPlugin = require('../index')

describe('Configuration', function () {
  it('should use defaults when no values are passed', function () {

    var reconciledConfigs = ElasticPlugin._reconcileConfigs({ plugins: { elastic: {} } });

    assert.equal(reconciledConfigs.host, 'localhost', 'Host is localhost');
    assert.equal(reconciledConfigs.port, 9200, 'Port is 9200');
    assert.equal(reconciledConfigs.user, 'elastic', 'User is elastic');
    assert.equal(reconciledConfigs.password, 'changeme', 'Password is changeme');
    assert.equal(reconciledConfigs.logLevel, "trace", 'Loglevel is trace');
    assert.equal(reconciledConfigs.indexPrefix, 'artillery', 'Index prefix is artillery');
    assert.equal(reconciledConfigs.closingTimeout, 0, 'Timeout 0');
    assert.equal(reconciledConfigs.defaultValue, 0, 'DefaultValue 0');
    assert.deepEqual(reconciledConfigs.skipList, ['latencies'], 'Skipping timestamp and latencies');

  });

  it('should be able to overridable', function () {
    var config = {
      plugins: {
        elastic: {
          host: 'elasticsearchhost',
          port: 9300,
          user: 'elastic',
          password: 'changeme',
          logLevel: "debug",
          indexPrefix: 'someprefix',
          timeout: 10,
          default: 100000
        }
      }
    };

    var reconciledConfigs = ElasticPlugin._reconcileConfigs(config);
    
      assert.equal(reconciledConfigs.host, 'elasticsearchhost', 'Host is overridable');
      assert.equal(reconciledConfigs.port, 9300, 'Port is overridable');
      assert.equal(reconciledConfigs.user, 'elastic', 'User is overridable');
      assert.equal(reconciledConfigs.password, 'changeme', 'Password is overridable');
      assert.equal(reconciledConfigs.logLevel, "debug", 'Log level is overridable');
      assert.equal(reconciledConfigs.indexPrefix, 'someprefix', 'Prefix is overridable');
      assert.equal(reconciledConfigs.closingTimeout, 10, 'Timeout is overridable');
      assert.equal(reconciledConfigs.defaultValue, 100000, 'DefaultValue is overridable');

    });
});

describe('Skip List', function () {

  it('can handle user input', function () {

    assert.deepEqual(ElasticPlugin._generateSkipList('rps'), ['latencies', 'rps'], 'Single Value');
    assert.deepEqual(ElasticPlugin._generateSkipList('rps,errors'), ['latencies', 'rps', 'errors'], 'No Spaces');
    assert.deepEqual(ElasticPlugin._generateSkipList('rps, errors, codes'), ['latencies', 'rps', 'errors', 'codes'], 'Spaces');

  });

});

describe('Cleaning', function () {
  
  var commonSkipList = ['latencies'];

  it('returns basic', function () {
    var basic = { basic: 500, timestamp: '2016-10-31T08:35:21.676Z' };

    assert.deepEqual(ElasticPlugin._cleanStats(basic, commonSkipList, 0), basic, 'Basic in, basic out');
  });

  it('returns basic but removes skipped', function () {
    var basic = { basic: 500, timestamp: '2016-10-31T08:35:21.676Z' };
    var basicPlusSkipped = {
      basic: 500,
      timestamp: '2016-10-31T08:35:21.676Z',
      latencies: [[1477902921336, '761465ff-220d-4924-b1c1-062868d3169b', 428076699, 301], [1477902921342, 'e8fa92e9-50bf-4d67-bce9-f7bc8e3687ee', 259315569, 301]]
    };

    assert.deepEqual(ElasticPlugin._cleanStats(basicPlusSkipped, commonSkipList, 0), basic);
  });

  it('returns nothing when all are skipped', function () {
    var basic = { basic: 500, timestamp: '2016-10-31T08:35:21.676Z' };
    var basicPlusSkipped = {
      basic: 500,
      timestamp: '2016-10-31T08:35:21.676Z',
      latencies: [[1477902921336, '761465ff-220d-4924-b1c1-062868d3169b', 428076699, 301], [1477902921342, 'e8fa92e9-50bf-4d67-bce9-f7bc8e3687ee', 259315569, 301]]
    };

    assert.deepEqual(ElasticPlugin._cleanStats(basicPlusSkipped, commonSkipList.concat(['basic', 'timestamp']), 0), {});
  });

  it('returns default value for null properties', function () {
    var nullProperty = {
      scenariosCreated: null
    }

    assert.deepEqual(ElasticPlugin._cleanStats(nullProperty, commonSkipList, 0), { scenariosCreated: 0 });
  });

  it('skips empty objects', function () {
    var emptyProperty = {
      errors: {}
    }

    assert.deepEqual(ElasticPlugin._cleanStats(emptyProperty, commonSkipList, 0), {});
  });

  var subProperties = {
    customStats: {
      so: {
        value: 10,
        many: {
          value: 11,
          properties: {
            value: 12
          }
        }
      }
    }
  };

  it('returns subproperties with values', function () {
    assert.deepEqual(ElasticPlugin._cleanStats(subProperties, commonSkipList, 0), subProperties);
  });

  it('skips subproperties without values', function () {
    
    var subPropertiesWithNestedNullValues = subProperties;
    subPropertiesWithNestedNullValues.customStats.so.many.value = null;

    var expectedProperties = subProperties;
    expectedProperties.customStats.so.many.value = 0;

    assert.deepEqual(ElasticPlugin._cleanStats(subPropertiesWithNestedNullValues, commonSkipList, 0), subProperties);
  });  

});