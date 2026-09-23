export interface NativeVoice {
  samplePath: string;
  pitchCents?: number;
  gain?: number;
  durationSec?: number;
  delayMs?: number;
}

export interface NativeAudioStatus {
  engineRunning: boolean;
  sessionActive: boolean;
  sampleRate: number;
  outputChannels: number;
  cachedBuffers: number;
}

export interface HarmonyNativeAudioPlugin {
  initialize(): Promise<NativeAudioStatus>;
  activate(): Promise<NativeAudioStatus>;
  playVoices(options: { voices: NativeVoice[] }): Promise<{ scheduled: number }>;
  stopAll(): Promise<void>;
  status(): Promise<NativeAudioStatus>;
  deactivate(): Promise<void>;
}

export declare const HarmonyNativeAudio: HarmonyNativeAudioPlugin;
