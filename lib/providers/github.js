'use strict';

const { httpsGetJson } = require('../oauth/http');

const GITHUB_USER_HEADERS = {
	'Accept': 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28',
};

function pickGitHubEmail(list) {
	if (!Array.isArray(list)) return null;
	const p = list.find(i => i.primary && i.verified) ||
		list.find(i => i.primary) ||
		list.find(i => i.verified) ||
		list[0];
	return p ? { email: p.email, verified: !!p.verified } : null;
}

module.exports = {
	type: 'github',

	matches({ host, name, profile }) {
		if (host === 'api.github.com' || /github/.test(name)) return true;
		if (profile && (profile.login !== undefined || profile.html_url || profile.gravatar_id)) {
			return true;
		}
		return false;
	},

	userRouteHeaders() {
		return GITHUB_USER_HEADERS;
	},

	parse(profile) {
		return {
			id: profile.id,
			displayName: profile.login || profile.name,
			fullname: profile.name || profile.login,
			picture: profile.avatar_url,
			email: profile.email || undefined,
			username: profile.login,
		};
	},

	async fetchEmail({ accessToken }) {
		return pickGitHubEmail(await httpsGetJson({
			url: 'https://api.github.com/user/emails',
			accessToken,
			headers: GITHUB_USER_HEADERS,
		}));
	},
};
