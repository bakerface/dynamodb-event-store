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

var AWS = require('aws-sdk');

var EventStore = module.exports = function (options) {
  this.commitTableName = options.commitTableName;
  this.commitIndexName = options.commitIndexName;
  this.counterTableName = options.counterTableName;
  this.database = new AWS.DynamoDB(options);
  this.now = options.now || Date.now;
};

EventStore.prototype.createCommitTable = function (done) {
  var params = {
    TableName: this.commitTableName,
    AttributeDefinitions: [
      {
        AttributeName: 'aggregateId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'commitId',
        AttributeType: 'N'
      },
      {
        AttributeName: 'active',
        AttributeType: 'S'
      },
      {
        AttributeName: 'version',
        AttributeType: 'N'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'aggregateId',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'version',
        KeyType: 'RANGE'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 15,
      WriteCapacityUnits: 15
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: this.commitIndexName,
        KeySchema: [
          {
            AttributeName: 'active',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'commitId',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 15,
          WriteCapacityUnits: 15
        }
      }
    ]
  };

  this.database.createTable(params, done);
};

EventStore.prototype.createCounterTable = function (done) {
  var params = {
    TableName: this.counterTableName,
    AttributeDefinitions: [
      {
        AttributeName: 'name',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'name',
        KeyType: 'HASH'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 15,
      WriteCapacityUnits: 15
    }
  };

  this.database.createTable(params, done);
};

EventStore.prototype.deleteCommitTable = function (done) {
  var params = {
    TableName: this.commitTableName
  };

  this.database.deleteTable(params, done);
};

EventStore.prototype.deleteCounterTable = function (done) {
  var params = {
    TableName: this.counterTableName
  };

  this.database.deleteTable(params, done);
};

EventStore.prototype.append = function (commit, done) {
  var eventStore = this;

  var params = {
    TableName: this.counterTableName,
    Key: {
      name: { S: 'commits' }
    },
    UpdateExpression: 'add id :n',
    ExpressionAttributeValues: {
      ':n': { N: '1' }
    },
    ReturnValues: 'ALL_NEW'
  };

  this.database.updateItem(params, function (err, response) {
    if (err) {
      return done(err);
    }

    params = {
      TableName: eventStore.commitTableName,
      Item: {
        commitId: response.Attributes.id,
        committedAt: { N: eventStore.now().toString() },
        aggregateId: { S: commit.aggregateId },
        version: { N: commit.version.toString() },
        events: { S: JSON.stringify(commit.events) },
        active: { S: 't' }
      },
      ConditionExpression: 'attribute_not_exists(version)',
      ReturnValues: 'NONE'
    };

    eventStore.database.putItem(params, done);
  });
};

EventStore.prototype._query = function (params, done) {
  this.database.query(params, function (err, response) {
    if (err) {
      return done(err);
    }

    var commits = response.Items
      .map(function (item) {
        return {
          commitId: parseInt(item.commitId.N, 10),
          committedAt: parseInt(item.committedAt.N, 10),
          aggregateId: item.aggregateId.S,
          version: parseInt(item.version.N, 10),
          events: JSON.parse(item.events.S)
        };
      });

    done(null, commits);
  });
};

EventStore.prototype.query = function (options, done) {
  var params = {
    TableName: this.commitTableName,
    ConsistentRead: true,
    KeyConditionExpression: 'aggregateId = :a AND version >= :v',
    ExpressionAttributeValues: {
      ':a': { S: options.aggregateId },
      ':v': { N: options.version.toString() }
    }
  };

  this._query(params, done);
};

EventStore.prototype.scan = function (options, done) {
  var params = {
    TableName: this.commitTableName,
    IndexName: this.commitIndexName,
    KeyConditionExpression: 'active = :a AND commitId >= :c',
    ExpressionAttributeValues: {
      ':a': { S: 't' },
      ':c': { N: options.commitId.toString() }
    }
  };

  this._query(params, done);
};
