'use strict';
const expect = require('chai').expect;
const ConsumerWorker = require('../lib/consumer_worker.js');

describe('Consumer Worker', function () {
	let config_normal = {};
	let config_invalid_jq = {};
	let config_invalid_pm = {};
	let config_invalid_cc = {};
	let default_job_payload = {};
	let test_job = {};

	let cw = null;
	let cw_ready = null;

	let worker_id = 9999;

	this.timeout(10000);

	before(function (done) {
		config_normal = {
			mode: 'unit_test',
			job_queue: {
				host: 'challenge.aftership.net',
				port: 11300,
				tube: 'Testing_tube_3049304'
			},
			persistence: {
				uri: 'ds033125.mongolab.com:33125/aftership',
				username: 'sam',
				password: 'Abcd1234'
			},
			converter: {
				host: 'www.xe.com',
				path: '/currencyconverter/convert/'
			}
		};

		config_invalid_jq = {
			mode: 'unit_test',
			job_queue: {
				host: 'test',
				port: 11300,
				tube: 'Testing_tube_3049304'
			},
			persistence: {
				uri: 'ds033125.mongolab.com:33125/aftership',
				username: 'sam',
				password: 'Abcd1234'
			},
			converter: {
				host: 'www.xe.com',
				path: '/currencyconverter/convert/'
			}
		};

		config_invalid_pm = {
			mode: 'unit_test',
			job_queue: {
				host: 'challenge.aftership.net',
				port: 11300,
				tube: 'Testing_tube_3049304'
			},
			persistence: {
				uri: 'ds033125.mongolab.com:33125/aftership',
				username: 'test',
				password: 'Abcd1234'
			},
			converter: {
				host: 'www.xe.com',
				path: '/currencyconverter/convert/'
			}
		};

		config_invalid_cc = {
			mode: 'unit_test',
			job_queue: {
				host: 'challenge.aftership.net',
				port: 11300,
				tube: 'Testing_tube_3049304'
			},
			persistence: {
				uri: 'ds033125.mongolab.com:33125/aftership',
				username: 'sam',
				password: 'Abcd1234'
			},
			converter: {
				host: 'test',
				path: '/currencyconverter/convert/'
			}
		};

		cw_ready = new ConsumerWorker(worker_id, config_normal);
		cw_ready.init().then(function fulfilled(result) {
			done();
		});
	});

	after(function () {
		cw_ready.destroy();
	});

	beforeEach(function (done) {
		default_job_payload = {
			task_id: 9999,
			delay: 0,
			from: 'HKD',
			to: 'USD',
			success: 0,
			fail: 0
		};

		cw_ready.jq.putBsJob(default_job_payload.task_id,
			default_job_payload.from, default_job_payload.to).then(function fulfilled(job_id) {
				test_job.job_id = job_id;
				done();
			});
	});

	afterEach(function (done) {
		if (test_job.job_id !== null) {
			cw_ready.jq.destroyBsJob(test_job.job_id).then(function fulfilled(result) {
				done();
			});
		} else {
			done();
		}
	});

	it('Init success', function () {
		cw = new ConsumerWorker(worker_id, config_normal);
		return cw.init().then(function fulfilled(result) {
			expect(result).to.equal(true);
			cw.destroy();
			cw = null;
		});
	});

	it('Init Fail - Invalid Job Queue', function () {
		cw = new ConsumerWorker(worker_id, config_invalid_jq);
		return cw.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to BS Error');
				cw = null;
			}
		);
	});

	it('Init Fail - Invalid Persistence Manager', function () {
		cw = new ConsumerWorker(worker_id, config_invalid_pm);
		return cw.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to MongoDB Error');
				cw = null;
			}
		);
	});

	it('Destroy', function () {
		cw = new ConsumerWorker(worker_id, config_normal);
		return cw.init().then(function fulfilled(result) {
			cw.destroy();
			cw = null;
		});
	});

	it('Re-put Job', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
		});
	});

	it('Reserve "Normal Job"', function () {
		return cw_ready.reserveJob().then(function fulfilled(r_job) {
			expect(r_job.task_id).to.equal(default_job_payload.task_id);
			expect(r_job.from).to.equal(default_job_payload.from);
			expect(r_job.to).to.equal(default_job_payload.to);
			expect(r_job.delay).to.equal(default_job_payload.delay);
			expect(r_job.success).to.equal(default_job_payload.success);
			expect(r_job.fail).to.equal(default_job_payload.fail);
		});
	});

	it('Reserve "Re-put Job"', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.delay = 1;
		job.success = 2;
		job.fail = 3;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			return cw_ready.reserveJob();
		}).then(function fulfilled(r_job) {
			expect(r_job.task_id).to.equal(default_job_payload.task_id);
			expect(r_job.from).to.equal(default_job_payload.from);
			expect(r_job.to).to.equal(default_job_payload.to);
			expect(r_job.delay).to.equal(0);
			expect(r_job.success).to.equal(2);
			expect(r_job.fail).to.equal(3);
		});
	});

	it('Job Finished', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.delay = 0;
		job.success = 10;
		job.fail = 3;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			job.job_id = job_id;
			return cw_ready.finishJob(job);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
			test_job.job_id = null;
		});
	});

	it('Job Not Yet Finished', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.delay = 0;
		job.success = 9;
		job.fail = 3;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			job.job_id = job_id;
			return cw_ready.finishJob(job);
		}).then(function fulfilled(result) {
			expect(result).to.equal(false);
		});
	});

	it('Job Buried', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.delay = 0;
		job.success = 10;
		job.fail = 3;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			job.job_id = job_id;
			return cw_ready.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw_ready.buryJob(r_job);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
			test_job.job_id = null;
		});
	});

	it('Job Not Yet Buried', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.delay = 0;
		job.success = 10;
		job.fail = 2;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			job.job_id = job_id;
			return cw_ready.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw_ready.buryJob(r_job);
		}).then(function fulfilled(result) {
			expect(result).to.equal(false);
		});
	});

	it('Get Exchange Rate Success', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.success = 8;
		job.fail = 2;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			return cw_ready.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw_ready.getExchangeRate(r_job);
		}).then(function fulfilled(r_job) {
			expect(r_job.success).to.equal(default_job_payload.success + 1);
			expect(r_job.fail).to.equal(default_job_payload.fail);
			expect(r_job.delay).to.equal(60);
			return cw_ready.pm.removeRate(r_job.doc.ops[0]._id);
		}).then(function fulfilled(result) {
			return;
		});
	});

	it('Get Exchange Rate Success and Job Finished', function () {
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.success = 9;
		job.fail = 2;

		return cw_ready.reputJob(job).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			test_job.job_id = job_id;
			return cw_ready.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw_ready.getExchangeRate(r_job);
		}).then(function fulfilled(r_job) {
			expect(r_job.success).to.equal(default_job_payload.success + 1);
			expect(r_job.fail).to.equal(default_job_payload.fail);
			expect(r_job.delay).to.equal(0);
			return cw_ready.pm.removeRate(r_job.doc.ops[0]._id);
		}).then(function fulfilled() {
			return;
		});
	});

	it('Get Exchange Rate Fail', function () {
		cw = new ConsumerWorker(worker_id, config_invalid_cc);
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.success = 9;
		job.fail = 1;

		return cw.init().then(function fulfilled(result) {
			return cw.reputJob(job);
		}).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			return cw.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw.getExchangeRate(r_job);
		}).then(function fulfilled(r_job) {
			expect(r_job.success).to.equal(default_job_payload.success);
			expect(r_job.fail).to.equal(default_job_payload.fail + 1);
			expect(r_job.delay).to.equal(3);
			return cw.jq.destroyBsJob(r_job.job_id);
		}).then(function fulfilled(result) {
			test_job.job_id = null;
			cw.destroy();
		});
	});

	it('Get Exchange Rate Fail and Job Buried', function () {
		cw = new ConsumerWorker(worker_id, config_invalid_cc);
		let job = default_job_payload;
		job.job_id = test_job.job_id;
		job.success = 9;
		job.fail = 2;

		return cw.init().then(function fulfilled(result) {
			return cw.reputJob(job);
		}).then(function fulfilled(job_id) {
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			return cw.reserveJob();
		}).then(function fulfilled(r_job) {
			return cw.getExchangeRate(r_job);
		}).then(function fulfilled(r_job) {
			expect(r_job.success).to.equal(default_job_payload.success);
			expect(r_job.fail).to.equal(default_job_payload.fail + 1);
			expect(r_job.delay).to.equal(0);
			return cw.jq.destroyBsJob(r_job.job_id);
		}).then(function fulfilled(result) {
			test_job.job_id = null;
			cw.destroy();
		});
	});
});
