import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import SearchResult from 'components/SearchResult';
import ListSeparator from 'components/ListSeparator';
import ResizeBar from 'components/ResizeBar';
import SearchOverlay from 'components/SearchOverlay';

import core from 'core';
import { isMobile, isTabletOrMobile } from 'helpers/device';
import getClassName from 'helpers/getClassName';
import actions from 'actions';
import selectors from 'selectors';

import './SearchPanel.scss';

class SearchPanel extends React.PureComponent {
  static propTypes = {
    isDisabled: PropTypes.bool,
    isWildCardSearchDisabled: PropTypes.bool,
    isOpen: PropTypes.bool,
    results: PropTypes.arrayOf(PropTypes.object),
    isSearching: PropTypes.bool,
    noResult: PropTypes.bool,
    setActiveResultIndex: PropTypes.func.isRequired,
    closeElements: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
  };

  state = {
    width: 293,
  };

  // this.document = React.createRef();

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      if (isTabletOrMobile()) {
        this.props.closeElements(['leftPanel']);
      }

      this.props.closeElements(['notesPanel']);
    }
  }

  onClickResult = (resultIndex, result) => {
    const { setActiveResultIndex, closeElements } = this.props;

    setActiveResultIndex(resultIndex);
    core.setActiveSearchResult(result);

    if (isMobile()) {
      closeElements('searchPanel');
    }
  };

  onClickClose = () => {
    this.props.closeElements('searchPanel');
  };

  renderListSeparator = (prevResult, currResult) => {
    const isFirstResult = prevResult === currResult;
    const isInDifferentPage = prevResult.page_num !== currResult.page_num;

    if (isFirstResult || isInDifferentPage) {
      return (
        <ListSeparator
          renderContent={() =>
            `${this.props.t('option.shared.page')} ${currResult.page_num + 1}`
          }
        />
      );
    }

    return null;
  };

  render() {
    const { isDisabled, t, results, isSearching, noResult, isWildCardSearchDisabled } = this.props;

    if (isDisabled) {
      return null;
    }

    const className = getClassName('Panel SearchPanel', this.props);

    console.log('isWildCardSearchDisabled', isWildCardSearchDisabled);

    return (
      <div
        className="search-panel-container"
        style={{ width: `${this.state.width}px` }}
      >
        <ResizeBar
          minWidth={215}
          onResize={_width => {
            this.setState({ width: _width });
          }}
          leftDirection
        />
        <div className={className} data-element="searchPanel">
          <SearchOverlay />
          <div className={`results ${isWildCardSearchDisabled ? '' : 'wild-card-visible'}`}>
            {isSearching && (
              <div className="info">{t('message.searching')}</div>
            )}
            {noResult && <div className="info">{t('message.noResults')}</div>}
            {results.map((result, i) => {
              const prevResult = i === 0 ? results[0] : results[i - 1];

              return (
                <React.Fragment key={i}>
                  {this.renderListSeparator(prevResult, result)}
                  <SearchResult
                    result={result}
                    index={i}
                    onClickResult={this.onClickResult}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  isDisabled: selectors.isElementDisabled(state, 'searchPanel'),
  isWildCardSearchDisabled: selectors.isElementDisabled(state, 'wildCardSearchOption'),
  isOpen: selectors.isElementOpen(state, 'searchPanel'),
  results: selectors.getResults(state),
  isSearching: selectors.isSearching(state),
  noResult: selectors.isNoResult(state),
});

const mapDispatchToProps = {
  setActiveResultIndex: actions.setActiveResultIndex,
  closeElements: actions.closeElements,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTranslation()(SearchPanel));
