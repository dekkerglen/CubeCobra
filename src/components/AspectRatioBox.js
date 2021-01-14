import cx from 'classnames';
import PropTypes from 'prop-types';

/** 2020-11-17 struesdell:
 * - Added classnames dependency, allowing for terse classname construction
 * - Added style to props shape to allow partial style passthrough
 * - Added propTypes declaration to resolve ESLint errors (issue #1601)
 * - Added defaultProps to support partial prop application
 */
const AspectRatioBox = ({ ratio, className, style, ...props }) => (
  <div className="position-relative w-100" style={{ paddingTop: `${(100 / ratio).toFixed(5)}%` }}>
    <div
      className={cx('position-absolute', 'overflow-hidden', className)}
      style={{ ...style, left: 0, top: 0, right: 0, bottom: 0 }}
      {...props}
    />
  </div>
);

AspectRatioBox.propTypes = {
  ratio: PropTypes.number.isRequired,
  className: PropTypes.string,
  style: PropTypes.objectOf(PropTypes.string),
};
AspectRatioBox.defaultProps = {
  className: '',
  style: Object.create(null),
};

export default AspectRatioBox;
