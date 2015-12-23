'use strict';

const http = require('http');
const cheerio = require('cheerio');
const Promise = require('bluebird');

/**
 * Create a new Currency Converter to conduct the currency conversion
 * @class
 */
class CurrencyConverter {

	/**
	 * Create a new Currency Converter
	 * @param {string} [host] - Address of the service provider
	 * @param {string} [path] - Path to the currency convert service
	 * @constructor
	 */
	constructor(host, path) {
		this.host = host;
		this.path = path;
	}

	/**
	 * Get Exchange rate
   * @param {string} [from] - convert from (currency code)
	 * @param {string} [to] - convert to (currency code)
	 * @return {Promise<string,Error>} A promise to get exchange rate,
   *          return the exchange rate if get exchange rate success
	 */
	getExRate(from, to) {
		let self = this;
		let opt = {
			host: self.host,
			path: self.path + '?Amount=1&From=' + from + '&To=' + to
		};

		return new Promise(function (resolve, reject) {
			let html = '';

			let req = http.request(opt, function (response) {
				response.on('data', function (chunk) {
					html += chunk;
				});

				response.on('end', function () {
					let $ = cheerio.load(html);
					let	tmp = $('.uccRes .rightCol').html();
					let	exRate = 1;
					let	reg = /\d/;
					let	r = '';

					//	Get	Exchange Rate fail
					if (tmp === null || typeof tmp !== 'string') {
						reject(new Error('Get Exchange Rate Error'));
						return;
					}

					//	Extract the exchange rate from the return HTML
					for (let i = 0, len = tmp.length; i < len; i++) {
						if (reg.test(tmp[i]) || tmp[i] === '.') {
							r = r + tmp[i];
						} else {
							break;
						}
					}

					exRate = parseFloat(r);

					if (isNaN(exRate)) {
						//	Convert exchange rate fail, return error
						reject(new Error('Get Exchange Rate Error'));
					} else {
						//	Convert exchnage rate success, return the rate in string
						resolve(exRate.toFixed(2));
					}
				});
			});

			req.on('error', function (err) {
				reject(new Error('Get Exchange Rate Error'));
			});

			req.end();
		});
	}
}

module.exports = CurrencyConverter;
