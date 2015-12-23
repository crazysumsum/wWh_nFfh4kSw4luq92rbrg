'use strict';

const fivebeans = require('fivebeans');
const co = require('co');
const Promise = require('bluebird');

const MAX_TRIES_REPUT = 5;
const MAX_TRIES_DESTROY = 5;
const MAX_TRIES_BURY = 5;

/**
 * Job
 * @typedef {object} Job
 *
 * @property {string} [job_id] - Job ID
 * @property {object} [payload] - Job payload
 */

/**
 * Create a new JobQ to access the job queue
 * @class
 */
class JobQ {

	/**
	 * Create a new JobQ
	 * @param {string} [host] - address of the Job Queue Server
	 * @param {number} [port] - port of the Job Queue Server
	 * @param {string} [tube] - tube to be listened
	 * @constructor
	 */
	constructor(host, port, tube) {
		this.bs_client = null;

		this.fail_count_reput = 0;
		this.fail_count_destroy = 0;
		this.fail_count_bury = 0;

		this.host = host;
		this.port = port;
		this.tube = tube;
	}

	/**
	 * Initialize the JobQ - connect to Job Queue server
	 * @return {Promise<Boolean,Error>} A promise to initialize, return true if success
	 */
	init() {
		let self = this;
		return new Promise(function (resolve, reject) {
			co(function*() {
				self.bs_client = yield self.connectToBs(self.host, self.port);
				yield self.watchTube(self.tube);
				yield self.useTube(self.tube);
				yield self.ignoreTube('default');
				resolve(true);
			}).catch(function (err) {
				reject(err);
			});
		});
	}

	/**
	 * Connect to Beanstalkd server
   * @param {string} [host] - address of the Beanstalkd Server
   * @param {number} [port] - port of the Beanstalkd Server
   * @return {Promise<BeanstalkdClient,Error>} A promise to connect Beanstalkd,
  *          return the Beanstalkd Client Object if success
	 */
	connectToBs(host, port) {
		let client = new fivebeans.client(host, port);

		return new Promise(function (resolve, reject) {
			client.on('connect', function () {
				resolve(client);
			});

			client.on('error', function () {
				reject(new Error('Connect to BS Error'));
			});

			client.on('close', function () {
				reject(new Error('BS Connection Closed'));
			});
			client.connect();
		});
	}

	/**
	 * Ignore the named tube
   * @param {string} [tube] - tube to be ignore
   * @return {Promise<Boolean,Error>} A promise to ignore tube, return true if success
	 */
	ignoreTube(tube) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.ignore(tube, function (err, numwatched) {
				if (err !== null) {
					reject(new Error('Ignore BS Tube Error'));
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Watch the named tube
   * @param {string} [tube] - tube to be watch
   * @return {Promise<Boolean,Error>} A promise to watch tube, return true if success
	 */
	watchTube(tube) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.watch(tube, function (err, numwatched) {
				if (err !== null) {
					reject(new Error('Watch BS Tube Error'));
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Use the named tube
   * @param {string} [tube] - tube to be use
   * @return {Promise<Boolean,Error>} A promise to use tube, return true if success
	 */
	useTube(tube) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.use(tube, function (err, tubename) {
				if (err !== null) {
					reject(new Error('Use BS Tube Error'));
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Reserve job
   * @return {Promise<Job,Error>} A promise to resserve job,
   *          will not return untill a job reserved
	 */
	reserveBsJob() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.reserve(function (err, job_id, payload) {
				if (err !== null) {
					self.reserveBsJob(self.bs_client);
				} else {
					let p = payload.toString('utf-8');
					resolve({payload: JSON.parse(p), job_id: job_id});
				}
			});
		});
	}

	/**
	 * Put job to queue
   * @param {string} [task_id] - Task ID of the job
   * @param {string} [from] - convert from (Currency Code)
   * @param {stirng} [to] - convert to (Currency Code)
   * @return {Promise<string,Error>} A promise to put job,
   *          return the job id if success
	 */
	putBsJob(task_id, from, to) {
		let self = this;
		let payload = {
			task_id: task_id,
			from: from,
			to: to
		};

		return new Promise(function (resolve, reject) {
			self.bs_client.put(1, 0, 10, JSON.stringify(payload), function (err, job_id) {
				if (err !== null) {
					reject(new Error('Put Job Error'));
				} else {
					resolve(job_id);
				}
			});
		});
	}

	/**
	 * Put job to queue with additional params
   * @param {string} [task_id] - Task ID of the job
	 * @param {number} [delay] - put job delay setting in sec
   * @param {string} [from] - convert from (Currency Code)
   * @param {stirng} [to] - convert to (Currency Code)
	 * @param {number} [success] - get exchange rate success count
   * @param {number} [fail] - get exchnage rate fail count
   * @return {Promise<string,Error>} A promise to re-put job,
   *          return the job id if success
	 */
	reputBsJob(task_id, delay, from, to, success, fail) {
		let self = this;
		let payload = {
			task_id: task_id,
			from: from,
			to: to,
			success: success,
			fail: fail
		};

		return new Promise(function (resolve, reject) {
			self.bs_client.put(10, delay, 10, JSON.stringify(payload), function (err, job_id) {
				if (err !== null) {
					if (self.fail_count_reput >= MAX_TRIES_REPUT) {
						//	re-put fail and tries exceeded the threshold, return error
						self.fail_count_reput = 0;
						reject(new Error('Reput Job Error'));
					} else {
						// re-put fail but tries less than the threshold, retry
						self.fail_count_reput++;
						self.reputBsJob(self.bs_client, delay, from, to, success, fail);
					}
				} else {
					//	re-put success, return job id
					self.fail_count_reput = 0;
					resolve(job_id);
				}
			});
		});
	}

	/**
	 * Delete job from queue
   * @param {string} [job_id] - Job Id of the target job
   * @return {Promise<Boolean,Error>} A promise to delete job,
   *          return true if success
	 */
	destroyBsJob(job_id) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.destroy(job_id, function (err) {
				if (err !== null) {
					if (self.fail_count_destroy >= MAX_TRIES_DESTROY) {
						//	delete fail and tries exceeded the threshold, return error
						self.fail_count_destroy = 0;
						reject(new Error('Destroy Job Error'));
					} else {
						//	delete fail but tries less than the threshold, retry
						self.fail_count_destroy++;
						self.destroyBsJob(job_id);
					}
				} else {
					//	delete success, return true
					self.fail_count_destroy = 0;
					resolve(true);
				}
			});
		});
	}

	/**
	 * Bury the specific job
   * @param {string} [job_id] - Job Id of the target job
   * @return {Promise<Boolean,Error>} A promise to bury job,
   *          return true if success
	 */
	buryBsJob(job_id) {
		let self = this;
		return new Promise(function (resolve, reject) {
			self.bs_client.bury(job_id, 1, function (err) {
				if (err !== null) {
					if (self.fail_count_bury >= MAX_TRIES_BURY) {
						//	bury job fail and tries exceeded the threshold, return error
						self.fail_count_bury = 0;
						reject(new Error('Bury Job Error'));
					} else {
						//	bury job fail but tries less than the threshold, retry
						self.fail_count_bury++;
						self.buryBsJob(job_id);
					}
				} else {
					//	bury job success, return true
					self.fail_count_bury = 0;
					resolve(true);
				}
			});
		});
	}

}

module.exports = JobQ;
