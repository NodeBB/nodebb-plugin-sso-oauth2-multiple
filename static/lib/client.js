'use strict';

(() => {
	if (typeof document === 'undefined') {
		return;
	}

	const existing = document.querySelector('link[data-sso-oauth2-icons]');
	if (existing) {
		return;
	}

	const relativePath = (window.config && window.config.relative_path) ? window.config.relative_path : '';
	const cacheBuster = (window.config && (window.config['cache-buster'] || window.config.cacheBuster)) || '';
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = `${relativePath}/plugins/sso-oauth2-multiple/icons.css${cacheBuster ? `?v=${cacheBuster}` : ''}`;
	link.setAttribute('data-sso-oauth2-icons', '1');
	document.head.appendChild(link);
})();
