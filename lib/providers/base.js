'use strict';

// Default provider: generic OIDC / unknown OAuth2. Also acts as the fallback
// base for providers that only override a subset of hooks.
//
// Every provider module exports the following shape (all fields optional
// except `type` and `parse`):
//
//   {
//     type:            'github',                 // lowercase identifier
//     pkceDefault:     false,                    // force PKCE on by default
//     skipUserRoute:   false,                    // skip userinfo HTTP call
//     matches({ host, name, profile }) -> bool,  // auto-detection heuristic
//     userRouteHeaders() -> object,              // extra headers for userinfo
//     parse(rawProfile, { idKey }) -> normalized,// shape the profile
//     fetchEmail({ strategyConfig, accessToken }) -> { email, verified } | null
//   }

module.exports = {
	type: 'oidc',

	// The generic provider is the fallback; it never claims a match itself.
	matches() {
		return false;
	},

	parse(profile, { idKey } = {}) {
		const {
			id, sub,
			name, nickname, preferred_username: preferredUsername, login,
			given_name: givenName, middle_name: middleName, family_name: familyName,
			picture, avatar_url: avatarUrl, email, email_verified: emailVerified,
		} = profile;
		const displayName = nickname || preferredUsername || login || name;
		const combined = [givenName, middleName, familyName].filter(Boolean).join(' ');
		return {
			id: (idKey && profile[idKey]) || id || sub,
			displayName,
			fullname: name || combined || displayName,
			picture: picture || avatarUrl,
			email,
			email_verified: emailVerified,
			username: login || preferredUsername || nickname,
		};
	},

	async fetchEmail() {
		return null;
	},
};
