import React from 'react';

import { Pagination, PaginationItem, PaginationLink, Collapse } from 'reactstrap';

class Paginate extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {collapse: false};
  }  
  
  render() {
    return (
        <>
        <hr/>
        <Pagination aria-label="Table page" className="mt-3">
          {this.props.pages.map(page =>
            <PaginationItem key={page} active={page.active}>
              <PaginationLink tag="a" href={page.url}>
                {page.content}
              </PaginationLink>
            </PaginationItem>
          )}
        </Pagination>
      <hr/>
      </>
    );
  }
}

export default Paginate