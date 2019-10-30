import React from 'react';

import { Collapse } from 'reactstrap';

class CommentEntry extends React.Component {
    constructor(props) 
    {
        super(props);
        this.state = {
            inputValue: ''
        };

        this.toggle = this.toggle.bind(this);
        this.clickSubmit = this.clickSubmit.bind(this);
        this.updateInputValue = this.updateInputValue.bind(this);
    }

    error(message) {
        console.log(message);
    }

    async clickSubmit()
    {
        if(this.state.inputValue.length > 0)
        {
            document.body.classList.add('busy-cursor');
            this.setState({ 
                collapse: false,
                inputValue:'' 
            });

            const response = await csrfFetch(`/cube/api/postcomment`, {
                method: 'POST',
                body: JSON.stringify({ 
                    id:this.props.id,
                    content:this.state.inputValue,
                    position:this.props.position
                }),
                headers: {
                'Content-Type': 'application/json',
                },
            }).catch(err => this.error(err));
            const json = await response.json().catch(err => this.error(err));
            this.props.onPost(json.comment);
            document.body.classList.remove('busy-cursor');
        }
    }

    updateInputValue(evt) {
        this.setState({
            inputValue: evt.target.value
        });
    }

    toggle() {
        this.setState({ collapse: !this.state.collapse });
    }

    render() {
        return (        
            <>
                <Collapse isOpen={!this.state.collapse}>
                    <a onClick={this.toggle}>{this.props.children}</a>  
                </Collapse>  
                <Collapse isOpen={this.state.collapse}>
                    <textarea value={this.state.inputValue} onChange={this.updateInputValue} className="form-control" id="exampleFormControlTextarea1" rows="2" maxLength="500"></textarea>        
                    <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.clickSubmit}>Submit</a>   
                    {' '}
                    <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.toggle}>Cancel</a>   
                </Collapse>
            </>
        );
    }
}

export default CommentEntry