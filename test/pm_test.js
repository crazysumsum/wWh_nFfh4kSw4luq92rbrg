'use strict';
const expect = require('chai').expect;
const PersistenceManager = require('../lib/persistence_manager.js');

describe('Persistence Manager', function () {
	this.timeout(10000);

	it('Init Success', function () {
		let pm = new PersistenceManager('ds033125.mongolab.com:33125/aftership', 'sam', 'Abcd1234');
		return pm.init().then(
			function fulfilled(result) {
				expect(result).to.equal(true);
				pm.destroy();
			}
		);
	});

	it('Init Fail - Invalid uri', function () {
		let pm = new PersistenceManager('test', 'sam', 'Abcd1234');
		return pm.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to MongoDB Error');
			});
	});

	it('Init Fail - Invalid username', function () {
		let pm = new PersistenceManager('ds033125.mongolab.com:33125/aftership', 'test', 'Abcd1234');
		return pm.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to MongoDB Error');
			});
	});

	it('Init Fail - Invalid password', function () {
		let pm = new PersistenceManager('ds033125.mongolab.com:33125/aftership', 'sam', 'test');
		return pm.init().then(
			function fulfilled(result) {
				throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
			},
			function rejected(err) {
				expect(err.message).to.equal('Connect to MongoDB Error');
			});
	});

	it('Destroy', function () {
		let pm = new PersistenceManager('ds033125.mongolab.com:33125/aftership', 'sam', 'Abcd1234');

		return pm.init().then(function fulfilled(result) {
			pm.destroy();
		});
	});

	it('Save Exchange Rate Success', function () {
		let pm = new PersistenceManager('ds033125.mongolab.com:33125/aftership', 'sam', 'Abcd1234');

		return pm.init().then(function fulfilled(result) {
			return pm.saveExRate('9999', 'JPY', 'HKD', '999');
		}).then(function fulfilled(result) {
			expect(result).to.be.an('object');
			expect(result.ops[0].task_id).to.equal('9999');
			expect(result.ops[0].from).to.equal('JPY');
			expect(result.ops[0].to).to.equal('HKD');
			expect(result.ops[0].rate).to.equal('999');
			return pm.removeRate(result.ops[0]._id);
		}).then(function fulfilled(result) {
			pm.destroy();
		});
	});
});
