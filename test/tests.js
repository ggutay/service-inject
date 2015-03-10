/*global it: false, describe: false, before: false, after: false, afterEach: false*/
'use strict';

var util = require('util');
var expect = require('expect.js');
var Injector = require('../');

function print(it) {
  if (typeof(it) === 'string') {
    util.log(it);
  } else {
    util.log(util.inspect(it, false, 9));
  }
}

describe('Injector', function() {

  describe('when created with no options', function() {

    var inj;
    var key = 'my';
    var value = new Date().toUTCString();

    before(function() {
      inj = new Injector();
    });

    it('#set causes `service-ready` event', function(done) {

      inj.once('service-ready', function(evt) {
        try {
          expect(evt.value).to.be(value);
          done();
        } catch (e) {
          done(e);
        }
      });

      expect(inj.has(key)).to.be(false);
      inj.set(key, value);
    });

    it('#get returns previous value', function(done) {
      expect(inj.has(key)).to.be(true);
      expect(inj.get(key)).to.be(value);
      done();
    });

    describe('#inject', function() {

      it('calls target with value (keys as string)', function(done) {
        inj.inject(key, function(injected) {
          expect(injected).to.be(value);
          done();
        });
      });

      it('calls target with value (keys as array)', function(done) {
        inj.inject([key], function(injected) {
          expect(injected).to.be(value);
          done();
        });
      });

      it('cancels target when missing a requested item', function() {
        var targetCalled;
        inj.inject([key, 'none'], function(injected, missing) {
          targetCalled = true;
        });
        expect(targetCalled).to.not.be.ok();
      });

      it('cancels target if missing handler returns falsy result', function() {
        var missingCalled;
        var targetCalled;
        var missingKey = 'none';
        var target = function(injected, missing) {
          targetCalled = true;
        };
        var missingHandler = function(missing) {
          expect(missing).to.be(missingKey);
          missingCalled = true;
        };
        inj.inject([key, 'none'], target, missingHandler);
        expect(missingCalled).to.be(true);
        expect(targetCalled).to.not.be.ok();
      });

      it('calls target if missing handler returns truthy result', function() {
        var missingCalled;
        var targetCalled;
        var missingKey = 'none';
        var target = function(injected, missing) {
          expect(injected).to.be(value);
          expect(typeof(missing)).to.be('undefined');
          targetCalled = true;
        };
        var missingHandler = function(missing) {
          expect(missing).to.be(missingKey);
          missingCalled = true;
          return true;
        };
        inj.inject([key, 'none'], target, missingHandler);
        expect(missingCalled).to.be(true);
        expect(targetCalled).to.be(true);
      });
    });

    describe('#when', function() {

      it('waiting for one service gets one service when set', function(done) {
        var key = 'key#' + Math.random();
        var value = new Date().toISOString();
        var target = function(injected) {
          try {
            expect(injected).to.be(value);
            done();
          } catch (e) {
            done(e);
          }
        };
        inj.when(key, target);
        setTimeout(function() {
          inj.set(key, value);
        }, 1000);
      });

      it('waiting for two services gets two service when set', function(done) {
        this.timeout(3000);
        var key = 'key#' + Math.random();
        var key2 = 'key#' + Math.random();
        var value = new Date().toISOString();
        var value2;
        var target = function(v, v2) {
          try {
            expect(v).to.be(value);
            expect(v2).to.be(value2);
            expect(inj.listUnfulfilled()).to.be(null);
            done();
          } catch (e) {
            done(e);
          }
        };
        inj.when([key, key2], target);

        // while waiting, injector will report unfulfilled
        var unfulfilled = inj.listUnfulfilled();
        expect(unfulfilled).to.be.an(Array);
        expect(unfulfilled.length).to.be(2);

        setTimeout(function() {
          inj.set(key, value);
        }, 1000);
        setTimeout(function() {
          value2 = new Date().toISOString();
          inj.set(key2, value2);
        }, 1000);
      });
    });

    describe('#capture', function() {

      it('capturing one service applied when already set', function(done) {
        var key = 'key#' + Math.random();
        var value = new Date().toISOString();
        var target = function(injected) {
          try {
            expect(injected).to.be(value);
            done();
          } catch (e) {
            done(e);
          }
        };
        var capture = inj.capture(key);
        inj.set(key, value);
        setTimeout(function() {
          capture.apply(target);
        }, 1000);
      });

      it('capturing one service does not apply when unset', function(done) {
        var key = 'key#' + Math.random();
        var value = new Date().toISOString();
        var targetCalled;
        var target = function(v, v2) {
          targetCalled = true;
        };
        var capture = inj.capture(key);
        setTimeout(
          function() {
            try {
              expect(targetCalled).to.not.be.ok();
              done();
            } catch (e) {
              done(e);
            }
          }, 500);
      });

      it('capturing one service applies when unset and missing handler returns truthy result', function(done) {
        var key = 'key#' + Math.random();
        var value = new Date().toISOString();
        var target = function(injected) {
          try {
            expect(injected).to.not.be.ok();
            done();
          } catch (e) {
            done(e);
          }
        };
        var capture = inj.capture(key);
        capture.apply(target, function(name) {
          expect(name).to.be(key);
          return true;
        });
      });

      it('capturing two services does not apply when unset', function(done) {
        this.timeout(3000);
        var key = 'key#' + Math.random();
        var key2 = 'key#' + Math.random();
        var value = new Date().toISOString();
        var value2;
        var targetCalled;
        var target = function(v, v2) {
          targetCalled = true;
        };
        var capture = inj.capture([key, key2]);
        capture.apply(target);
        setTimeout(
          function() {
            try {
              expect(targetCalled).to.not.be.ok();
              done();
            } catch (e) {
              done(e);
            }
          }, 500);
      });

    });

  });
});
