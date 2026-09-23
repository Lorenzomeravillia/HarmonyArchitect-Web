# Native iOS audio architecture

## Goal

ClearVoicing/Harmony Architect keeps its existing HTML/CSS/JavaScript UI and music logic,
but an installed iOS app no longer relies on WebKit Web Audio for sound.

In the Capacitor iOS build:

```
exercise/music logic (JavaScript)
        |
        v
AudioEngine
        |
        v
NativeAudioBridge
        |
        v
Capacitor plugin
        |
        v
AVAudioSession + AVAudioEngine + AVAudioPlayerNode
```

Safari, PWA, desktop and Android continue to use the existing web engines.

## Why this is structurally different

The iOS app does not call `new AudioContext()`, `resume()` or Tone.js for playback.
Tone.js is not loaded at all when the page is running inside the Capacitor iOS shell.

The native plugin:

- configures `AVAudioSession.Category.playback`;
- explicitly activates/deactivates the session;
- owns an `AVAudioEngine`;
- schedules up to 12 native player voices;
- pitch-shifts each voice with `AVAudioUnitTimePitch`;
- schedules the onset spread with host time rather than JavaScript timers;
- applies a light shared native reverb;
- generates short earcon/click tones natively;
- handles app foreground/background, interruptions and route changes.

## Samples

JavaScript still chooses the nearest sample using the existing INSTRUMENT_MAPS, so the
musical behavior remains the same.

Self-hosted samples are read directly from the Capacitor app bundle.

Existing CDN sample URLs are downloaded by the native plugin on first use into the iOS
Caches directory, then decoded and kept in a bounded PCM cache. This is transitional:
for a fully offline App Store build, all remaining instrument samples should eventually
be moved into `WebVersion/assets/samples/`.

## Requirements

- macOS with current Xcode
- Node.js 22+
- iOS 15+ (Capacitor 8 native target)
- a physical iPhone for meaningful audio lifecycle testing

## Create the native iOS project

From the repository root:

```bash
cd native-app
npm install
npm run ios:add
npm run ios:sync
npm run ios:open
```

Then select a Development Team and unique Bundle Identifier in Xcode and run on a
physical device.

When web files or the plugin change:

```bash
cd native-app
npm run ios:sync
```

## Expected diagnostic state

After START TRAINING inside the native app:

```
engine=NativeAVAudio · ctx=running · ready=true
```

There should be no AudioContext resume/rebuild sequence in the log.

## Test matrix

1. Cold launch -> START -> play several chords.
2. Home screen -> return after 10 seconds -> play.
3. App switcher -> leave for several minutes -> return -> play.
4. Force-close from app switcher -> relaunch -> play.
5. Lock/unlock phone -> return -> play.
6. Receive/finish a phone or FaceTime interruption -> play.
7. Switch speaker/Bluetooth route -> play.
8. Repeat all tests on iOS 26.0 specifically.
9. Verify Safari/PWA still follows the existing web audio path.
10. Verify each preset, especially presets using samples that still come from the CDN.

## Current scope

This branch implements the iOS native audio engine. Android remains on the existing web
engine for now; the JavaScript abstraction means a native Android implementation can be
added later without changing exercise logic.
