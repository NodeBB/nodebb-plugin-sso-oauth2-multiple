'use strict';

// import * as settings from 'settings';
import { confirm } from 'bootbox';
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
						callback: handleEditStrategy,
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
						callback: handleEditStrategy,
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
