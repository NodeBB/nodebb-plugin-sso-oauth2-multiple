<div class="mb-3">
	<h4>[[oauth2-multiple:choose-username.title]]</h4>
	<p class="form-text">[[oauth2-multiple:choose-username.intro, {provider}]]</p>
</div>

<div class="mb-3">
	<label class="form-label" for="oauth2m-username">[[user:username]]</label>
	<input type="text" class="form-control" id="oauth2m-username" name="username" value="{suggestedUsername}" required autocomplete="off" minlength="2" maxlength="24">
	<p class="form-text">[[oauth2-multiple:choose-username.help]]</p>
</div>

{{{ if email }}}
<div class="mb-3">
	<label class="form-label">[[user:email]]</label>
	<input type="email" class="form-control" value="{email}" disabled readonly>
	<p class="form-text">[[oauth2-multiple:choose-username.email-provider]]</p>
</div>
{{{ end }}}
