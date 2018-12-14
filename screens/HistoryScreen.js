import React from 'react';
import { withNavigationFocus } from 'react-navigation';
import GlobalHistory from '../components/History/GlobalHistory';

class HistoryScreen extends React.Component {
    static navigationOptions = {
        title: 'History',
    };

    render() {
        return <GlobalHistory isScreenFocused={this.props.isFocused} />;
    }
}

export default withNavigationFocus(HistoryScreen);
