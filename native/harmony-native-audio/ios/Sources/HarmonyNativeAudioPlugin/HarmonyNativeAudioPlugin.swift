import Foundation
import AVFAudio
import Capacitor
import UIKit
import Darwin

private struct NativeVoiceRequest: Decodable {
    let samplePath: String
    let pitchCents: Double?
    let gain: Double?
    let durationSec: Double?
    let delayMs: Double?
}

private struct PlayVoicesRequest: Decodable {
    let voices: [NativeVoiceRequest]
}

private struct NativeAudioStatus: Encodable {
    let engineRunning: Bool
    let sessionActive: Bool
    let sampleRate: Double
    let outputChannels: Int
    let cachedBuffers: Int
}

private final class VoiceSlot {
    let player = AVAudioPlayerNode()
    let pitch = AVAudioUnitTimePitch()
    var generation: UInt64 = 0
}

private final class HarmonyNativeAudioEngine {
    private let engine = AVAudioEngine()
    private let voiceMixer = AVAudioMixerNode()
    private let reverb = AVAudioUnitReverb()
    private let session = AVAudioSession.sharedInstance()
    private let releaseQueue = DispatchQueue(label: "com.clearvoicing.nativeaudio.release", qos: .userInitiated)

    private var slots: [VoiceSlot] = []
    private var bufferCache: [String: AVAudioPCMBuffer] = [:]
    private var sessionActive = false
    private var observers: [NSObjectProtocol] = []

    var resolveAssetURL: ((String) -> URL?)?

    init(maxVoices: Int = 12) {
        engine.attach(voiceMixer)
        engine.attach(reverb)

        reverb.loadFactoryPreset(.mediumRoom)
        reverb.wetDryMix = 16

        engine.connect(voiceMixer, to: reverb, format: nil)
        engine.connect(reverb, to: engine.mainMixerNode, format: nil)

        for _ in 0..<maxVoices {
            let slot = VoiceSlot()
            engine.attach(slot.player)
            engine.attach(slot.pitch)
            engine.connect(slot.player, to: slot.pitch, format: nil)
            engine.connect(slot.pitch, to: voiceMixer, format: nil)
            slots.append(slot)
        }
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    func installLifecycleObservers(on queue: DispatchQueue) {
        guard observers.isEmpty else { return }

        let center = NotificationCenter.default

        observers.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            queue.async {
                do { _ = try self?.activate() } catch {}
            }
        })

        observers.append(center.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            queue.async {
                self?.deactivate()
            }
        })

        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: session,
            queue: nil
        ) { [weak self] notification in
            queue.async {
                self?.handleInterruption(notification)
            }
        })

        observers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: session,
            queue: nil
        ) { [weak self] _ in
            queue.async {
                guard let self else { return }
                if self.sessionActive && !self.engine.isRunning {
                    do { _ = try self.activate() } catch {}
                }
            }
        })
    }

    func activate() throws -> NativeAudioStatus {
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
        sessionActive = true

        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }

        return status()
    }

    func deactivate() {
        stopAll()
        if engine.isRunning {
            engine.pause()
        }
        do {
            try session.setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {}
        sessionActive = false
    }

    func status() -> NativeAudioStatus {
        NativeAudioStatus(
            engineRunning: engine.isRunning,
            sessionActive: sessionActive,
            sampleRate: session.sampleRate,
            outputChannels: Int(session.outputNumberOfChannels),
            cachedBuffers: bufferCache.count
        )
    }

    func playVoices(_ voices: [NativeVoiceRequest]) throws -> Int {
        guard !voices.isEmpty else { return 0 }
        _ = try activate()

        let count = min(voices.count, slots.count)
        let leadSeconds = 0.06
        let baseHostTime = mach_absolute_time() + AVAudioTime.hostTime(forSeconds: leadSeconds)

        var scheduled = 0

        for index in 0..<count {
            let voice = voices[index]
            guard let buffer = try buffer(for: voice.samplePath) else { continue }

            let slot = slots[index]
            slot.generation &+= 1
            let generation = slot.generation

            slot.player.stop()
            slot.pitch.pitch = Float(clamp(voice.pitchCents ?? 0, min: -2400, max: 2400))
            slot.pitch.rate = 1.0
            slot.player.volume = Float(clamp(voice.gain ?? 0.7, min: 0, max: 1))

            slot.player.scheduleBuffer(
                buffer,
                at: nil,
                options: [.interrupts],
                completionHandler: nil
            )

            let delaySeconds = max(0, (voice.delayMs ?? 0) / 1000)
            let startHostTime = baseHostTime + AVAudioTime.hostTime(forSeconds: delaySeconds)
            slot.player.play(at: AVAudioTime(hostTime: startHostTime))

            scheduleRelease(
                slot: slot,
                generation: generation,
                duration: max(0.08, voice.durationSec ?? 1.8),
                initialGain: slot.player.volume
            )

            scheduled += 1
        }

        return scheduled
    }

    func stopAll() {
        for slot in slots {
            slot.generation &+= 1
            slot.player.stop()
            slot.player.volume = 1
        }
    }

    private func handleInterruption(_ notification: Notification) {
        guard
            let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        switch type {
        case .began:
            if engine.isRunning {
                engine.pause()
            }
            sessionActive = false

        case .ended:
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
            if options.contains(.shouldResume) {
                do { _ = try activate() } catch {}
            }

        @unknown default:
            break
        }
    }

    private func scheduleRelease(
        slot: VoiceSlot,
        generation: UInt64,
        duration: TimeInterval,
        initialGain: Float
    ) {
        let fadeDuration = min(0.12, duration * 0.2)
        let fadeStart = max(0.02, duration - fadeDuration)
        let steps = 6

        releaseQueue.asyncAfter(deadline: .now() + fadeStart) { [weak slot] in
            guard let slot, slot.generation == generation else { return }

            for step in 1...steps {
                self.releaseQueue.asyncAfter(
                    deadline: .now() + fadeDuration * Double(step) / Double(steps)
                ) { [weak slot] in
                    guard let slot, slot.generation == generation else { return }
                    let remaining = max(0, 1 - Float(step) / Float(steps))
                    slot.player.volume = initialGain * remaining

                    if step == steps {
                        slot.player.stop()
                        slot.player.volume = initialGain
                    }
                }
            }
        }
    }

    private func buffer(for samplePath: String) throws -> AVAudioPCMBuffer? {
        if let cached = bufferCache[samplePath] {
            return cached
        }

        guard let url = resolveURL(for: samplePath) else {
            throw NSError(
                domain: "HarmonyNativeAudio",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Sample not found in app bundle: \(samplePath)"]
            )
        }

        let file = try AVAudioFile(forReading: url)
        guard
            file.length > 0,
            file.length <= AVAudioFramePosition(UInt32.max),
            let buffer = AVAudioPCMBuffer(
                pcmFormat: file.processingFormat,
                frameCapacity: AVAudioFrameCount(file.length)
            )
        else {
            throw NSError(
                domain: "HarmonyNativeAudio",
                code: 422,
                userInfo: [NSLocalizedDescriptionKey: "Could not allocate audio buffer for \(samplePath)"]
            )
        }

        try file.read(into: buffer)

        // Bound decoded PCM memory. Scheduled buffers are retained by the
        // player node, so clearing this dictionary does not cut off notes that
        // are already playing.
        if bufferCache.count >= 48 {
            bufferCache.removeAll(keepingCapacity: true)
        }
        bufferCache[samplePath] = buffer
        return buffer
    }

    private func resolveURL(for samplePath: String) -> URL? {
        if let resolved = resolveAssetURL?(samplePath), FileManager.default.fileExists(atPath: resolved.path) {
            return resolved
        }

        guard let root = Bundle.main.resourceURL else { return nil }
        let candidate = root
            .appendingPathComponent("public", isDirectory: true)
            .appendingPathComponent(samplePath)

        return FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
    }

    private func clamp(_ value: Double, min minValue: Double, max maxValue: Double) -> Double {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}

@objc(HarmonyNativeAudioPlugin)
public class HarmonyNativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HarmonyNativeAudioPlugin"
    public let jsName = "HarmonyNativeAudio"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise)
    ]

    private let audioQueue = DispatchQueue(
        label: "com.clearvoicing.nativeaudio.engine",
        qos: .userInitiated
    )
    private let implementation = HarmonyNativeAudioEngine()

    public override func load() {
        implementation.resolveAssetURL = { [weak self] path in
            guard
                let webURL = URL(string: "capacitor://localhost/" + path),
                let localURL = self?.bridge?.localURL(fromWebURL: webURL)
            else {
                return nil
            }
            return localURL
        }
        implementation.installLifecycleObservers(on: audioQueue)
    }

    @objc public func initialize(_ call: CAPPluginCall) {
        audioQueue.async { [weak self] in
            guard let self else { return }
            do {
                call.resolve(with: try self.implementation.activate())
            } catch {
                call.reject("Native audio initialization failed", "NATIVE_AUDIO_INIT", error)
            }
        }
    }

    @objc public func activate(_ call: CAPPluginCall) {
        audioQueue.async { [weak self] in
            guard let self else { return }
            do {
                call.resolve(with: try self.implementation.activate())
            } catch {
                call.reject("Could not activate AVAudioSession", "NATIVE_AUDIO_ACTIVATE", error)
            }
        }
    }

    @objc public func playVoices(_ call: CAPPluginCall) {
        do {
            let request = try call.decode(PlayVoicesRequest.self)
            audioQueue.async { [weak self] in
                guard let self else { return }
                do {
                    let scheduled = try self.implementation.playVoices(request.voices)
                    call.resolve(["scheduled": scheduled])
                } catch {
                    call.reject("Native voice playback failed", "NATIVE_AUDIO_PLAY", error)
                }
            }
        } catch {
            call.reject("Invalid native audio request", "NATIVE_AUDIO_REQUEST", error)
        }
    }

    @objc public func stopAll(_ call: CAPPluginCall) {
        audioQueue.async { [weak self] in
            self?.implementation.stopAll()
            call.resolve()
        }
    }

    @objc public func status(_ call: CAPPluginCall) {
        audioQueue.async { [weak self] in
            guard let self else { return }
            call.resolve(with: self.implementation.status())
        }
    }

    @objc public func deactivate(_ call: CAPPluginCall) {
        audioQueue.async { [weak self] in
            self?.implementation.deactivate()
            call.resolve()
        }
    }
}
