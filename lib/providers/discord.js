'use strict';

const { httpsGetJson } = require('../oauth/http');

module.exports = {
	type: 'discord',

	matches({ host, name }) {
		return host === 'discord.com' || host === 'discordapp.com' || /discord/.test(name);
	},

	parse(profile) {
		const avatar = profile.avatar ?
			`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` :
			undefined;
		return {
			id: profile.id,
			displayName: profile.global_name || profile.username,
			fullname: profile.global_name || profile.username,
			picture: avatar,
			email: profile.email || undefined,
			email_verified: typeof profile.verified === 'boolean' ? profile.verified : undefined,
			username: profile.username,
		};
	},

	async fetchEmail({ accessToken }) {
		const json = await httpsGetJson({
			url: 'https://discord.com/api/users/@me',
			accessToken,
		});
		return json && json.email ? { email: json.email, verified: !!json.verified } : null;
	},
};
