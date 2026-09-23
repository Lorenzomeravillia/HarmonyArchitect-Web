# Harmony Native Audio (iOS)

This local Capacitor plugin moves ClearVoicing's sound generation out of WebKit.

The UI and exercise logic remain HTML/CSS/JavaScript. On iOS inside the Capacitor app,
JavaScript sends a list of sample paths, pitch shifts, gains and onset delays to Swift.
Swift owns the audio session and playback through AVAudioSession + AVAudioEngine.

## Why

Some iOS/WebKit versions can leave every Web Audio AudioContext permanently suspended
after a Home Screen app is backgrounded or force-quit. A native audio engine does not
depend on AudioContext.resume(), autoplay unlocking, or Tone.js lifecycle recovery.

## Runtime behavior

- AVAudioSession category: playback
- Native engine: AVAudioEngine
- Up to 12 simultaneous AVAudioPlayerNode voices
- Per-voice pitch shift: AVAudioUnitTimePitch (cents)
- Shared light room reverb
- Host-time scheduling for voice onset offsets
- Decoded PCM buffer cache, bounded to 48 samples
- Session deactivation on app background / reactivation on foreground
- Interruption and route-change handling

The plugin resolves self-hosted sample paths from the same WebVersion/assets tree that
Capacitor copies into the iOS application bundle. Existing HTTPS sample URLs are
downloaded once on the plugin queue and cached natively, so current presets keep working
while the remaining CDN instruments are progressively moved into the app bundle.

## App setup

From the repository root on macOS with Xcode installed:

```bash
cd native-app
npm install
npm run ios:add
npm run ios:sync
npm run ios:open
```

Build to a physical iPhone from Xcode. No microphone permission is required.

The web app detects the native plugin automatically. In Safari/PWA/desktop the plugin
is absent and the existing Tone.js/WebAudio/HTMLAudio paths remain available.
