import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import Measure from 'react-measure';
import { CellMeasurer, CellMeasurerCache, List } from 'react-virtualized';
import { useTranslation } from 'react-i18next';

import Dropdown from 'components/Dropdown';
import Note from 'components/Note';
import Icon from 'components/Icon';

import NoteContext from 'components/Note/Context';
import ListSeparator from 'components/ListSeparator';
import ResizeBar from 'components/ResizeBar';

import core from 'core';
import { getSortStrategies } from 'constants/sortStrategies';
import actions from 'actions';
import selectors from 'selectors';

import './NotesPanel.scss';

const NotesPanel = () => {
  const [
    sortStrategy,
    isOpen,
    pageLabels,
    customNoteFilter,
  ] = useSelector(
    state => [
      selectors.getSortStrategy(state),
      selectors.isElementOpen(state, 'notesPanel'),
      selectors.getPageLabels(state),
      selectors.getCustomNoteFilter(state),
    ],
    shallowEqual,
  );
  const dispatch = useDispatch();
  const [notes, setNotes] = useState([]);
  const [width, setWidth] = useState(293);

  // the object will be in a shape of { [note.Id]: true }
  // use a map here instead of an array to achieve an O(1) time complexity for checking if a note is selected
  const [selectedNoteIds, setSelectedNoteIds] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [t] = useTranslation();
  const listRef = useRef();
  // a ref that is used to keep track of the current scroll position
  // when the number of notesToRender goes over/below the threshold, we will unmount the current list and mount the other one
  // this will result in losing the scroll position and we will use this ref to recover
  const scrollTopRef = useRef(0);
  const VIRTUALIZATION_THRESHOLD = 300;

  useEffect(() => {
    const onDocumentUnloaded = () => {
      setNotes([]);
      setSelectedNoteIds({});
      setSearchInput('');
    };
    core.addEventListener('documentUnloaded', onDocumentUnloaded);
    return () =>
      core.removeEventListener('documentUnloaded', onDocumentUnloaded);
  }, []);

  useEffect(() => {
    const _setNotes = () => {
      setNotes(
        core
          .getAnnotationsList()
          .filter(
            annot =>
              annot.Listable &&
              !annot.isReply() &&
              !annot.Hidden &&
              !annot.isGrouped(),
          ),
      );
    };

    core.addEventListener('annotationChanged', _setNotes);
    core.addEventListener('annotationHidden', _setNotes);

    _setNotes();

    return () => {
      core.removeEventListener('annotationChanged', _setNotes);
      core.removeEventListener('annotationHidden', _setNotes);
    };
  }, []);

  useEffect(() => {
    const onAnnotationSelected = () => {
      const ids = {};

      core.getSelectedAnnotations().forEach(annot => {
        ids[annot.Id] = true;
      });
      setSelectedNoteIds(ids);
    };

    core.addEventListener('annotationSelected', onAnnotationSelected);
    return () =>
      core.removeEventListener('annotationSelected', onAnnotationSelected);
  }, []);

  let singleSelectedNoteIndex = -1;
  useEffect(() => {
    if (Object.keys(selectedNoteIds).length && singleSelectedNoteIndex !== -1) {
      listRef.current?.scrollToRow(singleSelectedNoteIndex);
    }
    // we only want this effect to happen when we select some notes
    // eslint-disable-next-line
  }, [selectedNoteIds]);

  useEffect(() => {
    if (isOpen) {
      dispatch(actions.closeElements(['searchPanel', 'searchOverlay']));
    }
  }, [dispatch, isOpen]);

  const handleScroll = scrollTop => {
    if (scrollTop) {
      scrollTopRef.current = scrollTop;
    }
  };

  const filterNote = note => {
    let shouldRender = true;

    if (customNoteFilter) {
      shouldRender = shouldRender && customNoteFilter(note);
    }

    if (searchInput) {
      const replies = note.getReplies();
      // reply is also a kind of annotation
      // https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#createAnnotationReply__anchor
      const noteAndReplies = [note, ...replies];

      shouldRender =
        shouldRender &&
        noteAndReplies.some(note => {
          const content = note.getContents();
          const authorName = core.getDisplayAuthor(note);

          return (
            isInputIn(content, searchInput) ||
            isInputIn(authorName, searchInput)
          );
        });
    }

    return shouldRender;
  };

  const isInputIn = (string, searchInput) => {
    if (!string) {
      return false;
    }

    return string.search(new RegExp(searchInput, 'i')) !== -1;
  };

  const handleInputChange = e => {
    _handleInputChange(e.target.value);
  };

  const _handleInputChange = _.debounce(value => {
    // this function is used to solve the issue with using synthetic event asynchronously.
    // https://reactjs.org/docs/events.html#event-pooling
    core.deselectAllAnnotations();

    setSearchInput(value);
  }, 500);

  const renderChild = (
    notes,
    index,
    // when we are virtualizing the notes, all of them will be absolutely positioned
    // this function needs to be called by a Note component whenever its height changes
    // to clear the cache(used by react-virtualized) and recompute the height so that each note
    // can have the correct position
    resize = () => {},
  ) => {
    let listSeparator = null;
    const { shouldRenderSeparator, getSeparatorContent } = getSortStrategies()[
      sortStrategy
    ];
    const prevNote = index === 0 ? null : notes[index - 1];
    const currNote = notes[index];

    if (
      shouldRenderSeparator &&
      getSeparatorContent &&
      (!prevNote || shouldRenderSeparator(prevNote, currNote))
    ) {
      listSeparator = (
        <ListSeparator
          renderContent={() =>
            getSeparatorContent(prevNote, currNote, { pageLabels })
          }
        />
      );
    }

    // can potentially optimize this a bit since a new reference will cause consumers to rerender
    const contextValue = {
      searchInput,
      resize,
      isSelected: selectedNoteIds[currNote.Id],
      isContentEditable: core.canModify(currNote) && !currNote.getContents(),
    };

    return (
      <React.Fragment>
        {listSeparator}
        <NoteContext.Provider value={contextValue}>
          <Note annotation={currNote} />
        </NoteContext.Provider>
      </React.Fragment>
    );
  };

  const notesToRender = getSortStrategies()
    [sortStrategy].getSortedNotes(notes)
    .filter(filterNote);

  // keep track of the index of the single selected note in the sorted and filtered list
  // in order to scroll it into view in this render effect
  const ids = Object.keys(selectedNoteIds);
  if (ids.length === 1) {
    singleSelectedNoteIndex = notesToRender.findIndex(
      note => note.Id === ids[0],
    );
  }

  return (
    <div
      className="notes-panel-container"
      style={{ width: `${width}px` }}
    >
      <ResizeBar
        minWidth={215}
        onResize={_width => {
          setWidth(_width);
        }}
        leftDirection
      />
      <div
        className={classNames({
          Panel: true,
          NotesPanel: true,
        })}
        data-element="notesPanel"
        onMouseDown={core.deselectAllAnnotations}
      >
        {notes.length === 0 ? (
          <div className="no-annotations">{t('message.noAnnotations')}</div>
        ) : (
          <React.Fragment>
            <div className="container">
              <div className="header">
                <div className="input-container">
                  <input
                    type="text"
                    placeholder={t('message.searchPlaceholder')}
                    onChange={handleInputChange}
                  />
                  <div
                    className="input-button"
                    onClick={() => {}}
                  >
                    <Icon
                      glyph="ic_search_black_24px"
                    />
                  </div>
                </div>
                <div className="divider" />
                <div className="sort-row">
                  <div className="sort-container">
                    <div className="header">{`Sort by:`}</div>
                    <Dropdown items={Object.keys(getSortStrategies())} />
                  </div>
                </div>
              </div>
            </div>
            {notesToRender.length === 0 ? (
              <div className="no-results">
                <div>
                  <Icon
                    className="empty-icon"
                    glyph="illustration - empty state - outlines"
                  />
                </div>
                <div className="msg">
                  {t('message.noResults')}
                </div>
              </div>
            ) : notesToRender.length <= VIRTUALIZATION_THRESHOLD ? (
              <NormalList
                ref={listRef}
                notes={notesToRender}
                onScroll={handleScroll}
                initialScrollTop={scrollTopRef.current}
              >
                {renderChild}
              </NormalList>
            ) : (
              <VirtualizedList
                ref={listRef}
                notes={notesToRender}
                onScroll={handleScroll}
                initialScrollTop={scrollTopRef.current}
              >
                {renderChild}
              </VirtualizedList>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;

const listPropTypes = {
  notes: PropTypes.array.isRequired,
  children: PropTypes.func.isRequired,
  onScroll: PropTypes.func.isRequired,
  initialScrollTop: PropTypes.number.isRequired,
};

const cache = new CellMeasurerCache({ defaultHeight: 50, fixedWidth: true });

const VirtualizedList = React.forwardRef(
  ({ notes, children, onScroll, initialScrollTop }, forwardedRef) => {
    const listRef = useRef();
    const [dimension, setDimension] = useState({ width: 0, height: 0 });

    useImperativeHandle(forwardedRef, () => ({
      scrollToPosition: scrollTop => {
        listRef.current.scrollToPosition(scrollTop);
      },
      scrollToRow: index => {
        listRef.current.scrollToRow(index);
      },
    }));

    useEffect(() => {
      listRef.current.scrollToPosition(initialScrollTop);
    }, [initialScrollTop]);

    const _resize = index => {
      cache.clear(index);
      listRef.current?.recomputeRowHeights(index);
    };

    const handleScroll = ({ scrollTop }) => {
      onScroll(scrollTop);
    };

    /* eslint-disable react/prop-types */
    const rowRenderer = ({ index, key, parent, style }) => {
      const currNote = notes[index];

      return (
        <CellMeasurer
          key={`${key}${currNote.Id}`}
          cache={cache}
          columnIndex={0}
          parent={parent}
          rowIndex={index}
        >
          <div style={style}>
            {children(notes, index, () => _resize(index))}
          </div>
        </CellMeasurer>
      );
    };

    return (
      <Measure bounds onResize={({ bounds }) => setDimension(bounds)}>
        {({ measureRef }) => (
          <div ref={measureRef} className="virtualized-notes-container">
            <List
              deferredMeasurementCache={cache}
              style={{ outline: 'none' }}
              height={dimension.height}
              width={dimension.width}
              overscanRowCount={10}
              ref={listRef}
              rowCount={notes.length}
              rowHeight={cache.rowHeight}
              rowRenderer={rowRenderer}
              onScroll={handleScroll}
            />
          </div>
        )}
      </Measure>
    );
  },
);

VirtualizedList.propTypes = listPropTypes;

const NormalList = React.forwardRef(
  ({ notes, children, onScroll, initialScrollTop }, forwardedRef) => {
    const listRef = useRef();

    useImperativeHandle(forwardedRef, () => ({
      scrollToPosition: scrollTop => {
        listRef.current.scrollTop = scrollTop;
      },
      scrollToRow: index => {
        const parent = listRef.current;
        const child = parent.children[index];

        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();

        const isViewable =
          childRect.top >= parentRect.top &&
          childRect.top <= parentRect.top + parent.clientHeight;
        if (!isViewable) {
          parent.scrollTop = childRect.top + parent.scrollTop - parentRect.top;
        }
      },
    }));

    useEffect(() => {
      listRef.current.scrollTop = initialScrollTop;
    }, [initialScrollTop]);

    const handleScroll = e => {
      onScroll(e.target.scrollTop);
    };

    return (
      <div
        ref={listRef}
        className="normal-notes-container"
        onScroll={handleScroll}
      >
        {notes.map((currNote, index) => (
          <React.Fragment key={`${index}${currNote.Id}`}>
            {children(notes, index)}
          </React.Fragment>
        ))}
      </div>
    );
  },
);

NormalList.propTypes = listPropTypes;
