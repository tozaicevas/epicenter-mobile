/* eslint-disable global-require */
/* eslint-disable linebreak-style */
import React from "react";
import NotificationPopup from "react-native-push-notification-popup";
import "abortcontroller-polyfill";
import { View, TouchableOpacity, Animated, AsyncStorage, Vibration } from "react-native";
import { Camera, Permissions, Location } from "expo";
import { Text, Toast } from "native-base";
import BottomBar from "./BottomBar";
import { LOCAL_STORAGE_TIMESTAMPS_KEY, MIN_SMILE_AMOUNT, NOTIFICATION_SETTINGS_KEY } from '../../constants/Recognition';

const MAX_PICTURE_ERRORS = 20;
const MILISECOND = 1000;
const ENTITY_NOTIFICATION_INTERVAL_IN_SECONDS = 15;
const SMILE_TOAST_DURATION_IN_MS = 4000;
const MAX_WRONG_STATUS_ERRORS = 5;

const { AbortController } = window;
const controller = new AbortController();
const { signal } = controller;

class Workaround extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      smth: false
    };
  }
  doSmth = () => {
    const prev = this.state.smth;
    this.setState({ smth: !prev });
  };
  render() {
    if (this.state.smth)
      return (
        <Animated.View>
          <TouchableOpacity onPress={() => this.doSmth()} />
        </Animated.View>
      );
    else {
      return <TouchableOpacity onPress={() => this.doSmth()} />;
    }
  }
}

class CustomCamera extends React.Component {
  state = {
    hasCameraPermission: null,
    hasLocationPermission: null,
    type: Camera.Constants.Type.back,
    isFilming: false
  };

  pictureTakeError = 0;

  entitiesSet = new Set();

  smilesSet = new Set();

  wrongStatusError = 0;

  static getDerivedStateFromProps(props, state) {
    if (!props.isScreenFocused) {
      // eslint-disable-next-line no-param-reassign
      state.isFilming = false;
      controller.abort();
    }
    return state;
  }

  getCameraPermissionsAsync = async () => {
    const { permissions } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({
      hasCameraPermission: permissions[Permissions.CAMERA].status === "granted"
    });
  };
  getLocationPermissionsAsync = async () => {
    const { permissions } = await Permissions.askAsync(Permissions.LOCATION);
    this.setState({
      hasLocationPermission:
        permissions[Permissions.LOCATION].status === "granted"
    });
  };

  async componentDidMount() {
    this.getCameraPermissionsAsync();
    this.getLocationPermissionsAsync();
  }

  componentDidUpdate(prevProps, prevState) {
    const isFilmingChanged = prevState.isFilming !== this.state.isFilming;
    const stoppedFilming = isFilmingChanged && !this.state.isFilming;
    const startedFilming = isFilmingChanged && this.state.isFilming;
    if (stoppedFilming) controller.abort();
    else if (startedFilming) signal.aborted = false;
  }

  takePicture = () => {
    this.camera
      .takePictureAsync({
        base64: true,
        quality: 0,
        onPictureSaved: picture => this.processPicture(picture)
      })
      .catch(error => {
        this.pictureTakeError += 1;
        // TODO: only show error popup when a lot of takePicture() end up there
        if (this.pictureTakeError >= MAX_PICTURE_ERRORS) {
          this.showErrorPopup(String(error));
          this.setState({ isFilming: false });
        } else if (this.state.isFilming) this.takePicture();
      });
    // eslint-disable-next-line react/no-unused-state
    this.setState({ foo: Math.random() }); // workaround for react-native bug
    setTimeout(() => this.workaround.doSmth(), 5); // workaround for publishing
  };

  getUnseenEntities = response => {
    const unseenEntities = [];
    response.forEach(recognizedObject => {
      if (!this.entitiesSet.has(recognizedObject.id)) {
        unseenEntities.push(recognizedObject);
      }
    });
    if (unseenEntities.length > 0)
      this.updateEntitiesSet(unseenEntities, this.entitiesSet);
    return unseenEntities;
  };

  isSomeoneUniqueSmiling = response => {
    const uniqueSmileIds = [];
    response.forEach(recognizedObject => {
      const uniqueAndSmiling =
        !this.smilesSet.has(recognizedObject.id) &&
        recognizedObject.smile > MIN_SMILE_AMOUNT;
      if (uniqueAndSmiling) uniqueSmileIds.push(recognizedObject);
    });
    if (uniqueSmileIds.length > 0) {
      this.updateEntitiesSet(uniqueSmileIds, this.smilesSet);
      Toast.show({
        text: "Person is smiling - might be a maniac!",
        textStyle: { color: "yellow" },
        type: "default",
        position: "bottom",
        duration: SMILE_TOAST_DURATION_IN_MS
      });
    }
  };

  doRecognition = requestBody => {
    fetch("https://epicentereu.azurewebsites.net/api", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    })
      .then(
        response =>
          new Promise(resolve => {
            if (response.status !== 200) {
              this.wrongStatusError += 1;
              if (this.wrongStatusError > MAX_WRONG_STATUS_ERRORS) {
                this.setState({ isFilming: false });
                this.showErrorPopup("Wrong picture output.");
                this.wrongStatusError = 0;
              } else {
                this.takePicture();
              }
            } else {
              this.wrongStatusError = 0;
              resolve(response.json());
            }
          }),
        ex =>
          new Promise((resolve, reject) => {
            console.log(
              "Our api call failed or abort controller. Catch in doRecognition"
            );
            if (ex.name !== "AbortError") this.showErrorPopup(String(ex));
            this.setState({ isFilming: false });
            reject(ex);
          })
      )
      .then(
        response => {
          if (!this.state.isFilming) {
            // if user switched tab/pressed on filming,
            // we don't show the notification any more
            return;
          }
          if (response.length > 0) {
            this.addTimestampIdsToLocalStorage(response);
          }
          AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY)
          .then(value => {
            const parsedValue = JSON.parse(value);
            if (parsedValue == null || parsedValue === true) {
              const unseenEntities = this.getUnseenEntities(response);
              const unseenSmiles = this.isSomeoneUniqueSmiling(response);
    
              if (unseenEntities.length > 0) this.showNotification(unseenEntities);
            }
          });
          this.takePicture();
        },
        err => {
          this.setState({ isFilming: false });
          console.log("Network error/abort caught in promise doRecognition()");
          console.log(err);
        }
      );
  };

  getRequestBody = (base64, location) => ({
    latitude: location.latitude,
    longitude: location.longitude,
    imageBase64: base64,
    findPlate: false,
    findFace: true
  });

  processPicture = async (picture) => {
    this.pictureTakeError = 0;
    const location = await Location.getCurrentPositionAsync({});
    const requestBody = this.getRequestBody(picture.base64, location.coords);
    this.doRecognition(requestBody);
  };

  showNotification = async response => {
    const notificationsSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    const parsedSettings = JSON.parse(notificationsSettings);
    if (parsedSettings === false)
      return;
    if (!response) return null;
    Vibration.vibrate();
    const modelType = ["Person", "Car"]; // Plate (instead of Car) in backend
    const searchReason = ["Not searched", "Missing", "Criminal", "Other"];
    let message = "";
    response.forEach(recognizedObject => {
      const fullName = `${recognizedObject.firstName} ${recognizedObject.lastName}`;
      if (modelType[recognizedObject.type] === "Car") {
        message += `${recognizedObject.message} (${searchReason[
          recognizedObject.reason
        ]})\n`;
      } else if (modelType[recognizedObject.type] === "Person") {
        message += `${fullName} (${searchReason[recognizedObject.reason]})\n`;
      }
      message += `${modelType[
        recognizedObject.type
      ]} was last seen at ${recognizedObject.lastSeen}\n`;
    });
    this.popup.show({
      appIconSource: require("../../assets/images/logo.png"),
      appTitle: "Epicenter",
      timeText: "Now",
      title: "You've found something!",
      body: message
    });
  };

  showErrorPopup = message => {
    this.popup.show({
      appIconSource: require("../../assets/images/logo.png"),
      appTitle: "Epicenter",
      timeText: "Now",
      title: "Error",
      body: message
    });
  };

  onFilmButton = () => {
    const { isFilming } = this.state;
    if (this.camera && !isFilming) this.takePicture();
    this.setState({ isFilming: !isFilming });
  };

  updateEntitiesSet(recognizedObjects, set) {
    recognizedObjects.forEach(recognizedObject => {
      const { id } = recognizedObject;
      set.add(id);
      setTimeout(
        entityId => {
          set.delete(entityId);
        },
        ENTITY_NOTIFICATION_INTERVAL_IN_SECONDS * MILISECOND,
        id
      );
    });
  }

  async addTimestampIdsToLocalStorage(response) {
    const timestampIds = response.map(
      recognizedObject => recognizedObject.timestampId
    );
    const nonJsonValue = await AsyncStorage.getItem(
      LOCAL_STORAGE_TIMESTAMPS_KEY
    );
    const value = JSON.parse(nonJsonValue);
    if (value == null)
      AsyncStorage.setItem(
        LOCAL_STORAGE_TIMESTAMPS_KEY,
        JSON.stringify(timestampIds)
      );
    else {
      const uniqueTimestampIds = timestampIds.filter(id => !value.includes(id));
      AsyncStorage.setItem(
        LOCAL_STORAGE_TIMESTAMPS_KEY,
        JSON.stringify(uniqueTimestampIds.concat(value))
      );
    }
  }

  render() {
    const { hasCameraPermission } = this.state;
    if (hasCameraPermission === null) return <View />;
    if (hasCameraPermission === false) return <Text>No access to camera</Text>;
    return (
      <View style={{ flex: 1 }}>
        <Camera
          ref={ref => {
            this.camera = ref;
          }}
          style={{ flex: 1 }}
          type={this.state.type}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "transparent",
              flexDirection: "row"
            }}
          >
            <BottomBar
              type={this.state.type}
              setParentCameraType={type => this.setState({ type })}
              isFilming={this.state.isFilming}
              onFilmButton={() => this.onFilmButton()}
            />
          </View>
        </Camera>
        <NotificationPopup ref={ref => (this.popup = ref)} />
        <Workaround ref={ref => (this.workaround = ref)} />
      </View>
    );
  }
}

export default CustomCamera;
