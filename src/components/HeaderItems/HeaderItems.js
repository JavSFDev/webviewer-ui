import React from 'react';
import PropTypes from 'prop-types';

import ToolButton from 'components/ToolButton';
import ToggleElementButton from 'components/ToggleElementButton';
import ActionButton from 'components/ActionButton';
import StatefulButton from 'components/StatefulButton';
import CustomElement from 'components/CustomElement';
import ToolGroupButtonsScroll from './ToolGroupButtonsScroll';
import useMedia from 'hooks/useMedia';

import './HeaderItems.scss';

class HeaderItems extends React.PureComponent {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object).isRequired,
  }

  render() {
    const { items, isMobile } = this.props;

    const toolGroupButtonsItems = items.filter(({ type }) => type === 'toolGroupButton');
    let handledToolGroupButtons = false;

    return (
      <div className="HeaderItems">
        {items.map((item, i) => {
          const { type, dataElement, hidden, toolName } = item;
          const mediaQueryClassName = hidden ? hidden.map(screen => `hide-in-${screen}`).join(' ') : '';
          const key = `${type}-${dataElement || i}`;

          // if (isMobile) {
          //   if (dataElement === 'undoButton' || dataElement === 'redoButton' || toolName === 'AnnotationEraserTool') {
          //     return null;
          //   }
          // }

          switch (type) {
            case 'toolButton':
              return <ToolButton key={key} mediaQueryClassName={mediaQueryClassName} {...item} />;
            case 'toolGroupButton':
              if (!handledToolGroupButtons) {
                handledToolGroupButtons = true;

                return <ToolGroupButtonsScroll toolGroupButtonsItems={toolGroupButtonsItems} />;
              }
              return null;
            case 'toggleElementButton':
              return <ToggleElementButton key={key} mediaQueryClassName={mediaQueryClassName} {...item} />;
            case 'actionButton':
              return <ActionButton key={key} mediaQueryClassName={mediaQueryClassName} {...item} />;
            case 'statefulButton':
              return <StatefulButton key={key} mediaQueryClassName={mediaQueryClassName} {...item} />;
            case 'customElement':
              return <CustomElement key={key} mediaQueryClassName={mediaQueryClassName} {...item} />;
            case 'spacer':
            case 'divider':
              return <div key={key} className={`${type} ${mediaQueryClassName}`}></div>;
            default:
              console.warn(`${type} is not a valid header item type.`);
          }
        })}
      </div>
    );
  }
}

export default props => {
  const isMobile = useMedia(
    // Media queries
    ['(max-width: 640px)'],
    [true],
    // Default value
    false,
  );

  return (
    <HeaderItems {...props} isMobile={isMobile} />
  );
};