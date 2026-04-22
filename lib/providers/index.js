'use strict';

// Provider registry. Each provider module declares its own detection
// heuristics, profile parser, and email fallback. Adding a new provider
// means dropping a new file into this folder and listing it here.

const { hostOf } = require('../oauth/http');

const base = require('./base');

const providers = [
	require('./github'),
	require('./bitbucket'),
	require('./linkedin'),
	require('./discord'),
	require('./facebook'),
	require('./twitter'),
	require('./apple'),
	require('./google'),
	require('./microsoft'),
	require('./gitlab'),
];

const byType = new Map(providers.map(p => [p.type, p]));

function get(type) {
	if (!type) return base;
	return byType.get(String(type).toLowerCase()) || base;
}

function detect(strategyConfig, rawProfile) {
	const explicit = ((strategyConfig && strategyConfig.providerType) || '').trim().toLowerCase();
	if (explicit) return get(explicit);

	const host = hostOf((strategyConfig && strategyConfig.userRoute) ||
		(strategyConfig && strategyConfig.authUrl) || '');
	const name = ((strategyConfig && strategyConfig.name) || '').toLowerCase();
	const ctx = { host, name, profile: rawProfile };

	for (const p of providers) {
		try {
			// Pass strategyConfig as a second arg so providers like gitlab can
			// inspect the configured userRoute when it is not reflected in the
			// probe context.
			if (p.matches && p.matches(ctx, strategyConfig)) return p;
		} catch (_) { /* ignore individual matcher errors */ }
	}
	return base;
}

exports.base = base;
exports.get = get;
exports.detect = detect;
exports.all = providers;
