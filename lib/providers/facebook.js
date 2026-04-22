'use strict';

const { httpsGetJson } = require('../oauth/http');

module.exports = {
	type: 'facebook',

	matches({ host, name }) {
		return host === 'graph.facebook.com' || /facebook|meta/.test(name);
	},

	parse(profile) {
		const picture = profile.picture && profile.picture.data && profile.picture.data.url;
		return {
			id: profile.id,
			displayName: profile.name,
			fullname: profile.name,
			picture,
			email: profile.email || undefined,
			email_verified: profile.email ? true : undefined,
		};
	},

	async fetchEmail({ accessToken }) {
		const json = await httpsGetJson({
			url: 'https://graph.facebook.com/v19.0/me?fields=id,email',
			accessToken,
		});
		return json && json.email ? { email: json.email, verified: true } : null;
	},
};
