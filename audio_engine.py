import numpy as np
import sounddevice as sd
import threading
import time

class AudioEngine:
    def __init__(self):
        try:
            self.sample_rate = int(sd.query_devices(sd.default.device[1], 'output')['default_samplerate'])
        except Exception:
            self.sample_rate = 44100
            
        self.wave_type = "epiano" 
        
    def set_wave_type(self, wave_type):
        self.wave_type = wave_type
        
    def generate_wave(self, freq, duration):
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        
        if self.wave_type == "sine":
            wave = np.sin(2 * np.pi * freq * t)
        elif self.wave_type == "triangle":
            wave = (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * freq * t))
        elif self.wave_type == "epiano":
            wave = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t) + 0.1 * np.sin(6 * np.pi * freq * t)
        else:
            wave = np.sin(2 * np.pi * freq * t)
            
        envelope = np.ones_like(wave)
        attack = 0.05
        release = 0.1
        attack_samples = int(attack * self.sample_rate)
        release_samples = int(release * self.sample_rate)
        
        if attack_samples > 0 and len(envelope) > attack_samples:
            envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
        if release_samples > 0 and len(envelope) > release_samples:
            envelope[-release_samples:] = np.linspace(1, 0, release_samples)
            
        return wave * envelope

    def play_pitches(self, pitches, duration=2.5, arpeggio=False, arpeggio_delay=0.45, ui_callback=None, done_callback=None):
        if not pitches: return
            
        if not arpeggio:
            chord_wave = np.zeros(int(self.sample_rate * duration))
            for p in pitches:
                chord_wave += self.generate_wave(p.frequency, duration)
        else:
            num_notes = len(pitches)
            chord_dur = duration + arpeggio_delay * (num_notes - 1)
            chord_wave = np.zeros(int(self.sample_rate * chord_dur))
            for i, p in enumerate(pitches):
                wave = self.generate_wave(p.frequency, duration)
                start_idx = int(i * arpeggio_delay * self.sample_rate)
                chord_wave[start_idx:start_idx + len(wave)] += wave
                
        max_amp = np.max(np.abs(chord_wave))
        if max_amp > 0:
            chord_wave = chord_wave / max_amp
        chord_wave *= 0.4
        
        def _play():
            try:
                audio_data = np.ascontiguousarray(chord_wave, dtype=np.float32)
                if ui_callback: ui_callback(0)
                sd.play(audio_data, self.sample_rate)
                sd.wait()
            except Exception as e:
                print(f"Audio Driver Error: {e}")
            finally:
                if done_callback: done_callback()
                
        threading.Thread(target=_play, daemon=True).start()
        
    def play_progression(self, progression_pitches_list, duration=1.5, delay_between=0.2, arpeggio=False, arpeggio_delay=0.35, ui_callback=None, done_callback=None):
        """JIT per-chord playback. Fires ui_callback(i) before each chord, done_callback at end."""
        if not progression_pitches_list: return
        
        def _play():
            try:
                for i, pitches in enumerate(progression_pitches_list):
                    if not pitches:
                        time.sleep(duration + delay_between)
                        continue
                    
                    if not arpeggio:
                        chord_wave = np.zeros(int(self.sample_rate * duration))
                        for p in pitches:
                            chord_wave += self.generate_wave(p.frequency, duration)
                    else:
                        chord_dur = duration + arpeggio_delay * (len(pitches) - 1)
                        chord_wave = np.zeros(int(self.sample_rate * chord_dur))
                        for j, p in enumerate(pitches):
                            wave = self.generate_wave(p.frequency, duration)
                            start_idx = int(j * arpeggio_delay * self.sample_rate)
                            chord_wave[start_idx:start_idx + len(wave)] += wave

                    max_amp = np.max(np.abs(chord_wave))
                    if max_amp > 0: chord_wave /= max_amp
                    chord_wave *= 0.4

                    audio_data = np.ascontiguousarray(chord_wave, dtype=np.float32)
                    if ui_callback: ui_callback(i)
                    sd.play(audio_data, self.sample_rate)
                    sd.wait()
                    time.sleep(delay_between)
            except Exception as e:
                print(f"Audio Driver Error: {e}")
            finally:
                if done_callback: done_callback()
            
        threading.Thread(target=_play, daemon=True).start()

    def play_voice_layer(self, pitches, layer_index, is_progression=False, duration=1.2, delay_between=0.6, ui_callback=None):
        """ Plays a single isolated voice/layer horizontally across the generated context """
        if not pitches: return
        
        if is_progression:
            layer_progression = []
            for chord in pitches:
                if layer_index < len(chord):
                    layer_progression.append([chord[layer_index]])
                else:
                    layer_progression.append([])
            self.play_progression(layer_progression, duration=duration, delay_between=delay_between, arpeggio=False, ui_callback=ui_callback)
        else:
            if layer_index < len(pitches):
                self.play_pitches([pitches[layer_index]], duration=duration, arpeggio=False, ui_callback=ui_callback)
