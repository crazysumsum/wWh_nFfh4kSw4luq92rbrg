'use strict';
const expect = require('chai').expect;
const CurrencyConverter = require('../lib/currency_converter.js');

describe('Currency Converter', function () {
	this.timeout(10000);

	it('Get Exchange Rate Success', function () {
		let cc = new CurrencyConverter('www.xe.com', '/currencyconverter/convert/');

		return cc.getExRate('HKD', 'USD').then(
			function fulfilled(rate) {
				expect(rate).to.be.a('string');
				expect(parseFloat(rate).toString()).to.not.equal('NaN');
			});
	});

	it('Get Exchange Rate Fail - Invalid host', function () {
		let cc = new CurrencyConverter('www.testing.com', '/currencyconverter/convert/');

		return cc.getExRate('HKD', 'USD').then(
			function fulfilled(rate) {
				throw new Error('Promise was unexpectedly fulfilled. Rate: ' + rate);
			},
			function rejected(err) {
				expect(err.message).to.equal('Get Exchange Rate Error');
			});
	});

	it('Get Exchange Rate Fail - Invalid path', function () {
		let cc = new CurrencyConverter('www.xe.com', '/currencyconverter/convert/test/');

		return cc.getExRate('HKD', 'USD').then(
			function fulfilled(rate) {
				throw new Error('Promise was unexpectedly fulfilled. Rate: ' + rate);
			},
			function rejected(err) {
				expect(err.message).to.equal('Get Exchange Rate Error');
			});
	});
});
