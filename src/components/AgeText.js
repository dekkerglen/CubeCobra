import React from 'react';

class AgeText extends React.Component {
  constructor(props) {
    super(props);
  }

  inSeconds(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / 1000);
  }

  inMinutes(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / (60 * 1000));
  }

  inHours(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / (3600 * 1000));
  }

  inDays(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / (24 * 3600 * 1000));
  }

  inWeeks(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / (24 * 3600 * 1000 * 7));
  }

  inMonths(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    //365/12 is the average day length of a month, which is close enough
    return parseInt((t2 - t1) / (24 * 3600 * 1000 * 365/12));
  }

  inYears(d1, d2) {
    var t2 = d2.getTime();
    var t1 = d1.getTime();

    return parseInt((t2 - t1) / (24 * 3600 * 1000 * 365));
  }

  render() {
    var date = new Date(this.props.date);
    var now = new Date();

    var str = date + ' ' + now + ' ';
    if (this.inYears(date, now) > 0) {
      str = this.inYears(date, now) + ' year';
    } else if (this.inMonths(date, now) > 0) {
      str = this.inMonths(date, now) + ' month';
    } else if (this.inWeeks(date, now) > 0) {
      str = this.inWeeks(date, now) + ' week';
    } else if (this.inDays(date, now) > 0) {
      str = this.inDays(date, now) + ' day';
    } else if (this.inHours(date, now) > 0) {
      str = this.inHours(date, now) + ' hour';
    } else if (this.inMinutes(date, now) > 0) {
      str = this.inMinutes(date, now) + ' minute';
    } else if (this.inSeconds(date, now) > 0) {
      str = this.inSeconds(date, now) + ' second';
    } else {
      str = 'just now';
    }
    if (str != 'just now') {
      if (parseInt(str) > 1) {
        str += 's ago';
      } else {
        str += ' ago';
      }
    }

    return <>{str}</>;
  }
}

export default AgeText;
