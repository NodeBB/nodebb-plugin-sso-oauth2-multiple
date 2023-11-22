<form role="form">
	<div class="row">
		<div class="col-sm-6">
			<div class="form-check form-switch">
				<input type="checkbox" class="form-check-input" id="enabled" name="enabled" {{{ if ./enabled }}}checked{{{ end }}}>
				<label for="enabled" class="form-check-label">Enabled</label>
			</div>

			<div class="mb-3">
				<label class="form-label" for="name">Name</label>
				<input type="text" id="name" name="name" title="Name" class="form-control" placeholder="Name" value="{./name}" {{{ if ./name }}}readonly{{{ end }}}>
				<p class="form-text">
					Enter something unique to your OAuth provider in lowercase, like <code>github</code>, or <code>nodebb</code>.
				</p>
			</div>

			<div class="mb-3">
				<label class="form-label" for="domain">Domain</label>
				<div class="input-group">
					<input type="text" id="domain" name="domain" title="domain" class="form-control" placeholder="foo.example.org">
					<span class="input-group-text text-success d-none" id="discovery-success">&check;</span>
					<span class="input-group-text text-warning d-none" id="discovery-failure">&cross;</span>
				</div>
				<p class="form-text">
					<strong>Optional</strong> — fill in a domain to automatically discover the URLs if provided by the server.
				</p>
			</div>

			<hr />

			<div class="mb-3">
				<label class="form-label" for="faIcon">FontAwesome Icon</label>
				<input type="text" id="name" name="faIcon" title="Name" class="form-control" placeholder="FontAwesome Icon" value="{./faIcon}">
				<p class="form-text">
					<strong>Optional</strong> — enter the name of the FontAwesome icon you wish to use in the login/register button.
					If none is set, then <i class="fa fa-right-to-bracket"></i> will be used.
				</p>
			</div>

			<div class="mb-3">
				<label class="form-label" for="loginLabel">&quot;Login&quot; Label Text</label>
				<input type="text" id="name" name="loginLabel" title="Name" class="form-control" placeholder="Log in via..." value="{./loginLabel}">
			</div>

			<div class="mb-3">
				<label class="form-label" for="registerLabel">&quot;Register&quot; Label Text</label>
				<input type="text" id="name" name="registerLabel" title="Name" class="form-control" placeholder="Register via..." value="{./registerLabel}">
			</div>
		</div>
		<div class="col-sm-6">
			<fieldset id="details">
				<div class="mb-3">
					<label class="form-label" for="authUrl">Authorization URL</label>
					<input type="text" id="authUrl" name="authUrl" title="Authorization URL" class="form-control" placeholder="https://..." value="{./authUrl}">
				</div>

				<div class="mb-3">
					<label class="form-label" for="tokenUrl">Token URL</label>
					<input type="text" id="tokenUrl" name="tokenUrl" title="Token URL" class="form-control" placeholder="https://..." value="{./tokenUrl}">
				</div>

				<div class="mb-3">
					<label class="form-label" for="id">Client ID</label>
					<input type="text" id="id" name="id" title="Client ID" class="form-control" value="{./id}">
				</div>

				<div class="mb-3">
					<label class="form-label" for="secret">Client Secret</label>
					<input type="text" id="secret" name="secret" title="Client Secret" class="form-control" value="{./secret}">
				</div>

				<div class="mb-3">
					<label class="form-label" for="userRoute">User Info URL</label>
					<input type="text" id="userRoute" name="userRoute" title="User Info URL" class="form-control" placeholder="/userinfo" value="{./userRoute}">
					<p class="form-text">
						If a relative path is specified here, we will assume the hostname from the authorization URL.
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="scope">Scope</label>
					<input type="text" id="scope" name="scope" title="User Info URL" class="form-control" placeholder="openid email profile" value="{./scope}">
					<p class="form-text">
						Scopes are used to limit the information returned by the user info URL to only that which is necessary.
						Different implementations use different values.
					</p>
					<p class="form-text">
						<strong>Default</strong> &mdash; <code>openid email profile</code>
					</p>
				</div>
			</fieldset>
		</div>
	</div>
	<div class="row border-top mt-3 pt-3">
		<div class="col-12">
			<details>
				<summary>
					<div class="d-inline-flex flex-column">
						<h6>Adjustments</h6>
						<p class="form-text">
							Occasionally, some providers may have slightly different implementations that require adjustments on this end.
							We offer some common adjustments below.
						</p>
					</div>
				</summary>

				<div class="row">
					<div class="col-sm-6">
						<div class="form-check form-switch mb-3">
							<input type="checkbox" class="form-check-input" id="usernameViaEmail" name="usernameViaEmail" {{{ if (./usernameViaEmail == "on") }}}checked{{{ end }}}>
							<label for="usernameViaEmail" class="form-check-label">Fall back to email as username if no username available (e.g. <code><strong>username</strong>@example.org</code>)</label>
						</div>
					</div>
					<div class="col-sm-6">
						<div class="mb-3">
							<label class="form-label" for="idKey">Alternative <code>id</code> key</label>
							<input type="text" id="idKey" name="idKey" title="Alternative id key" class="form-control" placeholder="e.g. auth0Id" value="{./idKey}">
							<p class="form-text">
								The properties <code>id</code> and <code>sub</code> are normally used.
								In case you wish to use an alternative key returned in the User Info URL as the key, enter it here.
								If that field is empty or missing, then we will fall back to the defaults.
							</p>
						</div>
					</div>
				</div>
			</details>
		</div>
	</div>
</form>