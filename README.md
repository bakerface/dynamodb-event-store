# dynamodb-event-store
[![npm](https://img.shields.io/npm/v/dynamodb-event-store.svg?flat-square)](https://npmjs.com/package/dynamodb-event-store)
[![downloads](https://img.shields.io/npm/dm/dynamodb-event-store.svg?flat-square)](https://npmjs.com/package/dynamodb-event-store)

``` javascript
var EventStore = require('dynamodb-event-store');

var eventStore = new EventStore({
  region: 'us-east-1',
  accessKeyId: 'access-key-id',
  secretAccessKey: 'secret-access-key',
  commitTableName: 'commits',
  commitIndexName: 'byId',
  counterTableName: 'counters'
});
```

### eventStore.append(commit, callback)
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

eventStore.append(commit, function (err) {
  // the events were committed to the event store
});
```

### eventStore.query(options, callback)
Fetches commits for a single aggregate starting at the specified version.

``` javascript
var options = {
  aggregateId: '00000000-0000-0000-0000-000000000000',
  version: 0
};

eventStore.query(options, function (err, commits) {
  console.log(commits);

  // =>
  [
    {
      commitId: 1,
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
      commitId: 2,
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
});
```

### eventStore.scan(options, callback)
Fetches commits for all aggregates starting at the specified commit id.

``` javascript
var options = {
  commitId: 0
};

eventStore.scan(options, function (err, commits) {
  console.log(commits);

  // =>
  [
    {
      commitId: 1,
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
      commitId: 2,
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
      commitId: 3,
      committedAt: 946684800002, 
      aggregateId: '00000000-0000-0000-0000-000000000000',
      version: 1,
      events: [
        {
          type: 'accountDeleted'
        }
      ]
    }
  ]
});
```
