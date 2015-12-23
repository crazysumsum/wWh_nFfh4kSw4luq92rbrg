'use strict';

const co = require('co');
const Promise = require('bluebird');

const JobQ = require('./job_queue.js');
const PersistenceManager = require('./persistence_manager.js');
const CurrencyConverter = require('./currency_converter.js');

const MAX_SUCCESS = 10;
const MAX_FAIL = 3;

const DELAY_SUCCESS = 60;
const DELAY_FAIL = 3;

/**
 * Job Queue Config
 * @typedef {object} JobQueueConfig
 *
 * @property {string} [host] - address of the Job Queue Server
 * @property {number} [port] - port of the Job Queue Server
 * @property {string} [tube] - tube to be listened
*/

/**
 * Persistence Manager Config
 * @typedef	{object} PersistenceManagerConfig
 *
 * @property	{string} [uri] - uri of the database
 * @property {string} [username] - database username
 * @property {string} [password] - database password
*/

/**
 * Currency Converter Config
 * @typedef	{object}	CurrencyConverterConfig
 *
 * @property {string} [host] - address of the currency convert service provider
 * @property {string} [path] - path to the currency convert service
*/

/**
 *Consumer Worker Config
 * @typedef {object} ConsumerWorkerConfig
 *
 * @property	{JobQueueConfig} [job_queue] - Job Queue Config
 * @property {PersistenceManagerConfig} [persistence] - Persistence Manager Config
 * @property {CurrencyConverterConfig} [converter] - Currency Converter Config
*/

/**
 * Job
 * @typedef {object} Job
 *
 * @property {string} [job_id] - Job ID
 * @property {string} [task_id] - Task ID
 * @property {string} [from] - Convert from (Currency Code)
 * @property {string} [to] - Convert to (Currency Code)
 * @property {number} [success] - Get exchange rate success counter
 * @property {number} [fail] - Get exchange rate fail counter
 * @property {number} [delay] - re-put job delay setting in sec
 */

/**
 * Create a new Consumer Worker to reserve
 * and finish the currency conversion job from job queue
 * @class
 */
class ConsumerWorker {

	/**
	 * Create a new Consumer Worker
	 * @param {number} [worker_id] - Consumer Worker ID
	 * @param {ConsumerWorkerConfig} [config] - Consumer Worker Config
	 * @constructor
	 */
	constructor(worker_id, config) {
		this.params = {};
		this.params.config = config;
		this.worker_id = worker_id;

		this.is_ready = false;

		this.jq = new JobQ(
			this.params.config.job_queue.host,
			this.params.config.job_queue.port,
			this.params.config.job_queue.tube
		);

		this.pm = new PersistenceManager(
			this.params.config.persistence.uri,
			this.params.config.persistence.username,
			this.params.config.persistence.password
		);

		this.cc = new CurrencyConverter(
			this.params.config.converter.host,
			this.params.config.converter.path
		);
	}

	/**
	 * Initialize the consumer worker - connect to job queue server and database server
	 * @return {Promise<Boolean,Error>} A promise to initialize, return true if success
	 */
	init() {
		let self = this;
		return new Promise(function (resolve, reject) {
			/*
			 * [1] Worker is not yet initialized, conduct the initialization
       *     and set is_ready flag
			 * [2] Worker is initialized, skip the initialization
			 */
			if (self.is_ready === false) {
				// [1]
				self.log('Initializing job queue and database connection');
				co(function*() {
					yield [
						//	init job queue
						self.jq.init(),
						// init database
						self.pm.init()
					];

					self.is_ready = true;
					self.log('Ready');
					resolve(true);
				}).catch(function (err) {
					reject(err);
				});
			} else {
				//	[2]
				resolve(true);
			}
		});
	}

	/**
	 * Destroy the consumer worker - close database connection
	 */
	destroy() {
		let self = this;

		if (self.pm !== null) {
			self.pm.destroy();
		}

		self.log('Destroyed');
	}

	/**
	 * Reserve Job from job queue, will not return untill a job is reserved
	 * @return {Promise<Job,Error>} A promise to reserve a job
	 */
	reserveJob() {
		let self = this;
		return new Promise(function (resolve, reject) {
			co(function*() {
				//	Reserve job from job queue;
				let job = yield self.jq.reserveBsJob();
				let retObj = {};

				retObj.job_id = job.job_id;
				retObj.task_id = job.payload.task_id;
				retObj.from = job.payload.from;
				retObj.to = job.payload.to;
				retObj.success = (!job.payload.hasOwnProperty('success') ? 0 : parseInt(job.payload.success, 10));
				retObj.fail = (!job.payload.hasOwnProperty('fail') ? 0 : parseInt(job.payload.fail, 10));
				retObj.delay = 0;

				self.log('Job Reserved (Task ID:' + retObj.task_id + ', From:' + retObj.from + ', To:' + retObj.to + ')');
				resolve(retObj);
			}).catch(function (err) {
				reject(err);
			});
		});
	}

	/**
	 * Delete the job when the job is finished
	 * @param {Job} [job] - Job to be finished
	 * @return {Promise<Boolean,Error>} A promise to finish the job
	 */
	finishJob(job) {
		let self = this;
		return new Promise(function (resolve, reject) {
			/*
			 * [1] Get exchange rate success count exceed the threshold value,
			 *     delete the job from queue (Task completed) and return ture
       * [2] Get exchange rate success count less than the threshold value,
			 * 	   do nothing and return false
       */
			if (job.success >= MAX_SUCCESS) {
				//	[1]
				co(function* () {
					yield self.jq.destroyBsJob(job.job_id);
					self.log('Task Finished (Task ID: ' + job.task_id + ')');
					resolve(true);
				}).catch(function (err) {
					reject(err);
				});
			} else {
				// [2]
				resolve(false);
			}
		});
	}

	/**
	 * Bury the job when job fail count exceed the fail threshold
   * @param {Job} [job] - Job to be buired
   * @return {Promise<Boolean,Error>} A promise to bury the job
   */
	buryJob(job) {
		let self = this;
		return new Promise(function (resolve, reject) {
			/**
       * [1] Get exchange rate fail count exceed the threshold value,
			 *     bury the job (Task Buired) and return true
			 * [2] Get exchange rate fail count less than threshold value,
       *     do nothing and return false
	     */
			if (job.fail >= MAX_FAIL) {
				// [1]
				co(function* () {
					//	Bury job
					yield self.jq.buryBsJob(job.job_id);
					self.log('Task Buried (Task ID: ' + job.task_id + ')');
					resolve(true);
				}).catch(function (err) {
					reject(err);
				});
			} else {
				//	[2]
				resolve(false);
			}
		});
	}

	/**
   * Delete job from queue and re-put it back to queue
   * with new success count, fail count and delay setting
	 * @param {Job} [job] - job to be re-put
   * @return {Promise<number,Error>} A promise to re-put job
   */
	reputJob(job) {
		let self = this;
		return new Promise(function (resolve, reject) {
			co(function*() {
				// Delete the old job
				yield self.jq.destroyBsJob(job.job_id);
				// re-put the new job to queue
				let job_id = yield self.jq.reputBsJob(job.task_id, job.delay, job.from, job.to, job.success, job.fail);
				// return the job id of new job
				resolve(job_id);
			}).catch(function (err) {
				reject(err);
			});
		});
	}

  /**
   * Get exchange from service provider, save it to database and update the job status
   * @param {Job} [job] - Target job
   * @return {Promise<Job,Error>} A promise to get exchange rate
   */
	getExchangeRate(job) {
		let self = this;
		let rate = '0.00';
		let doc = {};
		return new Promise(function (resolve, reject) {
			co(function* () {
				try {
					//	Get exchange rate from service provider
					rate = yield self.cc.getExRate(job.from, job.to);
					//	Save the rate to database
					doc = yield self.pm.saveExRate(job.task_id, job.from, job.to, rate);

					//	Get rate success
					job.success ++;
					job.delay = DELAY_SUCCESS;
					job.doc = doc;
					self.log('Get Exchange Rate Success (Task ID:' + job.task_id + ', From:' + job.from + ', To:' + job.to + ', Rate: ' + rate + ')');
				} catch (err) {
					//	Get rate fail
					job.fail ++;
					job.delay = DELAY_FAIL;
					self.log('Get Exchange Rate Fail (Task ID:' + job.task_id + ', Detail:' + err);
				}

				if (job.success >= MAX_SUCCESS || job.fail >= MAX_FAIL) {
					job.delay = 0;
				}

				//	return the updated job
				resolve(job);
			}).catch(function (err) {
				reject(err);
			});
		});
	}

	/**
   * Consumer Worker main loop to listening the job queue (infinite loop)
   */
	run() {
		let self = this;
		co(function*() {
			//	init worker;
			yield self.init();

			self.log('Listening');

			//	reserve job from queue
			let job = yield self.reserveJob();

			//	destroy job when success count >= max success count (10)
			let is_finished = yield self.finishJob(job);
			if (is_finished === true) {
				self.run();
				return;
			}

			//	bury job when fail count >= max fail count (3)
			let is_buried = yield self.buryJob(job);
			if (is_buried === true) {
				self.run();
				return;
			}

			//	get exchange rate and upate job status;
			job = yield self.getExchangeRate(job);

			// re-put job to the job queue;
			yield self.reputJob(job);

			//	recursive call
			self.run();
		}).catch(function (err) {
			self.log(err);
			self.destroy();
			process.exit(-1);
		});
	}

	/**
   * Log message to the console when debug mode is on
	 * @param {string} [msg] - Message to be logged
   */
	log(msg) {
		let self = this;
		if (self.params.config.mode === 'debug') {
			console.log('Worker ' + self.worker_id + ': ' + msg);
		}
	}

}

module.exports = ConsumerWorker;
