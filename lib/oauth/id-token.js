'use strict';

const winston = require.main.require('winston');

// Parses the payload section of a JWT without verifying the signature. The
// resulting object exposes the id_token claims (sub, email, name, ...).
function extractIdTokenClaims(idToken) {
	if (!idToken || typeof idToken !== 'string') return null;
	const parts = idToken.split('.');
	if (parts.length < 2) return null;
	try {
		const payload = Buffer
			.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
			.toString('utf8');
		return JSON.parse(payload);
	} catch (e) {
		winston.warn(`[sso-oauth2-multiple] id_token parse failed: ${e.message}`);
		return null;
	}
}

exports.extractIdTokenClaims = extractIdTokenClaims;
