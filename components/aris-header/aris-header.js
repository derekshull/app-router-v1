(function() {
'use strict';

var supportsShadowDOMV1 = !!HTMLElement.prototype.attachShadow;

var makeTemplate = function (strings, ...substs) {
    let html = '';
    for (let i = 0; i < substs.length; i++) {
        html += strings[i];
        html += substs[i];
    }
    html += strings[strings.length - 1];
    let template = document.createElement('template');
    template.innerHTML = html;
    return template;
}

class arisHeader extends HTMLElement {
  static get is() { return 'aris-header'; }

  static get template() {
    if (!this._template) {
      this._template = makeTemplate`
            <!-- inject-style src="./processing/aris-header/aris-header.css" -->
			<section id="arisHeader">
				<slot name="h1"></slot>
				<span class="caret-right"></span>
				<slot name="h2"></slot>
			</section>
      `;
    }
    return this._template;
  }

  constructor() {
    super();
  }

  connectedCallback() {
    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(document.importNode(arisHeader.template.content, true));

    // Shim styles, CSS custom props, etc. if native Shadow DOM isn't available.
    if (!supportsShadowDOMV1) {
      ShadyCSS.applyStyle(this);
    }

    if (this.innerHTML.indexOf("h2") != -1) {
      shadowRoot.querySelector('.caret-right').classList.add("caret-visible");
    }
  }
}

ShadyCSS.prepareTemplate(arisHeader.template, arisHeader.is);
window.customElements.define(arisHeader.is, arisHeader);

})();