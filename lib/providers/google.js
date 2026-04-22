'use strict';

const { httpsGetJson } = require('../oauth/http');

module.exports = {
	type: 'google',

	matches({ host, name }) {
		if (host === 'openidconnect.googleapis.com' || host === 'www.googleapis.com') return true;
		return /google/.test(name);
	},

	// /v1/userinfo: { sub, name, given_name, family_name, picture, email, email_verified, locale }
	parse(profile) {
		return {
			id: profile.sub,
			displayName: profile.name || (profile.email ? profile.email.split('@')[0] : undefined),
			fullname: profile.name,
			picture: profile.picture,
			email: profile.email,
			email_verified: profile.email_verified,
		};
	},

	async fetchEmail({ accessToken }) {
		const json = await httpsGetJson({
			url: 'https://openidconnect.googleapis.com/v1/userinfo',
			accessToken,
		});
		return json && json.email ? { email: json.email, verified: !!json.email_verified } : null;
	},
};
