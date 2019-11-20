import React from 'react';

import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

class Paginate extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <>
        <hr />
        <Pagination aria-label="Table page" className="mt-3">
          {this.props.pages.map((page) => (
            <PaginationItem active={page.active}>
              <PaginationLink tag="a" href={page.url}>
                {page.content}
              </PaginationLink>
            </PaginationItem>
          ))}
        </Pagination>
        <hr />
      </>
    );
  }
}

export default Paginate;
