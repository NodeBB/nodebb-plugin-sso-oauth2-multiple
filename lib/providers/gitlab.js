'use strict';

const { URL } = require('url');
const { httpsGetJson } = require('../oauth/http');

function gitlabApiBase(userRoute) {
	try {
		const u = new URL(userRoute);
		const m = u.pathname.match(/^(.*\/api\/v4)\b/);
		return `${u.protocol}//${u.host}${m ? m[1] : '/api/v4'}`;
	} catch {
		return 'https://gitlab.com/api/v4';
	}
}

module.exports = {
	type: 'gitlab',

	matches({ profile }, strategyConfig) {
		if (strategyConfig && strategyConfig.userRoute && /\/api\/v4\/user\b/.test(strategyConfig.userRoute)) {
			return true;
		}
		if (profile && (profile.web_url || profile.avatar_url) &&
			profile.username && profile.id && profile.state) {
			return true;
		}
		return false;
	},

	parse(profile) {
		return {
			id: profile.id,
			displayName: profile.username || profile.name,
			fullname: profile.name || profile.username,
			picture: profile.avatar_url,
			email: profile.email || profile.public_email || undefined,
			email_verified: profile.confirmed_at ? true : undefined,
			username: profile.username,
		};
	},

	async fetchEmail({ strategyConfig, accessToken }) {
		const base = gitlabApiBase(strategyConfig.userRoute);
		const json = await httpsGetJson({ url: `${base}/user`, accessToken });
		return json && json.email ? { email: json.email, verified: !!json.confirmed_at } : null;
	},
};

module.exports.gitlabApiBase = gitlabApiBase;
