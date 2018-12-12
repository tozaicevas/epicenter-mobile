/* eslint-disable global-require */
import React from 'react';
import NotificationPopup from 'react-native-push-notification-popup';
import 'abortcontroller-polyfill';

import { Text, View } from 'react-native';

import { Camera, Permissions } from 'expo';
import BottomBar from './BottomBar';

const { AbortController } = window;
const controller = new AbortController();
const { signal } = controller;

/*
    props.type
    props.setParentState()
    props.isFilming
    props.onFilmButton()
*/

class CustomCamera extends React.Component {
    state = {
        hasCameraPermission: null,
        type: Camera.Constants.Type.back,
        isFilming: false,
    };

    static getDerivedStateFromProps(props, state) {
        if (!props.isScreenFocused) {
            // eslint-disable-next-line no-param-reassign
            state.isFilming = false;
            console.log('Camera screen is no longer focused');
            controller.abort();
        }
        return state;
    }

    async componentDidMount() {
        const { permissions } = await Permissions.askAsync(Permissions.CAMERA);
        this.setState({
            hasCameraPermission: permissions[Permissions.CAMERA].status === 'granted',
        });
    }

    componentDidUpdate(prevProps, prevState) {
        console.log('UPDATE');
        if (prevState.isFilming !== this.state.isFilming && !this.state.isFilming) {
            console.log('componentDidUpdate');
            controller.abort();
        }
    }

    processPicture = (picture) => {
        fetch('https://epicentertop.azurewebsites.net/api', {
            method: 'POST',
            signal,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(picture.base64),
        })
            .then(
                response => new Promise((resolve, reject) => {
                    console.log(response);
                    if (response.status !== 200) reject(new Error('Response status is not 200'));
                    else resolve(response.json());
                }),
                (ex) => {
                    if (ex.name !== 'AbortError') {
                        this.setState({ isFilming: false });
                        this.showErrorPopup(String(ex));
                    } else {
                        console.log('FETCH ABORTED');
                        signal.aborted = false;
                    }
                },
            )
            .then(
                (response) => {
                    if (!this.state.isFilming) {
                        // if user switched tab/pressed on filming,
                        // we don't show the notification any more
                        return;
                    }
                    this.showPopup(response);
                    // user might have pushed the button or switched the tabs,
                    // so let's check isFilming
                    this.takePicture();
                },
                () => {
                    if (this.state.isFilming) this.takePicture();
                },
            );
    };

    showPopup = (response) => {
        if (!response) return null;
        const modelType = ['Person', 'Car']; // Plate (instead of Car) in backend
        const searchReason = ['Not searched', 'Missing', 'Criminal', 'Other'];
        let message = '';
        response.forEach((recognizedObject) => {
            const fullName = `${recognizedObject.firstName} ${recognizedObject.lastName}`;
            if (modelType[recognizedObject.type] === 'Car') {
                message += `${searchReason[recognizedObject.reason]} car ${
                    recognizedObject.message
                } (Owner: ${fullName})\n`;
            } else if (modelType[recognizedObject.type] === 'Person') {
                message += `${searchReason[recognizedObject.reason]} ${fullName}.\n`;
            }
            message += `${modelType[recognizedObject.type]} was last seen at ${
                recognizedObject.lastSeen
            }\n`;
        });
        this.popup.show({
            appIconSource: require('../../assets/images/robot-dev.jpg'),
            appTitle: 'Epicenter',
            timeText: 'Now',
            title: "You've found something!",
            body: message,
        });
    };

    showErrorPopup = (message) => {
        this.popup.show({
            appIconSource: require('../../assets/images/robot-dev.jpg'),
            appTitle: 'Epicenter',
            timeText: 'Now',
            title: 'Error!',
            body: message,
        });
    };

    takePicture = () => {
        console.log('takePicture()');
        this.camera
            .takePictureAsync({
                base64: true,
                quality: 0,
                onPictureSaved: picture => this.processPicture(picture),
            })
            .catch((error) => {
                // TODO: only show error popup when a lot of takePicture() end up there
                this.showErrorPopup(String(error));
                if (this.state.isFilming) this.takePicture();
            });
        // eslint-disable-next-line react/no-unused-state
        this.setState({ foo: Math.random() });
    };

    onFilmButton = () => {
        const { isFilming } = this.state;
        if (this.camera && !isFilming) this.takePicture();
        this.setState({ isFilming: !isFilming });
    };

    render() {
        const { hasCameraPermission } = this.state;
        if (hasCameraPermission === null) {
            return <View />;
        }
        if (hasCameraPermission === false) {
            return <Text>No access to camera</Text>;
        }
        return (
            <View style={{ flex: 1 }}>
                <Camera
                    ref={(ref) => {
                        this.camera = ref;
                    }}
                    style={{ flex: 1 }}
                    type={this.state.type}
                >
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: 'transparent',
                            flexDirection: 'row',
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
            </View>
        );
    }
}

export default CustomCamera;