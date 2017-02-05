# dynamodb-event-store
[![build](https://img.shields.io/travis/bakerface/dynamodb-event-store.svg?flat-square)](https://travis-ci.org/bakerface/dynamodb-event-store)
[![npm](https://img.shields.io/npm/v/dynamodb-event-store.svg?flat-square)](https://npmjs.com/package/dynamodb-event-store)
[![downloads](https://img.shields.io/npm/dm/dynamodb-event-store.svg?flat-square)](https://npmjs.com/package/dynamodb-event-store)
[![climate](https://img.shields.io/codeclimate/github/bakerface/dynamodb-event-store.svg?flat-square)](https://codeclimate.com/github/bakerface/dynamodb-event-store)
[![coverage](https://img.shields.io/codeclimate/coverage/github/bakerface/dynamodb-event-store.svg?flat-square)](https://codeclimate.com/github/bakerface/dynamodb-event-store)

This package provides a simple event store implementation on top of Amazon
DynamoDB. This is meant to be a general purpose package, and makes no
assumptions about the structure or type of your events. Events are serialized to
JSON when stored, and deserialized automatically when querying. Events that
happen at the same time are grouped into a commit, providing an atomic append
operation. This guarantees that either all events are made durable, or none of
them are. For a few examples, view the samples below:

``` javascript
var EventStore = require('dynamodb-event-store');

var eventStore = new EventStore({
  region: 'us-east-1',
  accessKeyId: 'access-key-id',
  secretAccessKey: 'secret-access-key',
  tableName: 'commitsByAggregateIdAndVersion',
  indexName: 'commitsByCommitId'
});
```

### eventStore.append(commit)
An atomic append of events to the event store.

``` javascript
var commit = {
  aggregateId: '00000000-0000-0000-0000-000000000000',
  version: 0,
  events: [
    {
      type: 'accountCreated',
      username: 'john',
      email: 'john@doe.com'
    },
    {
      type: 'profileEdited',
      name: 'John Doe',
      company: 'Doe, Inc.'
    }
  ]
};

eventStore.append(commit)
  .then(function () {
    // the events were committed to the event store
  })
  .catch(function (err) {
    // something went wrong

    if (err instanceof EventStore.VersionConflictError) {
      // a commit with that version and aggregateId already exists
      // most likely a concurrency issue
    }
  });
});
```

### eventStore.query(options)
Fetches commits for a single aggregate starting at the specified version.

``` javascript
var options = {
  aggregateId: '00000000-0000-0000-0000-000000000000',
  version: 0
};

eventStore.query(options)
  .then(function (commits) {
    // =>
    [
      {
        commitId: '20000101000000000:00000000-0000-0000-0000-000000000000',
        committedAt: 946684800000, 
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 0,
        events: [
          {
            type: 'accountCreated',
            username: 'john',
            email: 'john@doe.com'
          },
          {
            type: 'profileEdited',
            name: 'John Doe',
            company: 'Doe, Inc.'
          }
        ]
      },
      {
        commitId: '20000101000000001:00000000-0000-0000-0000-000000000000',
        committedAt: 946684800001, 
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 1,
        events: [
          {
            type: 'accountDeleted'
          }
        ]
      }
    ]
  })
  .catch(function (err) {
    // something went wrong
  });
```

### eventStore.scan([options])
Fetches commits for all aggregates starting at the specified commit id. If no
options are defined then start scanning from the beginning.

``` javascript
var options = {
  commitId: '20000101000000000:00000000-0000-0000-0000-000000000000'
};

eventStore.scan(options)
  .then(function (commits) {
    // =>
    [
      {
        commitId: '20000101000000000:00000000-0000-0000-0000-000000000000',
        committedAt: 946684800000, 
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 0,
        events: [
          {
            type: 'accountCreated',
            username: 'john',
            email: 'john@doe.com'
          },
          {
            type: 'profileEdited',
            name: 'John Doe',
            company: 'Doe, Inc.'
          }
        ]
      },
      {
        commitId: '20000101000000001:11111111-1111-1111-1111-111111111111',
        committedAt: 946684800001, 
        aggregateId: '11111111-1111-1111-1111-111111111111',
        version: 0,
        events: [
          {
            type: 'accountCreated',
            username: 'jane',
            email: 'jane@doe.com'
          },
          {
            type: 'profileEdited',
            name: 'Jane Doe',
            company: 'Doe, Inc.'
          }
        ]
      },
      {
        commitId: '20000101000000002:00000000-0000-0000-0000-000000000000',
        committedAt: 946684800002, 
        aggregateId: '00000000-0000-0000-0000-000000000000',
        version: 1,
        events: [
          {
            type: 'accountDeleted'
          }
        ]
      },
      {
        commitId: '20000101000000003:11111111-1111-1111-1111-111111111111',
        committedAt: 946684800003, 
        aggregateId: '11111111-1111-1111-1111-111111111111',
        version: 1,
        events: [
          {
            type: 'accountDeleted'
          }
        ]
      }
    ]
  })
  .catch(function (err) {
    // something went wrong
  });
```
