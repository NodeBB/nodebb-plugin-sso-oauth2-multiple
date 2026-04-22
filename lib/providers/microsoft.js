'use strict';

const { httpsGetJson } = require('../oauth/http');

module.exports = {
	type: 'microsoft',

	matches({ host, name }) {
		if (/graph\.microsoft\.com|login\.microsoftonline\.com/.test(host)) return true;
		return /microsoft|azure|entra/.test(name);
	},

	// Graph /me: { id, displayName, userPrincipalName, mail, givenName, surname }
	parse(profile) {
		const email = profile.mail || profile.userPrincipalName;
		return {
			id: profile.id,
			displayName: profile.displayName || email,
			fullname: profile.displayName || [profile.givenName, profile.surname].filter(Boolean).join(' '),
			email,
			email_verified: email ? true : undefined,
		};
	},

	async fetchEmail({ accessToken }) {
		const json = await httpsGetJson({
			url: 'https://graph.microsoft.com/v1.0/me',
			accessToken,
		});
		const email = json && (json.mail || json.userPrincipalName);
		return email ? { email, verified: true } : null;
	},
};
