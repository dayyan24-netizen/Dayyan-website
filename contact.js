/* ─── CONTACT PAGE — FORM HANDLING ─────────────────────────────────────────── */

(function() {
  'use strict';

  var form    = document.querySelector('.contact-form');
  var success = document.getElementById('form-success');
  var submit  = form ? form.querySelector('.contact-form__submit') : null;

  if (!form) return;

  form.addEventListener('submit', function(e) {
    /* If using Formspree, let the form POST normally.
       This handler enhances with async submission if fetch is available. */
    if (!window.fetch) return;

    e.preventDefault();

    var data     = new FormData(form);
    var action   = form.getAttribute('action');

    /* Bail out gracefully if the form action hasn't been configured yet */
    if (!action || action.indexOf('YOUR_FORM_ID') !== -1) {
      alert('Contact form not yet configured. Please email dfundi@lakeforest.edu directly.');
      return;
    }

    /* Button loading state */
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sending...';
    }

    fetch(action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    })
    .then(function(res) {
      if (res.ok) {
        /* Show success state */
        form.querySelectorAll('.contact-form__field, .contact-form__row, .contact-form__footer')
          .forEach(function(el) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
        if (success) {
          success.hidden = false;
          success.removeAttribute('hidden');
        }
      } else {
        throw new Error('Server error');
      }
    })
    .catch(function() {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Send Message';
      }
      alert('Something went wrong. Please email dfundi@lakeforest.edu directly.');
    });
  });

})();
