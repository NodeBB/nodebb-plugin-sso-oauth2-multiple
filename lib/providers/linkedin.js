'use strict';

const { httpsGetJson } = require('../oauth/http');

module.exports = {
	type: 'linkedin',

	matches({ host, name }) {
		return host === 'api.linkedin.com' || /linkedin/.test(name);
	},

	parse(profile) {
		const fullname = [profile.localizedFirstName, profile.localizedLastName]
			.filter(Boolean)
			.join(' ');
		return {
			id: profile.id,
			displayName: fullname || profile.id,
			fullname,
		};
	},

	async fetchEmail({ accessToken }) {
		const json = await httpsGetJson({
			url: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
			accessToken,
		});
		const el = json && Array.isArray(json.elements) ? json.elements[0] : null;
		const email = el && el['handle~'] && el['handle~'].emailAddress;
		return email ? { email, verified: true } : null;
	},
};
