'use strict';

const winston = require.main.require('winston');

module.exports = {
	type: 'twitter',
	pkceDefault: true,

	matches({ host, name }) {
		if (host === 'api.twitter.com' || host === 'api.x.com') return true;
		return /twitter|^x$|\bx\b/.test(name);
	},

	parse(profile) {
		const d = profile.data || profile;
		return {
			id: d.id,
			displayName: d.username || d.name,
			fullname: d.name || d.username,
			picture: d.profile_image_url,
			username: d.username,
		};
	},

	async fetchEmail() {
		winston.warn('[sso-oauth2-multiple] twitter: email cannot be fetched via OAuth2; skipping');
		return null;
	},
};
