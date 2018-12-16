import React from "react";
import { withNavigationFocus } from "react-navigation";
import GlobalHistory from "../components/History/GlobalHistory";
import { Button, Text, Body, Container, Content, Segment } from "native-base";
import { MaterialIcons } from "@expo/vector-icons";
import { Dimensions, TouchableOpacity, AsyncStorage } from "react-native";
import { LOCAL_STORAGE_TIMESTAMPS_KEY } from "../constants/Recognition";

class HistoryScreen extends React.Component {
    state = {clearLocalHistory: null};
  static navigationOptions = ({ navigation }) => {
    const { params = {} } = navigation.state;
    return {
      title: "History",
      headerRight: (
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.setItem(
              LOCAL_STORAGE_TIMESTAMPS_KEY,
              JSON.stringify([])
            );
            params.handleClear();
          }}
          style={{ alignSelf: "center" }}
        >
          <MaterialIcons
            name="delete"
            size={24}
            style={{ marginRight: Dimensions.get("window").width * 0.05 }}
          />
        </TouchableOpacity>
      )
    };
  };

  handleClear = () => {
      this.setState({clearLocalHistory: this.clearLocalHistorySuccess});
  }

  clearLocalHistorySuccess = () => {
      this.setState({clearLocalHistory: null});
  }

  componentDidMount() {
    this.props.navigation.setParams({ handleClear: this.handleClear });
  }

  render() {
      console.log("in historyscreen");
      console.log(this.state.clearLocalHistory);
    return <GlobalHistory clearLocalHistory={this.state.clearLocalHistory} />;
  }
}

export default HistoryScreen;
