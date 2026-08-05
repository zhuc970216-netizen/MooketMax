FROM reactnativecommunity/react-native-android:latest

RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager \
        "platforms;android-36" \
        "build-tools;36.0.0" \
        "ndk;27.3.13750724"

ARG GRADLE_VERSION=8.9
RUN curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
        -o /tmp/gradle.zip \
    && unzip -q /tmp/gradle.zip -d /opt \
    && rm /tmp/gradle.zip \
    && ln -s "/opt/gradle-${GRADLE_VERSION}/bin/gradle" /usr/local/bin/gradle
