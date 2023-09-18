'use strict';

(async () => {
	const hooks = await app.require('hooks');

	hooks.on('filter:script.load', ({ tpl_url, scripts }) => {
		if (tpl_url === 'admin/plugins/sso-oauth2-multiple-v2') {
			scripts.splice(scripts.indexOf('forum/admin/plugins/sso-oauth2-multiple-v2'), 1, 'admin/plugins/sso-oauth2-multiple');
		}

		return { tpl_url, scripts };
	});
})();
