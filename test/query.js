/**
 * Copyright (c) 2017 Chris Baker <mail.chris.baker@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

'use strict';

var assert = require('assert');
var dynalite = require('dynalite');
var EventStore = require('..');

function delayed(done) {
  return function () {
    const args = [].slice.call(arguments);

    setTimeout(function () {
      done.apply(this, args);
    });
  };
}

describe('querying commits', function () {
  beforeEach(function (done) {
    this.server = dynalite({
      createTableMs: 1,
      deleteTableMs: 1,
      updateTableMs: 1
    });

    var eventStore = this.eventStore = new EventStore({
      endpoint: 'http://localhost:4567',
      region: 'us-east-1',
      accessKeyId: 'access',
      secretAccessKey: 'secret',
      commitTableName: 'commits',
      commitIndexName: 'byId',
      counterTableName: 'counters',
      now: function () {
        return 0;
      }
    });

    this.server.listen(4567, function () {
      eventStore.createCommitTable(delayed(function (err) {
        assert.deepEqual(err);

        eventStore.createCounterTable(delayed(function (err) {
          assert.deepEqual(err);
          done();
        }));
      }));
    });
  });

  afterEach(function (done) {
    var server = this.server;
    var eventStore = this.eventStore;

    eventStore.deleteCommitTable(delayed(function () {
      eventStore.deleteCounterTable(delayed(function () {
        server.close(done);
      }));
    }));
  });

  it('can query commits that do not exist', function (done) {
    var commit = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0
    };

    this.eventStore.query(commit, function (err, commits) {
      assert.deepEqual(err);
      assert.deepEqual(commits, []);
      done();
    });
  });

  it('can query commits from beginning', function (done) {
    var eventStore = this.eventStore;

    var one = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0,
      events: [ 'foo', 'bar' ]
    };

    var two = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 1,
      events: [ 'foo', 'bar' ]
    };

    var query = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0
    };

    eventStore.append(one, function () {
      eventStore.append(two, function () {
        eventStore.query(query, function (err, commits) {
          assert.deepEqual(err);

          assert.deepEqual(commits, [
            {
              commitId: 1,
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 0,
              events: [ 'foo', 'bar' ]
            },
            {
              commitId: 2,
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'foo', 'bar' ]
            }
          ]);

          done();
        });
      });
    });
  });

  it('can query commits from middle', function (done) {
    var eventStore = this.eventStore;

    var one = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0,
      events: [ 'foo', 'bar' ]
    };

    var two = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 1,
      events: [ 'foo', 'bar' ]
    };

    var query = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 1
    };

    eventStore.append(one, function () {
      eventStore.append(two, function () {
        eventStore.query(query, function (err, commits) {
          assert.deepEqual(err);

          assert.deepEqual(commits, [
            {
              commitId: 2,
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'foo', 'bar' ]
            }
          ]);

          done();
        });
      });
    });
  });

  it('can query commits from end', function (done) {
    var eventStore = this.eventStore;

    var one = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0,
      events: [ 'foo', 'bar' ]
    };

    var two = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 1,
      events: [ 'foo', 'bar' ]
    };

    var query = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 2
    };

    eventStore.append(one, function () {
      eventStore.append(two, function () {
        eventStore.query(query, function (err, commits) {
          assert.deepEqual(err);
          assert.deepEqual(commits, []);
          done();
        });
      });
    });
  });

  it('ignores commits for other aggregates', function (done) {
    var eventStore = this.eventStore;

    var one = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0,
      events: [ 'foo', 'bar' ]
    };

    var two = {
      aggregateId: '11111111-1111-1111-1111-111111111111',
      version: 0,
      events: [ 'foo', 'bar' ]
    };

    var query = {
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 0
    };

    eventStore.append(one, function () {
      eventStore.append(two, function () {
        eventStore.query(query, function (err, commits) {
          assert.deepEqual(err);

          assert.deepEqual(commits, [
            {
              commitId: 1,
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 0,
              events: [ 'foo', 'bar' ]
            }
          ]);

          done();
        });
      });
    });
  });
});
