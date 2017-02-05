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
  this.tableName = options.tableName;
  this.indexName = options.indexName;
  this.database = new AWS.DynamoDB(options);
  this.now = options.now || Date.now;
};

EventStore.AWS = AWS;

EventStore.VersionConflictError = function () {
  Error.call(this);
  this.name = 'EventStoreVersionConflictError';
  this.message = 'A commit already exists with the specified version';
  Error.captureStackTrace(this, this.constructor);
};

EventStore.prototype.createTable = function () {
  var params = {
    TableName: this.tableName,
    AttributeDefinitions: [
      {
        AttributeName: 'aggregateId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'commitId',
        AttributeType: 'S'
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
        IndexName: this.indexName,
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

  return this.database.createTable(params).promise();
};

EventStore.prototype.deleteTable = function () {
  var params = {
    TableName: this.tableName
  };

  return this.database.deleteTable(params).promise();
};

EventStore.prototype.append = function (commit) {
  var now = this.now();
  var date = new Date(now).toISOString().replace(/[^0-9]/g, '');
  var commitId = date + ':' + commit.aggregateId;

  var params = {
    TableName: this.tableName,
    Item: {
      commitId: { S: commitId },
      committedAt: { N: now.toString() },
      aggregateId: { S: commit.aggregateId },
      version: { N: commit.version.toString() },
      events: { S: JSON.stringify(commit.events) },
      active: { S: 't' }
    },
    ConditionExpression: 'attribute_not_exists(version)',
    ReturnValues: 'NONE'
  };

  return this.database.putItem(params).promise()
    .catch(function (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        throw new EventStore.VersionConflictError();
      }

      throw err;
    });
};

EventStore.prototype._query = function (params) {
  return this.database.query(params).promise()
    .then(function (response) {
      return response.Items
        .map(function (item) {
          return {
            commitId: item.commitId.S,
            committedAt: parseInt(item.committedAt.N, 10),
            aggregateId: item.aggregateId.S,
            version: parseInt(item.version.N, 10),
            events: JSON.parse(item.events.S)
          };
        });
    });
};

EventStore.prototype.query = function (options) {
  var params = {
    TableName: this.tableName,
    ConsistentRead: true,
    KeyConditionExpression: 'aggregateId = :a AND version >= :v',
    ExpressionAttributeValues: {
      ':a': { S: options.aggregateId },
      ':v': { N: options.version.toString() }
    }
  };

  return this._query(params);
};

EventStore.prototype.scan = function (options) {
  var commitId = (options && options.commitId) || '0';

  var params = {
    TableName: this.tableName,
    IndexName: this.indexName,
    KeyConditionExpression: 'active = :a AND commitId >= :c',
    ExpressionAttributeValues: {
      ':a': { S: 't' },
      ':c': { S: commitId }
    }
  };

  return this._query(params);
};
