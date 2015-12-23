'use strict';
const expect = require('chai').expect;
const JobQ = require('../lib/job_queue.js');

describe('Job Queue', function () {
	let job_queue = new JobQ('challenge.aftership.net', 11300, 'Testing_tube_3049304');
	this.timeout(10000);

	before(function (done) {
		job_queue.init().then(function () {
			done();
		});
	});

	it('Init Success', function () {
		let jq = new JobQ('challenge.aftership.net', 11300, 'Testing_tube_3049304');
		return jq.init().then(
			function fulfilled(result) {
				expect(result).to.equal(true);
			});
	});

	it('Init Fail - Invalid host', function () {
		let jq = new JobQ('test', 11300, 'Testing_tube_3049304');
		return jq.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to BS Error');
			});
	});

	it('Init Fail - Invalid port', function () {
		let jq = new JobQ('challenge.aftership.net', 113000, 'Testing_tube_3049304');
		return jq.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err).to.have.ownProperty('message');
			});
	});

	it('Put and Destroy Job', function () {
		return job_queue.putBsJob(9999, 'HKD', 'USD').then(function (job_id) {
			expect(job_id).to.be.a('string');
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			return job_queue.destroyBsJob(job_id);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
		});
	});

	it('Reput and Destroy Job', function () {
		return job_queue.reputBsJob(9999, 0, 'HKD', 'USD', 0, 0).then(function (job_id) {
			expect(job_id).to.be.a('string');
			expect(parseInt(job_id, 10).toString()).to.not.equal('NaN');
			return job_queue.destroyBsJob(job_id);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
		});
	});

	it('Reserve and Destroy Job', function () {
		return job_queue.putBsJob(9999, 'HKD', 'USD').then(function (job_id) {
			return job_queue.reserveBsJob();
		}).then(function fulfilled(job) {
			expect(job).to.be.an('object');
			expect(job.job_id).not.to.be.null;
			expect(job.payload.task_id).to.equal(9999);
			expect(job.payload.from).to.equal('HKD');
			expect(job.payload.to).to.equal('USD');
			return job_queue.destroyBsJob(job.job_id);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
		});
	});

	it('Reserve and Bury Job', function () {
		return job_queue.putBsJob(9999, 'HKD', 'USD').then(function (job_id) {
			return job_queue.reserveBsJob();
		}).then(function fulfilled(job) {
			expect(job).to.be.an('object');
			expect(job.job_id).not.to.be.null;
			expect(job.payload.task_id).to.equal(9999);
			expect(job.payload.from).to.equal('HKD');
			expect(job.payload.to).to.equal('USD');
			return job_queue.buryBsJob(job.job_id);
		}).then(function fulfilled(result) {
			expect(result).to.equal(true);
		});
	});
});
