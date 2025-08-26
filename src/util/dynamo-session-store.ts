// Adapted from https://github.com/rafaelrpinto/dynamodb-store
/*
MIT License

Copyright (c) 2017 Rafael Pinto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* eslint-disable no-console */
import { CreateTableInput, DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { SessionData, Store } from 'express-session';

// defaults
export const DEFAULT_TABLE_NAME: string = 'sessions';
export const DEFAULT_HASH_KEY: string = 'sessionId';
export const DEFAULT_HASH_PREFIX: string = 'sess:';
export const DEFAULT_RCU: number = 5;
export const DEFAULT_WCU: number = 5;
export const DEFAULT_TTL: number = 86400000; // 1 day
export const DEFAULT_TOUCH_INTERVAL: number = 30000; // 30 seconds
export const DEFAULT_KEEP_EXPIRED_POLICY: boolean = false;
export const DEFAULT_CALLBACK = (err?: Error) => {
  if (err) {
    throw err;
  }
};

/**
 * Transforms a date t seconds epoch.
 * @param  {Date} date The date to be converted.
 * @return {Integer}      Representation of the date in seconds epoch.
 */
export function toSecondsEpoch(date: Date): number {
  if (!(date instanceof Date)) {
    throw new Error(`${date} is not a Date!`);
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Logs messages when debug is enabled.
 * @param  {String} message Message to be debugged.
 * @param  {Object} object  Optional param that will be strigified.
 */
export function debug(message: string, object?: any): void {
  if (process.env.DYNAMODB_STORE_DEBUG) {
    const argument = object || '';

    console.log(
      `${new Date().toString()} - DYNAMODB_STORE: ${message}`,
      typeof argument === 'object' ? JSON.stringify(argument) : argument,
    );
  }
}

/**
 * Checks if an expiration date has passed.
 * @param {number} expiresOn Optiona expiration date on second epoch.
 */
export function isExpired(expiresOn?: number): boolean {
  return !expiresOn || expiresOn <= toSecondsEpoch(new Date());
}

export interface Table {
  name: string;
  hashPrefix: string;
  hashKey: string;
  readCapacityUnits: number;
  writeCapacityUnits: number;
}

export interface Options {
  table: Table;
  touchInterval: number;
  ttl: number;
  keepExpired: boolean;
  dynamoService: DynamoDB;
  documentClient: DynamoDBDocument;
}

interface MySessionData extends SessionData {
  updated?: number;
}

/**
 * Express.js session store for DynamoDB.
 */
export default class DynamoDBStore extends Store {
  dynamoService: DynamoDB;
  documentClient: DynamoDBDocument;
  tableName: any;
  hashPrefix: any;
  hashKey: any;
  readCapacityUnits!: number;
  writeCapacityUnits!: number;
  touchInterval: any;
  ttl: any;
  keepExpired: any;

  /**
   * Constructor.
   * @param  {Object} options                Store
   * @param  {Function} callback Optional callback for table creation.
   */
  constructor(options?: Options, callback?: (err?: Error) => void) {
    super();
    debug('Initializing store', options);

    this.setOptionsAsInstanceAttributes(options);

    if (!options?.dynamoService) {
      throw new Error('dynamoService required');
    }
    if (!options?.documentClient) {
      throw new Error('dynamoService required');
    }

    // dynamodb client configuration
    this.dynamoService = options?.dynamoService;
    this.documentClient = options?.documentClient;

    // creates the table if necessary
    this.createTableIfDontExists(callback || DEFAULT_CALLBACK);
  }

  /**
   * Saves the informed store options as instance attributes.
   * @param {Options} options Store options.
   */
  setOptionsAsInstanceAttributes(options?: Options): void {
    const {
      table,
      touchInterval = DEFAULT_TOUCH_INTERVAL,
      ttl = DEFAULT_TTL,
      keepExpired = DEFAULT_KEEP_EXPIRED_POLICY,
    } = options || ({} as Options);

    const {
      name = DEFAULT_TABLE_NAME,
      hashKey = DEFAULT_HASH_KEY,
      hashPrefix = DEFAULT_HASH_PREFIX,
      readCapacityUnits = DEFAULT_RCU,
      writeCapacityUnits = DEFAULT_WCU,
    } = table;

    this.tableName = name;
    this.hashPrefix = hashPrefix;
    this.hashKey = hashKey;
    this.readCapacityUnits = Number(readCapacityUnits);
    this.writeCapacityUnits = Number(writeCapacityUnits);

    this.touchInterval = touchInterval;
    this.ttl = ttl;
    this.keepExpired = keepExpired;
  }

  /**
   * Checks if the sessions table already exists.
   */
  async isTableCreated(): Promise<boolean> {
    try {
      // attempt to get details from a table
      await this.dynamoService.describeTable({
        TableName: this.tableName,
      });
      return true;
    } catch {
      // Table does not exist
      // There is no error code on AWS error that we could match
      // so its safer to assume the error is because the table does not exist than
      // trying to match the message that could change
      return false;
    }
  }

  /**
   * Creates the session table.
   */
  async createTable() {
    const params: CreateTableInput = {
      TableName: this.tableName,
      KeySchema: [{ AttributeName: this.hashKey, KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: this.hashKey, AttributeType: 'S' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: this.readCapacityUnits,
        WriteCapacityUnits: this.writeCapacityUnits,
      },
    };
    await this.dynamoService.createTable(params);
  }

  /**
   * Creates the session table. Does nothing if it already exists.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async createTableIfDontExists(callback: (err?: Error) => void): Promise<void> {
    try {
      const exists = await this.isTableCreated();

      if (exists) {
        debug(`Table ${this.tableName} already exists`);
      } else {
        debug(`Creating table ${this.tableName}...`);
        await this.createTable();
      }

      callback();
    } catch (createTableError) {
      debug(`Error creating table ${this.tableName}`, createTableError);
      if (createTableError instanceof Error) {
        callback(createTableError);
      }
    }
  }

  /**
   * Stores a session.
   * @param  {String}   sid      Session ID.
   * @param  {Object}   sess     The session object.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  set(sid: string, sess: MySessionData, callback: (err?: any) => void): void {
    try {
      const sessionId = this.getSessionId(sid);
      const expires = this.getExpirationDate(sess);
      const params = {
        TableName: this.tableName,
        Item: {
          [this.hashKey]: sessionId,
          expires: toSecondsEpoch(expires),
          sess: {
            ...sess,
            updated: Date.now(),
          },
        },
      };
      debug(`Saving session '${sid}'`, sess);
      this.documentClient.put(params, callback);
    } catch (err) {
      debug('Error saving session', {
        sid,
        sess,
        err,
      });
      callback(err);
    }
  }

  /**
   * Retrieves a session from dynamo.
   * @param  {String}   sid      Session ID.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async get(sid: string, callback: (err: any, session?: MySessionData | null) => void): Promise<void> {
    try {
      const sessionId = this.getSessionId(sid);
      const params = {
        TableName: this.tableName,
        Key: {
          [this.hashKey]: sessionId,
        },
        ConsistentRead: true,
      };

      const { Item: record } = await this.documentClient.get(params);

      if (!record) {
        debug(`Session '${sid}' not found`);
        callback(null, null);
      } else if (isExpired(record.expires)) {
        this.handleExpiredSession(sid, callback);
      } else {
        debug(`Session '${sid}' found`, record.sess);
        callback(null, record.sess);
      }
    } catch (err) {
      debug(`Error getting session '${sid}'`, err);
      callback(err);
    }
  }

  /**
   * Deletes a session from dynamo.
   * @param  {String}   sid      Session ID.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async destroy(sid: string, callback: (err?: any) => void): Promise<void> {
    try {
      const sessionId = this.getSessionId(sid);
      const params = {
        TableName: this.tableName,
        Key: {
          [this.hashKey]: sessionId,
        },
      };
      await this.documentClient.delete(params);
      debug(`Destroyed session '${sid}'`);
      callback(null);
    } catch (err) {
      debug(`Error destroying session '${sid}'`, err);
      callback(err);
    }
  }

  /**
   * Updates the expiration time of an existing session.
   * @param  {String}   sid      Session ID.
   * @param  {Object}   sess     The session object.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  touch(sid: string, sess: MySessionData, callback: (err?: Error) => void): void {
    try {
      if (!sess.updated || Number(sess.updated) + this.touchInterval <= Date.now()) {
        const sessionId = this.getSessionId(sid);
        const expires = this.getExpirationDate(sess);
        const params: UpdateCommandInput = {
          TableName: this.tableName,
          Key: {
            [this.hashKey]: sessionId,
          },

          UpdateExpression: 'set expires = :e, sess.#up = :n',
          ExpressionAttributeNames: {
            '#up': 'updated',
          },
          ExpressionAttributeValues: {
            ':e': toSecondsEpoch(expires),
            ':n': Date.now(),
          },
          ReturnValues: 'UPDATED_NEW',
        };
        debug(`Touching session '${sid}'`);
        this.documentClient.update(params, callback);
      } else {
        debug(`Skipping touch of session '${sid}'`);
        callback();
      }
    } catch (err) {
      debug(`Error touching session '${sid}'`, err);
      if (err instanceof Error) {
        callback(err);
      }
    }
  }

  /**
   * Handles get requests that found expired sessions.
   * @param  {String} sid Original session id.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async handleExpiredSession(sid: string, callback: (err: any, session?: MySessionData | null) => void): Promise<void> {
    debug(`Found session '${sid}' but it is expired`);
    if (this.keepExpired) {
      callback(null, null);
    } else {
      this.destroy(sid, callback);
    }
  }

  /**
   * Builds the session ID foe storage.
   * @param  {String} sid Original session id.
   * @return {String}     Prefix + original session id.
   */
  getSessionId(sid: string): string {
    return `${this.hashPrefix}${sid}`;
  }

  /**
   * Calculates the session expiration date.
   * @param  {Object} sess The session object.
   * @return {Date}      the session expiration date.
   */
  getExpirationDate(sess: MySessionData): Date {
    let expirationDate = Date.now();
    if (this.ttl !== undefined) {
      expirationDate += this.ttl;
    } else if (sess.cookie && Number.isInteger(sess.cookie.maxAge)) {
      expirationDate += sess.cookie.maxAge!;
    } else {
      expirationDate += DEFAULT_TTL;
    }
    return new Date(expirationDate);
  }
}
