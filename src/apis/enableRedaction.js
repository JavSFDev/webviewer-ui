/**
 * Enables redaction feature, affecting any elements related to redaction.
 * @method CoreControls.ReaderControl#enableRedaction
 * @example // enable redaction feature
viewerElement.addEventListener('ready', () => {
  const instance = viewer.getInstance();
  instance.enableRedaction();
});
 */

import actions from 'actions';
import core from 'core';
import disableRedaction from './disableRedaction';

export default store => (enable = true) =>  {

  if (enable) {
    store.dispatch(actions.enableElement('redactionButton', 1));
    core.enableRedaction(true);

    if (!core.isFullPDFEnabled()) {
      console.warn('Full api is not enabled, applying redactions is disabled');
    }
  } else {
    disableRedaction(store)();
  }
};