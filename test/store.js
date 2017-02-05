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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

describe('when the tables are created', function () {
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
      tableName: 'commitsByAggregateIdAndVersion',
      indexName: 'commitsByCommitId'
    });

    this.server.listen(4567, function () {
      eventStore.createTable()
        .then(function () {
          return sleep(10);
        })
        .then(done.bind(null, null), done);
    });
  });

  afterEach(function (done) {
    var server = this.server;
    var eventStore = this.eventStore;

    eventStore.deleteTable()
      .then(function () {
        return sleep(10);
      })
      .then(function () {
        server.close(done);
      });
  });

  describe('when events are appended to the store', function () {
    beforeEach(function () {
      var now = 0;

      var eventStore = new EventStore({
        endpoint: 'http://localhost:4567',
        region: 'us-east-1',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        tableName: 'commitsByAggregateIdAndVersion',
        indexName: 'commitsByCommitId',
        now: function () {
          return now++;
        }
      });

      var a = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 0,
        events: [ 'one', 'two' ]
      };

      var b = {
        aggregateId: '11111111-1111-1111-1111-111111111111',
        version: 0,
        events: [ 'three', 'four' ]
      };

      var c = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 1,
        events: [ 'five' ]
      };

      var d = {
        aggregateId: '11111111-1111-1111-1111-111111111111',
        version: 1,
        events: [ 'six' ]
      };

      return Promise.resolve()
        .then(function () {
          return eventStore.append(a);
        })
        .then(function () {
          return eventStore.append(b);
        })
        .then(function () {
          return eventStore.append(c);
        })
        .then(function () {
          return eventStore.append(d);
        });
    });

    it('can query the events for a single aggregate', function () {
      var options = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 0
      };

      return this.eventStore.query(options)
        .then(function (commits) {
          assert.deepEqual(commits, [
            {
              commitId: '19700101000000000:00000000-0000-0000-0000-000000000000',
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 0,
              events: [ 'one', 'two' ]
            },
            {
              commitId: '19700101000000002:00000000-0000-0000-0000-000000000000',
              committedAt: 2,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'five' ]
            }
          ]);
        });
    });

    it('can query in chunks', function () {
      var options = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 1
      };

      return this.eventStore.query(options)
        .then(function (commits) {
          assert.deepEqual(commits, [
            {
              commitId: '19700101000000002:00000000-0000-0000-0000-000000000000',
              committedAt: 2,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'five' ]
            }
          ]);
        });
    });

    it('can scan the events for all aggregates', function () {
      return this.eventStore.scan()
        .then(function (commits) {
          assert.deepEqual(commits, [
            {
              commitId: '19700101000000000:00000000-0000-0000-0000-000000000000',
              committedAt: 0,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 0,
              events: [ 'one', 'two' ]
            },
            {
              commitId: '19700101000000001:11111111-1111-1111-1111-111111111111',
              committedAt: 1,
              aggregateId: '11111111-1111-1111-1111-111111111111',
              version: 0,
              events: [ 'three', 'four' ]
            },
            {
              commitId: '19700101000000002:00000000-0000-0000-0000-000000000000',
              committedAt: 2,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'five' ]
            },
            {
              commitId: '19700101000000003:11111111-1111-1111-1111-111111111111',
              committedAt: 3,
              aggregateId: '11111111-1111-1111-1111-111111111111',
              version: 1,
              events: [ 'six' ]
            }
          ]);
        });
    });

    it('can scan in chunks', function () {
      var options = {
        commitId: '19700101000000002:00000000-0000-0000-0000-000000000000'
      };

      return this.eventStore.scan(options)
        .then(function (commits) {
          assert.deepEqual(commits, [
            {
              commitId: '19700101000000002:00000000-0000-0000-0000-000000000000',
              committedAt: 2,
              aggregateId: '00000000-0000-0000-0000-000000000000',
              version: 1,
              events: [ 'five' ]
            },
            {
              commitId: '19700101000000003:11111111-1111-1111-1111-111111111111',
              committedAt: 3,
              aggregateId: '11111111-1111-1111-1111-111111111111',
              version: 1,
              events: [ 'six' ]
            }
          ]);
        });
    });

    it('can handle version conflicts', function () {
      var commit = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 0,
        events: [ 'seven' ]
      };

      return this.eventStore.append(commit)
        .then(function () {
          throw new Error('The promise should have been rejected');
        })
        .catch(function (err) {
          assert.deepEqual(err.name, 'EventStoreVersionConflictError');
        });
    });

    it('can handle append errors', function () {
      var commit = {
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 'error',
        events: [ 'seven' ]
      };

      return this.eventStore.append(commit)
        .then(function () {
          throw new Error('The promise should have been rejected');
        })
        .catch(function (err) {
          assert.deepEqual(err.name, 'ValidationException');
        });
    });
  });
});
