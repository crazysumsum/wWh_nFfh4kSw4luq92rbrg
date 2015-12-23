'use strict';

const co = require('co');
const mongo = require('mongodb');
const Promise = require('bluebird');

const MAX_TRIES_INSERT = 5;

/**
 * Create a new Persistence Manager to save the exchange rate
 * @class
 */
class PersistenceManager {

	/**
	 * Create a new Persistence Manager
	 * @param {string} [uri] - uri of the database
	 * @param {string} [username] - database username
	 * @param {string} [password] - database password
	 * @constructor
	 */
	constructor(uri, username, password) {
		this.mg_client = null;
		this.fail_count_insert = 0;
		this.uri = uri;
		this.username = username;
		this.password = password;
	}

	/**
	 * Initialize the Persistence Manager - connect to database server
	 * @return {Promise<Boolean,Error>} A promise to initialize, return true if success
	 */
	init() {
		let self = this;
		return new Promise(function (resolve, reject) {
			co(function*() {
				self.mg_client = yield self.connectToMongo(self.uri, self.username, self.password);
				resolve(true);
			}).catch(function (err) {
				reject(err);
			});
		});
	}

	/**
	 * Destroy the Persistence Manager - close database connection
	 */
	destroy() {
		let self = this;
		self.closeMongoConnection();
	}

	/**
	 * Connect to MongoDB server
   * @param {string} [uri] - uri of the database
   * @param {string} [username] - database username
   * @param {string} [password] - database password
   * @return {Promise<MongoDB,Error>} A promise to connect MongoDB, return the MongoDB Object if success
	 */
	connectToMongo(uri, username, password) {
		let client = mongo.MongoClient;

		return new Promise(function (resolve, reject) {
			client.connect('mongodb://' + username + ':' + password + '@' + uri, function (err, db) {
				if (err !== null) {
					reject(new Error('Connect to MongoDB Error'));
				} else {
					resolve(db);
				}
			});
		});
	}

	/**
	 * Close MongoDB connection
	 */
	closeMongoConnection() {
		let self = this;

		if (self.mg_client !== null) {
			self.mg_client.close();
		}
	}

	/**
	 * Save the exchnage rate to database
   * @param {number} [task_id] - Task ID of the job
   * @param {string} [from] - Convert from (Currency Code)
   * @param {String} [to] - Convert to (Currency Code)
	 * @param {string} [rate] - Exchange rate
   * @return {Promise<Boolean,Error>} A promise to save the rate, return true if success
	 */
	saveExRate(task_id, from, to, rate) {
		let self = this;
		//	the document to be insert to database
		let doc = {
			task_id: task_id,
			from: from,
			to: to,
			create_at: new Date(),
			rate: rate
		};

		return new Promise(function (resolve, reject) {
			self.mg_client.collection('exchange_rate').insert(doc, function (err, result) {
				if (err !== null) {
					if (self.fail_count_insert >= MAX_TRIES_INSERT) {
						//	insert fail and tries exceeded the threshold, return error
						self.fail_count_insert = 0;
						reject(new Error('Save Exchange Rate Error'));
					} else {
						//	insert fail but tries less than threshold, retry
						self.fail_count_insert++;
						self.saveExRate(task_id, from, to, rate);
					}
				} else {
					//	Save exchange rate success
					resolve(result);
				}
			});
		});
	}

	/**
	 * Remove the exchnage rate from database
   * @param {string} [obj_id] - Object ID of target MongoDB document
   * @return {Promise<Boolean,Error>} A promise to remove the rate, return true if success
	 */
	removeRate(obj_id) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.mg_client.collection('exchange_rate').deleteOne(
				{_id: new mongo.ObjectID(obj_id)},
				function (err, result) {
					if (err !== null) {
						reject(new Error('Remove Rate Error'));
					} else {
						resolve(result);
					}
				}
			);
		});
	}

}

module.exports = PersistenceManager;
