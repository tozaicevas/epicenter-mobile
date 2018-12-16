import React from "react";
import {
  Button, 
  Icon,
  Container,
  Content,
  List,
  ListItem,
  Left,
  Body,
  Right,
  Thumbnail,
  Text,
} from "native-base";
import { Alert, View, ActivityIndicator, RefreshControl, ListView } from "react-native";

const getDate = timestamp => timestamp.substr(0, 10);
const getHours = timestamp => timestamp.substr(11, 19);

const SingleTimestamp = props => {
  const { timestamp } = props;
  const searchReason = ["Not searched", "Missing", "Criminal", "Other"];
  return (
    <ListItem avatar>
      <Left>
        <Thumbnail
          small
          source={{
            uri: `data:image/png;base64, ${timestamp.baseImage}`
          }}
        />
      </Left>
      <Body>
        <Text>
          {timestamp.missingModel.type === 0
            ? `${timestamp.missingModel.firstName} ${timestamp.missingModel
                .lastName}`
            : `${timestamp.missingModel.message}`}
        </Text>
        <Text note>{searchReason[timestamp.missingModel.reason]}</Text>
      </Body>
      <Right>
        <Text note>
          {`${getDate(timestamp.dateAndTime)}\u000A${getHours(
            timestamp.dateAndTime
          )}`}
        </Text>
      </Right>
    </ListItem>
  );
};

const AllTimestamps = props => {
  const { timestampList } = props;
  return timestampList.map(timestamp => (
    <SingleTimestamp key={timestamp.id} timestamp={timestamp} />
  ));
};

class GlobalHistory extends React.Component {
  state = {
    timestampList: [],
    isFetchingData: true,
    refreshing: false
  };

  dataSource = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });
  
  allTimestampsRequest = () => fetch(
    "https://epicentereu.azurewebsites.net/api/timestamps",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  ).then(response => {
    if (response.status === 200) return Promise.resolve(response.json());
    return Promise.reject(response.json());
  });

  allBaseImagesRequest = () => fetch(
    "https://epicentereu.azurewebsites.net/api/missingmodels/baseimages",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }
  ).then(response => {
    if (response.status === 200) return Promise.resolve(response.json());
    return Promise.reject(response.json());
  });

  getDataFromApi = () =>
    Promise.all([
      this.allTimestampsRequest(),
      this.allBaseImagesRequest()
    ]).then(responseBody => {
      this.setState({ isFetchingData: false });
      const mapper = {};
      responseBody[1].forEach(
        missingModel => (mapper[missingModel.id] = missingModel.baseImage)
      );
      const timestampList = responseBody[0].map(timestamp => ({
        ...timestamp,
        baseImage: mapper[timestamp.missingModel.id]
      }));
      this.setState({ timestampList: timestampList });
    });

  componentDidMount() {
    this.setState({ isFetchingData: true });
    this.getDataFromApi();
  }

  _onRefresh = () => {
    console.log("refreshing");
    this.setState({ refreshing: true });
    this.getDataFromApi().finally(() => this.setState({refreshing: false}));
  };

  render() {
    return this.state.isFetchingData ? (
      <View style={[styles.container, styles.horizontal]}>
        <ActivityIndicator
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            padding: 20
          }}
          size="large"
          color="blue"
        />
      </View>
    ) : (
      <Container>
        <Content
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this._onRefresh}
              tintColor="blue"
            />
          }
        >
          <List
          leftOpenValue={50}
            rightOpenValue={-50}
            dataSource={this.dataSource.cloneWithRows(this.state.timestampList)}
            renderRow={data => 
              (<SingleTimestamp timestamp={data}/>)}
              renderLeftHiddenRow={data =>
              <Button full onPress={() => Alert.alert(`${data.missingModel.firstName} ${data.missingModel.lastName}`, 'Vilnius, Lithuania')}>
                <Icon active name="information-circle" />
              </Button>}
            renderRightHiddenRow={(data, secId, rowId, rowMap) =>
              <Button full danger onPress={_ => this.deleteRow(secId, rowId, rowMap)}>
                <Icon active name="trash" />
              </Button>} />
        </Content>
      </Container>
    );
  }
}

const styles = {
  rootContainer: {
    position: "relative",
    height: "100%",
    width: "100%"
  },
  container: {
    flex: 1,
    justifyContent: "center"
  },
  horizontal: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10
  },
  helpContainer: {
    marginTop: 5,
    alignItems: "center"
  },
  helpLink: {
    paddingVertical: 15
  },
  helpLinkText: {
    fontSize: 14,
    color: "#2e78b7"
  }
};

export default GlobalHistory;
