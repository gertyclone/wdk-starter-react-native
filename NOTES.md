nvm use v22.21.1

"@ton/core": "^0.62.0",

npm install --legacy-peer-deps

.env

npm run gen:bundle

npm run android



npm run prebuild:clean

cd android && ./gradlew clean
cd ..

CommandError: No Android connected device found, and no emulators could be started automatically.
Connect a device or create an emulator (https://docs.expo.dev/workflow/android-studio-emulator).
Then follow the instructions here to enable USB debugging:
https://developer.android.com/studio/run/device.html#developer-device-options. If you are using Genymotion go to Settings -> ADB, select "Use custom Android SDK tools", and point it at your Android SDK directory.

