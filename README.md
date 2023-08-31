# React Native Wordle
This is the project carried out for the course of Engineering of Mobile Systems at the Free University of Bolzano.
The specification for the project is available at the [following repo](https://github.com/rrobbes/EngineeringOfMobileSystemsV2/blob/main/Wordle-JanuarySession.md) of the Professor Robbes Romain Julien.
## Method of development
The project is built over the original solution available on the branch [original-snack](https://github.com/Bjastkuliar/react-native-wordle/tree/original-snack)
of this repo or on the [Snack](https://snack.expo.dev/@rrobbes/dordle-solution) published by the professor.

The following features were then implemented:
- **Dictionary API integration (mandatory, 2pt)**: the application uses [Wordnik](https://developer.wordnik.com/) for retrieving random words and clues on the answer.
- **Persistence (1 pts)**: using [AsyncStorage](https://github.com/react-native-async-storage/async-storage) the application stores data about games in an unencrypted manner
- **Sharing (1 pts)**: the application creates a text message showing the tiles of the game and their status
- **Challenges (2 pts)**: using [QRcode](https://github.com/soldair/node-qrcode) and [SvgXML](https://github.com/software-mansion/react-native-svg) and [Expo linking](https://docs.expo.dev/guides/linking/) the application paints a QR code that encodes a JSON object representing the game, at the same opening the app via a linke like via a QR reader (e.g. [Google Lens](https://lens.google/)) it starts a game. 
- **Advanced Dictionary integration (2 pts)**
- **Dordle: eternal edition (2 pts)**

The application makes use of Wordnik for retrieving word-data. The API key included is the one for testing purposes, that may be more limited than a private one.

Note: all the detailed explanations of the original assignment can be found at the link of the assignment repo.
## Running the project
The project was built using react-native and expo. Therefore, it is necessary to install expo via [Node](https://nodejs.org/en) and/or [Yarn](https://yarnpkg.com/). You will also require either a physical or a virtual device running either [IOS](https://developer.apple.com/ios/) or [Android](https://developer.android.com/). 
> This project was developed using Android as a testing platform, therefore the instructions will only contain how to run on Android, since for developing on IOS you are required to own a Macintosh 

The steps for running the project are the following:

1. Download the repo, NodeJS, Yarn ([it is possible to install it via Node](https://yarnpkg.com/getting-started/install)) and the needed dev-tools (you can choose to install just single components or to use [AndroidStudio](https://developer.android.com/) to install the various required SDKs and additional DevTools)

2. Once installed and downloaded the repo, one needs to build the expo project by using the `create-expo-app` command as shown on [Expo's Documentation](https://docs.expo.dev/more/glossary-of-terms#create-expo-app)

3. Once the project is correctly created and all the modules listed in the [`package.json`](package.json) are installed (expo prefers using Yarn for installing react packages) you can run the `start` command (listed also in the [`package.json`](package.json)) in order to start [Metro Bundler](https://docs.expo.dev/guides/customizing-metro/).

4. For running the program you have to have a device connected via [Android Debug Bridge](https://developer.android.com/tools/adb) which can be either physical or virtual (virtual devices require Virtualization to be enabled on the computer). On the device you have to have installed [ExpoGo](https://expo.dev/client) unless you want to have a standalone application (it is recommended to use ExpoGo because it reduces the overhead of having to convert the application to Android on its own and moving it to the device).

> The project was developed using the setup proposed above, but it may not be the only/optimal solution for running the project. The project could also be executed online using Snack, but the website lacks the dedicated computing power to run the application, so bundling/deployment may take a while on Snack.
### ExpoGo
#### Advantage
Using ExpoGo rather than a standalone application is that it is possible to bundle and apply changes to the code instantaneously (which is the entire point of platform independence), avoiding the process of recompiling the project from scratch to Android/APK and then running it separately.
##### Disadvantage 
ExpoGo runs the application on a specific port of the device, this port may change from one execution to the other, therefore rendering the challenge mode impossible to execute unless the IP/port of the application matches the one contained in the QR code.