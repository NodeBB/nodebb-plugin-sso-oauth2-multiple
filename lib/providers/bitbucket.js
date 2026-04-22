'use strict';

const { httpsGetJson } = require('../oauth/http');

function pickBitbucketEmail(payload) {
	const list = payload && Array.isArray(payload.values) ? payload.values : null;
	if (!list) return null;
	const p = list.find(i => i.is_primary && i.is_confirmed) ||
		list.find(i => i.is_primary) ||
		list.find(i => i.is_confirmed) ||
		list[0];
	return p ? { email: p.email, verified: !!p.is_confirmed } : null;
}

module.exports = {
	type: 'bitbucket',

	matches({ host, name }) {
		return host === 'api.bitbucket.org' || /bitbucket/.test(name);
	},

	parse(profile) {
		return {
			id: profile.uuid || profile.account_id || profile.username,
			displayName: profile.username || profile.display_name,
			fullname: profile.display_name || profile.username,
			picture: profile.links && profile.links.avatar && profile.links.avatar.href,
			username: profile.username,
		};
	},

	async fetchEmail({ accessToken }) {
		return pickBitbucketEmail(await httpsGetJson({
			url: 'https://api.bitbucket.org/2.0/user/emails',
			accessToken,
		}));
	},
};
