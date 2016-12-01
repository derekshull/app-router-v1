(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());
'use strict';

//FUNCTIONS
function removeClass(selector, myClass) {
    // get all elements that match our selector
    elements = document.querySelectorAll(selector);

    // remove class from all chosen elements
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.remove(myClass);
    }
}

function addClass(selector, myClass) {

    // get all elements that match our selector
    elements = document.querySelectorAll(selector);

    // add class to all chosen elements
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add(myClass);
    }
}

//FASTCLICK LISTENER
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function () {
        FastClick.attach(document.body);
    }, false);
}

//THINGS TO DO WHEN WEB COMPONENTS ARE DONE LOADING
window.addEventListener('WebComponentsReady', function () {
    //after the web components have loaded
    //THINGS TO RUN ONCE A PARTIAL HAS LOADED
    var router = document.querySelector('app-router'); //get app-router

    router.addEventListener('activate-route-start', function (event) {
        if (event.detail.oldRoute) {
            (function () {
                var newRoute = event.detail.route;
                var oldRoute = event.detail.oldRoute;

                oldRoute.classList.add("route-moveOut");
                setTimeout(function () {
                    oldRoute.classList.remove("route-moveOut");
                }, 500);
            })();
        }
    });

    router.addEventListener('activate-route-end', function (event) {
        Prism.highlightAll();
    });
    router.init(); //initiate the router to go to the new route
});
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

(function () {
    var supportsShadowDOMV1 = !!HTMLElement.prototype.attachShadow;
    var utilities = {};
    var importedURIs = {};
    var isIE = 'ActiveXObject' in window;
    var isEdge = !!window.navigator.userAgent.match(/Edge/);
    var previousUrl = {};

    var AppRouter = function (_HTMLElement) {
        _inherits(AppRouter, _HTMLElement);

        _createClass(AppRouter, [{
            key: 'fire',


            // fire(type, detail, node) - Fire a new CustomEvent(type, detail) on the node
            //
            // listen with document.querySelector('app-router').addEventListener(type, function(event) {
            //   event.detail, event.preventDefault()
            // })
            value: function fire(type, detail, node) {
                // create a CustomEvent the old way for IE9/10 support
                var event = document.createEvent('CustomEvent');

                // initCustomEvent(type, bubbles, cancelable, detail)
                event.initCustomEvent(type, false, true, detail);

                // returns false when event.preventDefault() is called, true otherwise
                return node.dispatchEvent(event);
            }

            // Find the first <app-route> that matches the current URL and change the active route

        }, {
            key: 'stateChange',
            value: function stateChange(router) {
                var url = this.parseUrl(window.location.href, router.getAttribute('mode'));

                // don't load a new route if only the hash fragment changed
                if (url.hash !== previousUrl.hash && url.path === previousUrl.path && url.search === previousUrl.search && url.isHashPath === previousUrl.isHashPath) {
                    if (router.getAttribute('scroll-to-hash') !== 'disabled') {
                        this.scrollToHash(url.hash);
                    }
                    previousUrl = url;
                    return;
                }
                previousUrl = url;

                // fire a state-change event on the app-router and return early if the user called event.preventDefault()
                var eventDetail = {
                    path: url.path,
                    state: window.history.state
                };
                if (!this.fire('state-change', eventDetail, router)) {
                    return;
                }

                // find the first matching route
                var route = router.firstElementChild;
                while (route) {
                    if (route.tagName === 'APP-ROUTE' && this.testRoute(route.getAttribute('path'), url.path, router.getAttribute('trailingSlash'), route.hasAttribute('regex'))) {
                        this.activateRoute(router, route, url);
                        return;
                    }
                    route = route.nextSibling;
                }

                this.fire('not-found', eventDetail, router);
            }

            // Activate the route

        }, {
            key: 'activateRoute',
            value: function activateRoute(router, route, url) {
                if (route.hasAttribute('redirect')) {
                    router.go(route.getAttribute('redirect'), { replace: true });
                    return;
                }

                // if we're on the same route and `onUrlChange="noop"` then don't reload the route or update the model
                if (route === router.activeRoute && route.getAttribute('onUrlChange') === 'noop') {
                    return;
                }

                var eventDetail = {
                    path: url.path,
                    route: route,
                    oldRoute: router.activeRoute,
                    state: window.history.state
                };

                if (!this.fire('activate-route-start', eventDetail, router)) {
                    return;
                }
                if (!this.fire('activate-route-start', eventDetail, route)) {
                    return;
                }

                // keep track of the route currently being loaded
                router.loadingRoute = route;

                // if we're on the same route and `onUrlChange="updateModel"` then update the model but don't replace the page content
                if (route === router.activeRoute && route.getAttribute('onUrlChange') === 'updateModel') {
                    this.updateModelAndActivate(router, route, url, eventDetail);
                }
                // import custom element or template
                else if (route.hasAttribute('import')) {
                        this.importAndActivate(router, route.getAttribute('import'), route, url, eventDetail);
                    }
                    // pre-loaded custom element
                    else if (route.hasAttribute('element')) {
                            this.activateCustomElement(router, route.getAttribute('element'), route, url, eventDetail);
                        }
                        // inline template
                        else if (route.firstElementChild && route.firstElementChild.tagName === 'TEMPLATE') {
                                // mark the route as an inline template so we know how to clean it up when we remove the route's content
                                route.isInlineTemplate = true;
                                this.activateTemplate(router, route.firstElementChild, route, url, eventDetail);
                            }
            }

            // If we are only hiding and showing the route, update the model and activate the route

        }, {
            key: 'updateModelAndActivate',
            value: function updateModelAndActivate(router, route, url, eventDetail) {
                var model = this.createModel(router, route, url, eventDetail);

                if (route.hasAttribute('template') || route.isInlineTemplate) {
                    // update the template model
                    this.setObjectProperties(route.lastElementChild.templateInstance.model, model);
                } else {
                    // update the custom element model
                    this.setObjectProperties(route.firstElementChild, model);
                }

                this.fire('activate-route-end', eventDetail, router);
                this.fire('activate-route-end', eventDetail, eventDetail.route);
            }

            // Import and activate a custom element or template

        }, {
            key: 'importAndActivate',
            value: function importAndActivate(router, importUri, route, url, eventDetail) {
                var importLink;
                function importLoadedCallback() {
                    importLink.loaded = true;
                    this.activateImport(router, importLink, importUri, route, url, eventDetail);
                }
                function importErrorCallback(event) {
                    var errorDetail = {
                        errorEvent: event,
                        importUri: importUri,
                        routeDetail: eventDetail
                    };
                    this.fire('import-error', errorDetail, router);
                    this.fire('import-error', errorDetail, route);
                }

                if (!importedURIs.hasOwnProperty(importUri)) {
                    // hasn't been imported yet
                    importLink = document.createElement('link');
                    importLink.setAttribute('rel', 'import');
                    importLink.setAttribute('href', importUri);
                    importLink.setAttribute('async', 'async');
                    importLink.addEventListener('load', importLoadedCallback);
                    importLink.addEventListener('error', importErrorCallback);
                    importLink.loaded = false;
                    document.head.appendChild(importLink);
                    importedURIs[importUri] = importLink;
                } else {
                    // previously imported. this is an async operation and may not be complete yet.
                    importLink = importedURIs[importUri];
                    if (!importLink.loaded) {
                        importLink.addEventListener('load', importLoadedCallback);
                        importLink.addEventListener('error', importErrorCallback);
                    } else {
                        this.activateImport(router, importLink, importUri, route, url, eventDetail);
                    }
                }
            }

            // Activate the imported custom element or template

        }, {
            key: 'activateImport',
            value: function activateImport(router, importLink, importUri, route, url, eventDetail) {
                // allow referencing the route's import link in the activate-route-end callback
                route.importLink = importLink;

                // make sure the user didn't navigate to a different route while it loaded
                if (route === router.loadingRoute) {
                    if (route.hasAttribute('template')) {
                        // template
                        var templateId = route.getAttribute('template');
                        var template;
                        if (templateId) {
                            template = importLink.import.getElementById(templateId);
                        } else {
                            template = importLink.import.querySelector('template');
                        }
                        this.activateTemplate(router, template, route, url, eventDetail);
                    } else {
                        // custom element
                        this.activateCustomElement(router, route.getAttribute('element') || importUri.split('/').slice(-1)[0].replace('.html', ''), route, url, eventDetail);
                    }
                }
            }

            // Data bind the custom element then activate it

        }, {
            key: 'activateCustomElement',
            value: function activateCustomElement(router, elementName, route, url, eventDetail) {
                var customElement = document.createElement(elementName);
                var model = this.createModel(router, route, url, eventDetail);
                this.setObjectProperties(customElement, model);
                this.activateElement(router, customElement, url, eventDetail);
            }

            // Create an instance of the template

        }, {
            key: 'activateTemplate',
            value: function activateTemplate(router, template, route, url, eventDetail) {
                var templateInstance;
                var model = this.createModel(router, route, url, eventDetail);
                if ('createInstance' in template) {
                    // template.createInstance(model) is a Polymer method that binds a model to a template and also fixes
                    // https://github.com/erikringsmuth/app-router/issues/19
                    //var model = createModel(router, route, url, eventDetail);
                    templateInstance = template.createInstance(model);
                } else {
                    templateInstance = document.importNode(template.content, true);
                    for (var key in model) {
                        route.setAttribute(key, model[key]);
                    }
                }
                this.activateElement(router, templateInstance, url, eventDetail);
            }

            // Create the route's model

        }, {
            key: 'createModel',
            value: function createModel(router, route, url, eventDetail) {
                var model = this.routeArguments(route.getAttribute('path'), url.path, url.search, route.hasAttribute('regex'), router.getAttribute('typecast') === 'auto');
                if (route.hasAttribute('bindRouter') || router.hasAttribute('bindRouter')) {
                    model.router = router;
                }
                eventDetail.model = model;
                this.fire('before-data-binding', eventDetail, router);
                this.fire('before-data-binding', eventDetail, eventDetail.route);
                return eventDetail.model;
            }

            // Copy properties from one object to another

        }, {
            key: 'setObjectProperties',
            value: function setObjectProperties(object, model) {
                for (var property in model) {
                    if (model.hasOwnProperty(property)) {
                        object[property] = model[property];
                    }
                }
            }

            // Replace the active route's content with the new element

        }, {
            key: 'activateElement',
            value: function activateElement(router, element, url, eventDetail) {
                // when using core-animated-pages, the router doesn't remove the previousRoute's content right away. if you
                // navigate between 3 routes quickly (ex: /a -> /b -> /c) you might set previousRoute to '/b' before '/a' is
                // removed from the DOM. this verifies old content is removed before switching the reference to previousRoute.
                this.deactivateRoute(router.previousRoute);

                // update references to the activeRoute, previousRoute, and loadingRoute
                router.previousRoute = router.activeRoute;
                router.activeRoute = router.loadingRoute;
                router.loadingRoute = null;
                if (router.previousRoute) {
                    router.previousRoute.removeAttribute('active');
                }
                router.activeRoute.setAttribute('active', 'active');

                // remove the old route's content before loading the new route. core-animated-pages temporarily needs the old and
                // new route in the DOM at the same time to animate the transition, otherwise we can remove the old route's content
                // right away. there is one exception for core-animated-pages where the route we're navigating to matches the same
                // route (ex: path="/article/:id" navigating from /article/0 to /article/1). in this case we have to simply replace
                // the route's content instead of animating a transition.
                if (!router.hasAttribute('core-animated-pages') || eventDetail.route === eventDetail.oldRoute) {
                    this.deactivateRoute(router.previousRoute);
                }

                // add the new content
                router.activeRoute.appendChild(element);

                // animate the transition if core-animated-pages are being used
                if (router.hasAttribute('core-animated-pages')) {
                    router.coreAnimatedPages.selected = router.activeRoute.getAttribute('path');
                    // the 'core-animated-pages-transition-end' event handler in init() will call deactivateRoute() on the previousRoute
                }

                // scroll to the URL hash if it's present
                if (url.hash && !router.hasAttribute('core-animated-pages') && router.getAttribute('scroll-to-hash') !== 'disabled') {
                    this.scrollToHash(url.hash);
                }

                this.fire('activate-route-end', eventDetail, router);
                this.fire('activate-route-end', eventDetail, eventDetail.route);
            }

            // Remove the route's content

        }, {
            key: 'deactivateRoute',
            value: function deactivateRoute(route) {
                if (route) {
                    // remove the route content
                    var node = route.firstChild;

                    // don't remove an inline <template>
                    if (route.isInlineTemplate) {
                        node = route.querySelector('template').nextSibling;
                    }

                    while (node) {
                        var nodeToRemove = node;
                        node = node.nextSibling;
                        route.removeChild(nodeToRemove);
                    }
                }
            }

            // scroll to the element with id="hash" or name="hash"

        }, {
            key: 'scrollToHash',
            value: function scrollToHash(hash) {
                if (!hash) return;

                // wait for the browser's scrolling to finish before we scroll to the hash
                // ex: http://example.com/#/page1#middle
                // the browser will scroll to an element with id or name `/page1#middle` when the page finishes loading. if it doesn't exist
                // it will scroll to the top of the page. let the browser finish the current event loop and scroll to the top of the page
                // before we scroll to the element with id or name `middle`.
                setTimeout(function () {
                    var hashElement;
                    try {
                        hashElement = document.querySelector('html /deep/ ' + hash) || document.querySelector('html /deep/ [name="' + hash.substring(1) + '"]');
                    } catch (e) {
                        // DOM exception 12 (unknown selector) is thrown in Firefox, Safari etc. when using Polymer 1.x Shady DOM mode
                        hashElement = document.querySelector(hash) || document.querySelector('[name="' + hash.substring(1) + '"]');
                    }
                    if (hashElement && hashElement.scrollIntoView) {
                        hashElement.scrollIntoView(true);
                    }
                }, 0);
            }

            // parseUrl(location, mode) - Augment the native URL() constructor to get info about hash paths
            //
            // Example parseUrl('http://domain.com/other/path?queryParam3=false#/example/path?queryParam1=true&queryParam2=example%20string#middle', 'auto')
            //
            // returns {
            //   path: '/example/path',
            //   hash: '#middle'
            //   search: '?queryParam1=true&queryParam2=example%20string',
            //   isHashPath: true
            // }
            //
            // Note: The location must be a fully qualified URL with a protocol like 'http(s)://'

        }, {
            key: 'parseUrl',
            value: function parseUrl(location, mode) {
                var url = {
                    isHashPath: mode === 'hash'
                };

                if (typeof URL === 'function') {
                    // browsers that support `new URL()`
                    var nativeUrl = new URL(location);
                    url.path = nativeUrl.pathname;
                    url.hash = nativeUrl.hash;
                    url.search = nativeUrl.search;
                } else {
                    // IE
                    var anchor = document.createElement('a');
                    anchor.href = location;
                    url.path = anchor.pathname;
                    if (url.path.charAt(0) !== '/') {
                        url.path = '/' + url.path;
                    }
                    url.hash = anchor.hash;
                    url.search = anchor.search;
                }

                if (mode !== 'pushstate') {
                    // auto or hash

                    // check for a hash path
                    if (url.hash.substring(0, 2) === '#/') {
                        // hash path
                        url.isHashPath = true;
                        url.path = url.hash.substring(1);
                    } else if (url.hash.substring(0, 3) === '#!/') {
                        // hashbang path
                        url.isHashPath = true;
                        url.path = url.hash.substring(2);
                    } else if (url.isHashPath) {
                        // still use the hash if mode="hash"
                        if (url.hash.length === 0) {
                            url.path = '/';
                        } else {
                            url.path = url.hash.substring(1);
                        }
                    }

                    if (url.isHashPath) {
                        url.hash = '';

                        // hash paths might have an additional hash in the hash path for scrolling to a specific part of the page #/hash/path#elementId
                        var secondHashIndex = url.path.indexOf('#');
                        if (secondHashIndex !== -1) {
                            url.hash = url.path.substring(secondHashIndex);
                            url.path = url.path.substring(0, secondHashIndex);
                        }

                        // hash paths get the search from the hash if it exists
                        var searchIndex = url.path.indexOf('?');
                        if (searchIndex !== -1) {
                            url.search = url.path.substring(searchIndex);
                            url.path = url.path.substring(0, searchIndex);
                        }
                    }
                }

                return url;
            }

            // testRoute(routePath, urlPath, trailingSlashOption, isRegExp) - Test if the route's path matches the URL's path
            //
            // Example routePath: '/user/:userId/**'
            // Example urlPath = '/user/123/bio'

        }, {
            key: 'testRoute',
            value: function testRoute(routePath, urlPath, trailingSlashOption, isRegExp) {
                // try to fail or succeed as quickly as possible for the most common cases

                // handle trailing slashes (options: strict (default), ignore)
                if (trailingSlashOption === 'ignore') {
                    // remove trailing / from the route path and URL path
                    if (urlPath.slice(-1) === '/') {
                        urlPath = urlPath.slice(0, -1);
                    }
                    if (routePath.slice(-1) === '/' && !isRegExp) {
                        routePath = routePath.slice(0, -1);
                    }
                }

                // test regular expressions
                if (isRegExp) {
                    return this.testRegExString(routePath, urlPath);
                }

                // if the urlPath is an exact match or '*' then the route is a match
                if (routePath === urlPath || routePath === '*') {
                    return true;
                }

                // relative routes a/b/c are the same as routes that start with a globstar /**/a/b/c
                if (routePath.charAt(0) !== '/') {
                    routePath = '/**/' + routePath;
                }

                // recursively test if the segments match (start at 1 because 0 is always an empty string)
                return this.segmentsMatch(routePath.split('/'), 1, urlPath.split('/'), 1);
            }

            // segmentsMatch(routeSegments, routeIndex, urlSegments, urlIndex, pathVariables)
            // recursively test the route segments against the url segments in place (without creating copies of the arrays
            // for each recursive call)
            //
            // example routeSegments ['', 'user', ':userId', '**']
            // example urlSegments ['', 'user', '123', 'bio']

        }, {
            key: 'segmentsMatch',
            value: function segmentsMatch(routeSegments, routeIndex, urlSegments, urlIndex, pathVariables) {
                var routeSegment = routeSegments[routeIndex];
                var urlSegment = urlSegments[urlIndex];

                // if we're at the last route segment and it is a globstar, it will match the rest of the url
                if (routeSegment === '**' && routeIndex === routeSegments.length - 1) {
                    return true;
                }

                // we hit the end of the route segments or the url segments
                if (typeof routeSegment === 'undefined' || typeof urlSegment === 'undefined') {
                    // return true if we hit the end of both at the same time meaning everything else matched, else return false
                    return routeSegment === urlSegment;
                }

                // if the current segments match, recursively test the remaining segments
                if (routeSegment === urlSegment || routeSegment === '*' || routeSegment.charAt(0) === ':') {
                    // store the path variable if we have a pathVariables object
                    if (routeSegment.charAt(0) === ':' && typeof pathVariables !== 'undefined') {
                        pathVariables[routeSegment.substring(1)] = urlSegments[urlIndex];
                    }
                    return this.segmentsMatch(routeSegments, routeIndex + 1, urlSegments, urlIndex + 1, pathVariables);
                }

                // globstars can match zero to many URL segments
                if (routeSegment === '**') {
                    // test if the remaining route segments match any combination of the remaining url segments
                    for (var i = urlIndex; i < urlSegments.length; i++) {
                        if (this.segmentsMatch(routeSegments, routeIndex + 1, urlSegments, i, pathVariables)) {
                            return true;
                        }
                    }
                }

                // all tests failed, the route segments do not match the url segments
                return false;
            }

            // routeArguments(routePath, urlPath, search, isRegExp) - Gets the path variables and query parameter values from the URL

        }, {
            key: 'routeArguments',
            value: function routeArguments(routePath, urlPath, search, isRegExp, typecast) {
                var args = {};

                // regular expressions can't have path variables
                if (!isRegExp) {
                    // relative routes a/b/c are the same as routes that start with a globstar /**/a/b/c
                    if (routePath.charAt(0) !== '/') {
                        routePath = '/**/' + routePath;
                    }

                    // get path variables
                    // urlPath '/customer/123'
                    // routePath '/customer/:id'
                    // parses id = '123'
                    this.segmentsMatch(routePath.split('/'), 1, urlPath.split('/'), 1, args);
                }

                var queryParameters = search.substring(1).split('&');
                // split() on an empty string has a strange behavior of returning [''] instead of []
                if (queryParameters.length === 1 && queryParameters[0] === '') {
                    queryParameters = [];
                }
                for (var i = 0; i < queryParameters.length; i++) {
                    var queryParameter = queryParameters[i];
                    var queryParameterParts = queryParameter.split('=');
                    args[queryParameterParts[0]] = queryParameterParts.splice(1, queryParameterParts.length - 1).join('=');
                }

                if (typecast) {
                    // parse the arguments into unescaped strings, numbers, or booleans
                    for (var arg in args) {
                        args[arg] = this.typecast(args[arg]);
                    }
                }

                return args;
            }

            // typecast(value) - Typecast the string value to an unescaped string, number, or boolean

        }, {
            key: 'typecast',
            value: function typecast(value) {
                // bool
                if (value === 'true') {
                    return true;
                }
                if (value === 'false') {
                    return false;
                }

                // number
                if (!isNaN(value) && value !== '' && value.charAt(0) !== '0') {
                    return +value;
                }

                // string
                return decodeURIComponent(value);
            }

            // testRegExString(pattern, value) - Parse HTML attribute path="/^\/\w+\/\d+$/i" to a regular
            // expression `new RegExp('^\/\w+\/\d+$', 'i')` and test against it.
            //
            // note that 'i' is the only valid option. global 'g', multiline 'm', and sticky 'y' won't be valid matchers for a path.

        }, {
            key: 'testRegExString',
            value: function testRegExString(pattern, value) {
                if (pattern.charAt(0) !== '/') {
                    // must start with a slash
                    return false;
                }
                pattern = pattern.slice(1);
                var options = '';
                if (pattern.slice(-1) === '/') {
                    pattern = pattern.slice(0, -1);
                } else if (pattern.slice(-2) === '/i') {
                    pattern = pattern.slice(0, -2);
                    options = 'i';
                } else {
                    // must end with a slash followed by zero or more options
                    return false;
                }
                return new RegExp(pattern, options).test(value);
            }
        }], [{
            key: 'is',
            get: function get() {
                return 'app-router';
            }
        }, {
            key: 'util',
            get: function get() {
                return utilities;
            }

            // Initialize the router

        }, {
            key: 'init',
            get: function get() {
                var router = this;
                if (router.isInitialized) {
                    return;
                }
                router.isInitialized = true;

                // trailingSlash="strict|ignore"
                if (!router.hasAttribute('trailingSlash')) {
                    router.setAttribute('trailingSlash', 'strict');
                }

                // mode="auto|hash|hashbang|pushstate"
                if (!router.hasAttribute('mode')) {
                    router.setAttribute('mode', 'auto');
                }

                // typecast="auto|string"
                if (!router.hasAttribute('typecast')) {
                    router.setAttribute('typecast', 'auto');
                }

                // scroll-to-hash="auto|disabled"
                if (!router.hasAttribute('scroll-to-hash')) {
                    router.setAttribute('scroll-to-hash', 'auto');
                }

                // <app-router core-animated-pages transitions="hero-transition cross-fade">
                if (router.hasAttribute('core-animated-pages')) {
                    // use shadow DOM to wrap the <app-route> elements in a <core-animated-pages> element
                    // <app-router>
                    //   # shadowRoot
                    //   <core-animated-pages>
                    //     # content in the light DOM
                    //     <app-route element="home-page">
                    //       <home-page>
                    //       </home-page>
                    //     </app-route>
                    //   </core-animated-pages>
                    // </app-router>
                    router.shadowRoot = this.attachShadow({ mode: 'open' });
                    router.coreAnimatedPages = document.createElement('core-animated-pages');
                    router.coreAnimatedPages.appendChild(document.createElement('content'));

                    // don't know why it needs to be static, but absolute doesn't display the page
                    router.coreAnimatedPages.style.position = 'static';

                    // toggle the selected page using selected="path" instead of selected="integer"
                    router.coreAnimatedPages.setAttribute('valueattr', 'path');

                    // pass the transitions attribute from <app-router core-animated-pages transitions="hero-transition cross-fade">
                    // to <core-animated-pages transitions="hero-transition cross-fade">
                    router.coreAnimatedPages.setAttribute('transitions', router.getAttribute('transitions'));

                    // set the shadow DOM's content
                    router.shadowRoot.appendChild(router.coreAnimatedPages);

                    // when a transition finishes, remove the previous route's content. there is a temporary overlap where both
                    // the new and old route's content is in the DOM to animate the transition.
                    router.coreAnimatedPages.addEventListener('core-animated-pages-transition-end', function () {
                        // with core-animated-pages, navigating to the same route twice quickly will set the new route to both the
                        // activeRoute and the previousRoute before the animation finishes. we don't want to delete the route content
                        // if it's actually the active route.
                        if (router.previousRoute && !router.previousRoute.hasAttribute('active')) {
                            this.deactivateRoute(router.previousRoute);
                        }
                    });
                }

                // listen for URL change events
                router.stateChangeHandler = stateChange.bind(null, router);
                window.addEventListener('popstate', router.stateChangeHandler, false);
                if (isIE || isEdge) {
                    // IE & Edge bug. A hashchange is supposed to trigger a popstate event, making popstate the only event you
                    // need to listen to. That's not the case in IE & Edge so we make another event listener for it.
                    window.addEventListener('hashchange', router.stateChangeHandler, false);
                }

                // load the web component for the current route
                this.stateChange(router);
            }
        }, {
            key: 'go',
            get: function get() {
                if (this.getAttribute('mode') !== 'pushstate') {
                    // mode == auto, hash or hashbang
                    if (this.getAttribute('mode') === 'hashbang') {
                        path = '#!' + path;
                    } else {
                        path = '#' + path;
                    }
                }
                var currentState = window.history.state;
                if (options && options.replace === true) {
                    window.history.replaceState(currentState, null, path);
                } else {
                    window.history.pushState(currentState, null, path);
                }

                // dispatch a popstate event
                try {
                    var popstateEvent = new PopStateEvent('popstate', {
                        bubbles: false,
                        cancelable: false,
                        state: currentState
                    });

                    if ('dispatchEvent_' in window) {
                        // FireFox with polyfill
                        window.dispatchEvent_(popstateEvent);
                    } else {
                        // normal
                        window.dispatchEvent(popstateEvent);
                    }
                } catch (error) {
                    // Internet Exploder
                    var fallbackEvent = document.createEvent('CustomEvent');
                    fallbackEvent.initCustomEvent('popstate', false, false, { state: currentState });
                    window.dispatchEvent(fallbackEvent);
                }
            }
        }]);

        function AppRouter() {
            _classCallCheck(this, AppRouter);

            return _possibleConstructorReturn(this, (AppRouter.__proto__ || Object.getPrototypeOf(AppRouter)).call(this));
        }

        _createClass(AppRouter, [{
            key: 'connectedCallback',
            value: function connectedCallback() {
                // init="auto|manual"
                if (this.getAttribute('init') !== 'manual') {
                    this.init();
                }
            }
        }, {
            key: 'disconnectedCallback',
            value: function disconnectedCallback() {
                window.removeEventListener('popstate', this.stateChangeHandler, false);
                if (isIE || isEdge) {
                    window.removeEventListener('hashchange', this.stateChangeHandler, false);
                }
            }
        }]);

        return AppRouter;
    }(HTMLElement);

    window.customElements.define(AppRouter.is, AppRouter);
})();

(function () {
    var AppRoute = function (_HTMLElement2) {
        _inherits(AppRoute, _HTMLElement2);

        function AppRoute() {
            _classCallCheck(this, AppRoute);

            return _possibleConstructorReturn(this, (AppRoute.__proto__ || Object.getPrototypeOf(AppRoute)).apply(this, arguments));
        }

        _createClass(AppRoute, null, [{
            key: 'is',
            get: function get() {
                return 'app-route';
            }
        }]);

        return AppRoute;
    }(HTMLElement);

    window.customElements.define(AppRoute.is, AppRoute);
})();
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _templateObject = _taggedTemplateLiteral(['\n            <style>\n:host {\n  display: block;\n  position: relative; }\n\nsection {\n  background-color: #b82216;\n  background: url("/img/bs_header_background.png") center center;\n  background-size: cover;\n  padding: 25px 15px; }\n\n.caret-right {\n  width: 0;\n  height: 0;\n  display: none;\n  vertical-align: middle;\n  border-style: solid;\n  border-width: 5px 0 5px 5px;\n  border-color: transparent transparent transparent rgba(255, 255, 255, 0.7);\n  margin: 0px 5px;\n  position: relative;\n  top: -7px; }\n\n.caret-visible {\n  display: inline-block; }\n\n#arisHeader ::slotted(h1) {\n  color: white;\n  margin: 0px !important;\n  font-family: \'Dosis\', sans-serif;\n  font-weight: 200;\n  font-size: 48px;\n  display: inline-block; }\n\n#arisHeader ::slotted(h2) {\n  color: white;\n  margin: 0;\n  font-family: \'Dosis\', sans-serif;\n  font-weight: 200;\n  font-size: 30px;\n  display: inline-block; }\n\n</style>\n\t\t\t<section id="arisHeader">\n\t\t\t\t<slot name="h1"></slot>\n\t\t\t\t<span class="caret-right"></span>\n\t\t\t\t<slot name="h2"></slot>\n\t\t\t</section>\n      '], ['\n            <style>\n:host {\n  display: block;\n  position: relative; }\n\nsection {\n  background-color: #b82216;\n  background: url("/img/bs_header_background.png") center center;\n  background-size: cover;\n  padding: 25px 15px; }\n\n.caret-right {\n  width: 0;\n  height: 0;\n  display: none;\n  vertical-align: middle;\n  border-style: solid;\n  border-width: 5px 0 5px 5px;\n  border-color: transparent transparent transparent rgba(255, 255, 255, 0.7);\n  margin: 0px 5px;\n  position: relative;\n  top: -7px; }\n\n.caret-visible {\n  display: inline-block; }\n\n#arisHeader ::slotted(h1) {\n  color: white;\n  margin: 0px !important;\n  font-family: \'Dosis\', sans-serif;\n  font-weight: 200;\n  font-size: 48px;\n  display: inline-block; }\n\n#arisHeader ::slotted(h2) {\n  color: white;\n  margin: 0;\n  font-family: \'Dosis\', sans-serif;\n  font-weight: 200;\n  font-size: 30px;\n  display: inline-block; }\n\n</style>\n\t\t\t<section id="arisHeader">\n\t\t\t\t<slot name="h1"></slot>\n\t\t\t\t<span class="caret-right"></span>\n\t\t\t\t<slot name="h2"></slot>\n\t\t\t</section>\n      ']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

(function () {
  'use strict';

  var supportsShadowDOMV1 = !!HTMLElement.prototype.attachShadow;

  var makeTemplate = function makeTemplate(strings) {
    var html = '';

    for (var _len = arguments.length, substs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      substs[_key - 1] = arguments[_key];
    }

    for (var i = 0; i < substs.length; i++) {
      html += strings[i];
      html += substs[i];
    }
    html += strings[strings.length - 1];
    var template = document.createElement('template');
    template.innerHTML = html;
    return template;
  };

  var arisHeader = function (_HTMLElement) {
    _inherits(arisHeader, _HTMLElement);

    _createClass(arisHeader, null, [{
      key: 'is',
      get: function get() {
        return 'aris-header';
      }
    }, {
      key: 'template',
      get: function get() {
        if (!this._template) {
          this._template = makeTemplate(_templateObject);
        }
        return this._template;
      }
    }]);

    function arisHeader() {
      _classCallCheck(this, arisHeader);

      return _possibleConstructorReturn(this, (arisHeader.__proto__ || Object.getPrototypeOf(arisHeader)).call(this));
    }

    _createClass(arisHeader, [{
      key: 'connectedCallback',
      value: function connectedCallback() {
        var shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(document.importNode(arisHeader.template.content, true));

        // Shim styles, CSS custom props, etc. if native Shadow DOM isn't available.
        if (!supportsShadowDOMV1) {
          ShadyCSS.applyStyle(this);
        }

        if (this.innerHTML.indexOf("h2") != -1) {
          shadowRoot.querySelector('.caret-right').classList.add("caret-visible");
        }
      }
    }]);

    return arisHeader;
  }(HTMLElement);

  ShadyCSS.prepareTemplate(arisHeader.template, arisHeader.is);
  window.customElements.define(arisHeader.is, arisHeader);
})();
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Detabinator = function () {
	function Detabinator(element) {
		_classCallCheck(this, Detabinator);

		if (!element) {
			throw new Error('Missing required argument. new Detabinator needs an element reference');
		}
		this._inert = false;
		this._focusableElementsString = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex], [contenteditable]';
		this._focusableElements = Array.from(element.querySelectorAll(this._focusableElementsString));
	}

	_createClass(Detabinator, [{
		key: 'inert',
		get: function get() {
			return this._inert;
		},
		set: function set(isInert) {
			if (this._inert === isInert) {
				return;
			}

			this._inert = isInert;

			this._focusableElements.forEach(function (child) {
				if (isInert) {
					// If the child has an explict tabindex save it
					if (child.hasAttribute('tabindex')) {
						child.__savedTabindex = child.tabIndex;
					}
					// Set ALL focusable children to tabindex -1
					child.setAttribute('tabindex', -1);
				} else {
					// If the child has a saved tabindex, restore it
					// Because the value could be 0, explicitly check that it's not false
					if (child.__savedTabindex === 0 || child.__savedTabindex) {
						return child.setAttribute('tabindex', child.__savedTabindex);
					} else {
						// Remove tabindex from ANY REMAINING children
						child.removeAttribute('tabindex');
					}
				}
			});
		}
	}]);

	return Detabinator;
}();

var SideNav = function () {
	function SideNav() {
		_classCallCheck(this, SideNav);

		this.showButtonEl = document.querySelector('.js-menu-show');
		this.hideButtonEl = document.querySelector('.js-menu-hide');
		this.sideNavEl = document.querySelector('.js-side-nav');
		this.sideNavContainerEl = document.querySelector('.js-side-nav-container');
		this.sideNavLinkEl = document.querySelectorAll('.js-side-nav__link');
		// Control whether the container's children can be focused
		// Set initial state to inert since the drawer is offscreen
		this.detabinator = new Detabinator(this.sideNavContainerEl);
		this.detabinator.inert = true;

		this.showSideNav = this.showSideNav.bind(this);
		this.hideSideNav = this.hideSideNav.bind(this);
		this.blockClicks = this.blockClicks.bind(this);
		this.onTouchStart = this.onTouchStart.bind(this);
		this.onTouchMove = this.onTouchMove.bind(this);
		this.onTouchEnd = this.onTouchEnd.bind(this);
		this.onTransitionEnd = this.onTransitionEnd.bind(this);
		this.update = this.update.bind(this);

		this.startX = 0;
		this.currentX = 0;
		this.touchingSideNav = false;

		this.supportsPassive = undefined;
		this.addEventListeners();
	}

	// apply passive event listening if it's supported


	_createClass(SideNav, [{
		key: 'applyPassive',
		value: function applyPassive() {
			if (this.supportsPassive !== undefined) {
				return this.supportsPassive ? { passive: true } : false;
			}
			// feature detect
			var isSupported = false;
			try {
				document.addEventListener('test', null, { get passive() {
						isSupported = true;
					} });
			} catch (e) {}
			this.supportsPassive = isSupported;
			return this.applyPassive();
		}
	}, {
		key: 'addEventListeners',
		value: function addEventListeners() {
			this.showButtonEl.addEventListener('click', this.showSideNav);
			this.hideButtonEl.addEventListener('click', this.hideSideNav);
			this.sideNavEl.addEventListener('click', this.hideSideNav);
			this.sideNavContainerEl.addEventListener('click', this.blockClicks);
			for (var i = 0; i < this.sideNavLinkEl.length; i++) {
				this.sideNavLinkEl[i].addEventListener('click', this.hideSideNav);
			}

			this.sideNavEl.addEventListener('touchstart', this.onTouchStart, this.applyPassive());
			this.sideNavEl.addEventListener('touchmove', this.onTouchMove, this.applyPassive());
			this.sideNavEl.addEventListener('touchend', this.onTouchEnd);
		}
	}, {
		key: 'onTouchStart',
		value: function onTouchStart(evt) {
			if (!this.sideNavEl.classList.contains('side-nav--visible')) return;

			this.startX = evt.touches[0].pageX;
			this.currentX = this.startX;

			this.touchingSideNav = true;
			requestAnimationFrame(this.update);
		}
	}, {
		key: 'onTouchMove',
		value: function onTouchMove(evt) {
			if (!this.touchingSideNav) return;

			this.currentX = evt.touches[0].pageX;
			var translateX = Math.min(0, this.currentX - this.startX);

			if (translateX < 0) {
				evt.preventDefault();
			}
		}
	}, {
		key: 'onTouchEnd',
		value: function onTouchEnd(evt) {
			if (!this.touchingSideNav) return;

			this.touchingSideNav = false;

			var translateX = Math.min(0, this.currentX - this.startX);
			this.sideNavContainerEl.style.transform = '';

			if (translateX < 0) {
				this.hideSideNav();
			}
		}
	}, {
		key: 'update',
		value: function update() {
			if (!this.touchingSideNav) return;

			requestAnimationFrame(this.update);

			var translateX = Math.min(0, this.currentX - this.startX);
			this.sideNavContainerEl.style.transform = 'translateX(' + translateX + 'px)';
		}
	}, {
		key: 'blockClicks',
		value: function blockClicks(evt) {
			evt.stopPropagation();
		}
	}, {
		key: 'onTransitionEnd',
		value: function onTransitionEnd(evt) {
			this.sideNavEl.classList.remove('side-nav--animatable');
			this.sideNavEl.removeEventListener('transitionend', this.onTransitionEnd);
		}
	}, {
		key: 'showSideNav',
		value: function showSideNav() {
			this.sideNavEl.classList.add('side-nav--animatable');
			this.sideNavEl.classList.add('side-nav--visible');
			this.detabinator.inert = false;
			this.sideNavEl.addEventListener('transitionend', this.onTransitionEnd);
		}
	}, {
		key: 'hideSideNav',
		value: function hideSideNav() {
			this.sideNavEl.classList.add('side-nav--animatable');
			this.sideNavEl.classList.remove('side-nav--visible');
			this.detabinator.inert = true;
			this.sideNavEl.addEventListener('transitionend', this.onTransitionEnd);
		}
	}]);

	return SideNav;
}();

new SideNav();