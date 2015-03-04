'use strict';

var assert = require('assert-plus');
var events = require('events');
var util = require('util');

function Services() {
  var items = {};
  var waiters = {};

  Object.defineProperties(this, {

    get: {
      value: function get(name) {
        return items[name];
      }
    },

    set: {
      value: function set(name, value) {
        var had = items[name];
        items[name] = value;
        this.notify(name, value);
        return had;
      }
    },

    has: {
      value: function has(name) {
        return items.hasOwnProperty(name);
      }
    },

    notify: {
      value: function notify(name, value) {
        var waiting = waiters[name];
        if (waiting) {
          delete waiters[name];
          var i = -1,
            len = waiting.length;
          while (++i < len) {
            waiting[i](value);
          }
        }
      }
    },

    when: {
      value: function when(name, notify) {
        if (this.has(name)) {
          notify(this.get(name));
        } else {
          var waiting = waiters[name];
          if (!waiting) {
            waiters[name] = waiting = [];
          }
          waiting.push(notify);
        }
      }
    },

    listUnfulfilled: {
      value: function listUnfulfilled() {
        var keys = Object.keys(waiters);
        var acc = [];
        keys.forEach(function(k) {
          acc.push({
            name: k,
            waiters: waiters[k].length
          });
        });
        return (acc.length) ? acc : null;
      }
    }

  });
}

function Injector(options) {
  options = options || {};
  assert.optionalString(options.readyEventName, 'options.readyEventName');
  assert.optionalString(options.removeEventName, 'options.removeEventName');
  assert.optionalString(options.evictEventName, 'options.evictEventName');
  events.EventEmitter.call(this);

  Object.defineProperties(this, {

    _services: {
      value: new Services()
    },

    readyEventName: {
      enumerable: true,
      value: options.readyEventName || 'service-ready',
    },

    removeEventName: {
      enumerable: true,
      value: options.removeEventName || 'service-remove',
    },

    replaceEventName: {
      enumerable: true,
      value: options.evictEventName || 'service-replace',
    }

  });
}
util.inherits(Injector, events.EventEmitter);

Object.defineProperties(Injector.prototype, {

  get: {
    enumerable: true,
    value: function get(name) {
      return this._services.get(name);
    }
  },

  set: {
    enumerable: true,
    value: function set(name, value) {
      assert.string(name, 'name');
      var had = this._services.set(name, value);
      if (typeof(had) !== 'undefined') {
        this.emit(this.replaceEventName, {
          name: name,
          value: value
        });
      } else {
        this.emit(this.readyEventName, {
          name: name,
          value: value
        });
      }
      return had;
    }
  },

  has: {
    enumerable: true,
    value: function has(name) {
      assert.string(name, 'name');
      return this._services.has(name);
    }
  },

  when: {
    enumerable: true,
    value: function when(services, target) {
      var capture = (typeof(services) === 'string') ? [services] : services;
      assert.ok(Array.isArray(capture), '(arg 0) services must be either a string or an array');
      assert.func(target, 'target');
      var len = capture.length;
      var reg = this._services;
      if (len === 0) {
        target(); // when nothing ???
      } else if (len === 1) {
        reg.when(capture[0], target);
      } else {
        var i = -1;
        var name;
        var expecting = {};
        var observed = 0;
        var values = [];
        var possibly = function possibly(name, value) {
          values[expecting[name].index] = value;
          if (!expecting[name].observed) {
            expecting[name].observed = true;
            observed++;
            if (observed === len) {
              target.apply(null, values);
            }
          }
        };
        while (++i < len) {
          name = services[i];
          expecting[name] = {
            name: name,
            index: i
          };
          reg.when(name, possibly.bind(null, name));
        }
      }
    }
  },

  inject: {
    enumerable: true,
    value: function inject(services, target, missing) {
      services = (typeof(services) === 'string') ? [services] : services;
      assert.ok(Array.isArray(services), '(arg 0) services must be either a string or an array');
      assert.func(target, 'target');
      assert.optionalFunc(missing, missing);
      var i = -1,
        len = services.length,
        acc = [],
        it;
      var reg = this._services;
      if (services.length) {
        while (++i < len) {
          it = reg.get(services[i]);
          if (typeof(it) === 'undefined') {
            if (typeof(missing) === 'undefined' || !missing(services[i])) {
              return;
            }
          }
          acc.push(it);
        }
        target.apply(null, acc);
        return;
      }
      target();
    }
  },

  listUnfulfilled: {
    value: function listUnfulfilled() {
      return this._services.listUnfulfilled();
    }
  }

});

var _singleton;

Object.defineProperties(Injector, {

  singleton: {
    get: function () {
      if (!_singleton) {
        _singleton = new Injector();
      }
      return _singleton;
    }
  }

});

module.exports = Injector;
