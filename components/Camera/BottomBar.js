/* eslint-disable react/prop-types */
import React from "react";

import { View, TouchableOpacity, Platform, AsyncStorage } from "react-native";
import { ActionSheet } from "native-base";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { Camera } from "expo";
import styles from "./styles";
import { NOTIFICATION_SETTINGS_KEY } from "../../constants/Recognition";

const BottomBar = ({ type, setParentCameraType, isFilming, onFilmButton }) => (
  <View style={styles.bottomBar}>
    <TouchableOpacity
      style={styles.bottomButton}
      onPress={async () => {
        const notificationSettings = await AsyncStorage.getItem(
          NOTIFICATION_SETTINGS_KEY
        );
        const jsonSettings = JSON.parse(notificationSettings);
        const enabled = jsonSettings == true || jsonSettings == null;
        const disableAction = enabled
          ? "Disable notifications"
          : "Enable notifications";
        ActionSheet.show(
          {
            options: [disableAction, "Cancel"],
            cancelButtonIndex: 1,
            destructiveButtonIndex: enabled ? 0 : -1,
            title: "Settings"
          },
          buttonIndex => {
              if (buttonIndex === 1)
                return;
            const stringifiedNewSettings = JSON.stringify(!enabled);
            AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, stringifiedNewSettings);
          }
        );
      }}
    >
      <Octicons name="kebab-horizontal" size={30} color="white" />
    </TouchableOpacity>
    <View style={{ flex: 0.6 }}>
      <TouchableOpacity onPress={onFilmButton} style={{ alignSelf: "center" }}>
        <Ionicons
          name={isFilming ? "ios-radio-button-off" : "ios-radio-button-on"}
          size={70}
          color={isFilming ? "red" : "white"}
        />
      </TouchableOpacity>
    </View>
    <TouchableOpacity
      style={styles.bottomButton}
      onPress={() => {
        const getStateType = () => type;
        setParentCameraType(
          getStateType() === Camera.Constants.Type.back
            ? Camera.Constants.Type.front
            : Camera.Constants.Type.back
        );
      }}
    >
      <Ionicons
        name={
          Platform.OS === "ios" ? "ios-reverse-camera" : "md-reverse-camera"
        }
        size={48}
        color="#e8e8e8"
      />
    </TouchableOpacity>
  </View>
);

export default BottomBar;
