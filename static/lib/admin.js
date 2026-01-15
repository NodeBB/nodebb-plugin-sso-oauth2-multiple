'use strict';

// import * as settings from 'settings';
import { alert as bootboxAlert, confirm } from 'bootbox';
import { get, post, del } from 'api';
import { alert, error } from 'alerts';
import { render } from 'benchpress';
import { save, load } from 'settings';

export function init() {
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
						onShown: function () {
							handleAutoDiscovery.call(this);
							handleIconUpload.call(this);
						},
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
						onShown: function () {
							handleAutoDiscovery.call(this);
							handleIconUpload.call(this);
						},
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
					bootboxAlert({
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

	handleSettingsForm();
	handleAssociations();
}

function handleSettingsForm() {
	load('sso-oauth2-multiple', $('.sso-oauth2-multiple-settings'), () => {
		const fieldset = document.getElementById('associations');
		const selectEls = fieldset.querySelectorAll('select[data-value]');
		if (selectEls.length) {
			selectEls.forEach((el) => {
				const value = el.getAttribute('data-value');
				const optionEl = el.querySelector(`option[value="${value}"]`);
				optionEl.selected = true;
			});
		}

		// settings.load shoves all the values into the first association input, so
		// the roles all start out disabled so that they don't get overridden
		const domainEls = fieldset.querySelectorAll('input[disabled]');
		domainEls.forEach((el) => {
			el.disabled = false;
		});
	});

	$('#save').on('click', () => {
		save('sso-oauth2-multiple', $('.sso-oauth2-multiple-settings')); // pass in a function in the 3rd parameter to override the default success/failure handler
	});
}

function handleAssociations() {
	const addEl = document.querySelector('[data-action="add"]');
	const fieldset = document.getElementById('associations');
	if (!addEl || !fieldset) {
		return;
	}

	addEl.addEventListener('click', async () => {
		let html = await render(`partials/group-association-field${ajaxify.data.isV2 ? '-v2' : ''}`, {
			groupNames: ajaxify.data.groupNames,
		});
		html = new DOMParser().parseFromString(html, 'text/html').body.childNodes;
		fieldset.append(...html);
	});

	fieldset.addEventListener('click', (e) => {
		const subselector = e.target.closest('[data-action="remove"]');
		if (!subselector) {
			return;
		}

		const row = subselector.closest('.association');
		row.remove();
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

		alert({
			alert_id: 'oauth-change-restart-prompt',
			title: 'Restart may be required',
			message: 'You may need to restart your NodeBB for changes to take effect.<br /><br />You can click this box to do so now.',
			type: 'info',
			timeout: 8000,
			clickfn: () => {
				socket.emit('admin.restart');
			},
		});
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

function handleIconUpload() {
	const modalEl = this;
	const fileEl = modalEl.querySelector('#iconFile');
	const iconUrlEl = modalEl.querySelector('input[name="iconUrl"]');
	const previewEl = modalEl.querySelector('#iconPreview');
	const removeEl = modalEl.querySelector('#removeIcon');

	if (!fileEl || !iconUrlEl) {
		return;
	}

	const updatePreview = (url) => {
		if (!previewEl) {
			return;
		}
		if (url) {
			previewEl.src = url;
			previewEl.classList.remove('d-none');
		} else {
			previewEl.removeAttribute('src');
			previewEl.classList.add('d-none');
		}
	};

	updatePreview(iconUrlEl.value);

	fileEl.addEventListener('change', () => {
		const file = fileEl.files && fileEl.files[0];
		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			alert({
				type: 'danger',
				message: 'Icon upload must be an image file.',
			});
			fileEl.value = '';
			return;
		}

		const maxBytes = 100 * 1024;
		if (file.size > maxBytes) {
			alert({
				type: 'danger',
				message: 'Icon upload must be 100KB or smaller.',
			});
			fileEl.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			iconUrlEl.value = reader.result;
			if (removeEl) {
				removeEl.checked = false;
			}
			updatePreview(reader.result);
		};
		reader.readAsDataURL(file);
	});

	if (removeEl) {
		removeEl.addEventListener('change', () => {
			if (!removeEl.checked) {
				return;
			}
			fileEl.value = '';
			iconUrlEl.value = '';
			updatePreview('');
		});
	}
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
// settings.save('sso-oauth2-multiple', $('.sso-oauth2-multiple-settings'));
// }
