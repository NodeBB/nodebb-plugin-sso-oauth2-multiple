'use strict';

// import * as settings from 'settings';
import { alert, confirm } from 'bootbox';
import { get, post, del } from 'api';
import { error } from 'alerts';
import { render } from 'benchpress';

// eslint-disable-next-line import/prefer-default-export
export function init() {
	// settings.load('sso-oauth2-multiple', $('.sso-oauth2-multiple-settings'));
	// $('#save').on('click', saveSettings);

	const formEl = document.querySelector('.sso-oauth2-multiple-settings');
	formEl.addEventListener('click', async (e) => {
		const subselector = e.target.closest('[data-action]');
		if (subselector) {
			const action = subselector.getAttribute('data-action');

			switch (action) {
				case 'new': {
					const title = 'New OAuth2 Strategy';
					const message = await app.parseAndTranslate('partials/edit-oauth2-strategy', {});
					confirm({
						title,
						message,
						size: 'xl',
						callback: handleEditStrategy,
						onShown: handleAutoDiscovery,
					});

					break;
				}

				case 'edit': {
					const name = subselector.closest('[data-name]').getAttribute('data-name');
					const { strategy } = await get(`/plugins/oauth2-multiple/strategies/${name}`);
					const title = 'Edit OAuth2 Strategy';
					const message = await app.parseAndTranslate('partials/edit-oauth2-strategy', { ...strategy });
					confirm({
						title,
						message,
						size: 'xl',
						callback: handleEditStrategy,
						onShown: handleAutoDiscovery,
					});

					break;
				}

				case 'delete': {
					const name = subselector.closest('[data-name]').getAttribute('data-name');

					if (!name) {
						break;
					}

					confirm({
						title: 'Delete Strategy',
						message: `Are you sure you wish to delete the OAuth2 strategy named <strong>${name}</strong>?`,
						callback: function (ok) {
							handleDeleteStrategy.call(this, ok, name);
						},
					});

					break;
				}

				case 'callback-help': {
					alert({
						title: 'What is the callback URL?',
						message: `
							When you create a new OAuth2 client at the provider, you need to specify a callback URL.
							Each provider is unfamiliar with how individual clients handle the callback.
							NodeBB provides the following URL for you to enter into that configuration.
						`,
					});
				}
			}
		}
	});
}

function handleEditStrategy(ok) {
	if (!ok) {
		return;
	}

	const $modal = this;
	const modalEl = this.get(0);
	const formEl = modalEl.querySelector('form');
	const data = new FormData(formEl);

	post('/plugins/oauth2-multiple/strategies', data).then(async ({ strategies }) => {
		const html = await render('admin/plugins/sso-oauth2-multiple', { strategies }, 'strategies');
		const tbodyEl = document.querySelector('#strategies tbody');
		tbodyEl.innerHTML = html;
		$modal.modal('hide');
	}).catch(error);

	return false;
}

function handleAutoDiscovery() {
	const modalEl = this;

	const domainEl = modalEl.querySelector('#domain');
	const successEl = modalEl.querySelector('#discovery-success');
	const failureEl = modalEl.querySelector('#discovery-failure');
	const detailsEl = modalEl.querySelector('#details');
	const idEl = modalEl.querySelector('#id');
	if (![domainEl, successEl, failureEl, detailsEl].every(Boolean)) {
		return;
	}

	domainEl.addEventListener('change', async () => {
		try {
			detailsEl.classList.add('opacity-50');
			successEl.classList.replace('d-flex', 'd-none');
			failureEl.classList.replace('d-flex', 'd-none');
			const { authorization_endpoint, token_endpoint, userinfo_endpoint } = await get(`/plugins/oauth2-multiple/discover?domain=${encodeURIComponent(domainEl.value)}`);

			if (authorization_endpoint) {
				modalEl.querySelector('#authUrl').value = authorization_endpoint;
			}

			if (token_endpoint) {
				modalEl.querySelector('#tokenUrl').value = token_endpoint;
			}

			if (userinfo_endpoint) {
				modalEl.querySelector('#userRoute').value = userinfo_endpoint;
			}

			successEl.classList.replace('d-none', 'd-flex');
		} catch (e) {
			console.log(e);
			failureEl.classList.replace('d-none', 'd-flex');
		} finally {
			detailsEl.classList.remove('opacity-50');
			idEl.focus();
		}
	});
}

function handleDeleteStrategy(ok, name) {
	if (!ok) {
		return;
	}

	const $modal = this;

	del(`/plugins/oauth2-multiple/strategies/${name}`).then(async ({ strategies }) => {
		const html = await render('admin/plugins/sso-oauth2-multiple', { strategies }, 'strategies');
		const tbodyEl = document.querySelector('#strategies tbody');
		tbodyEl.innerHTML = html;
		$modal.modal('hide');
	}).catch(error);
}

// function saveSettings() {
// 	settings.save('sso-oauth2-multiple', $('.sso-oauth2-multiple-settings'));
// }
