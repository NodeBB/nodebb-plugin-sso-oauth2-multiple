'use strict';

const https = require('https');
const { URL } = require('url');

function hostOf(u) {
	try {
		return new URL(u).host.toLowerCase();
	} catch {
		return '';
	}
}

function httpsGetJson({ url, accessToken, headers = {} }) {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const req = https.request({
			method: 'GET',
			hostname: u.hostname,
			port: u.port || 443,
			path: `${u.pathname}${u.search || ''}`,
			headers: Object.assign({
				'User-Agent': 'nodebb-plugin-sso-oauth2-multiple',
				'Authorization': `Bearer ${accessToken}`,
			}, headers),
		}, (res) => {
			let body = '';
			res.on('data', (c) => { body += c; });
			res.on('end', () => {
				if (res.statusCode < 200 || res.statusCode >= 300) {
					return reject(new Error(`${url} -> ${res.statusCode}: ${body.slice(0, 300)}`));
				}
				try {
					resolve(body ? JSON.parse(body) : null);
				} catch (e) {
					reject(e);
				}
			});
		});
		req.on('error', reject);
		req.end();
	});
}

exports.hostOf = hostOf;
exports.httpsGetJson = httpsGetJson;
