import numpy as np
import sounddevice as sd
from music21 import chord

def generate_sine_wave(freq, duration, sample_rate=44100):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    # Simple sine wave
    wave = np.sin(2 * np.pi * freq * t)
    
    # Apply a simple envelope to prevent audio "clicks" at the start and end
    envelope = np.ones_like(wave)
    attack_time = 0.05
    release_time = 0.1
    attack_samples = int(attack_time * sample_rate)
    release_samples = int(release_time * sample_rate)
    
    if attack_samples > 0:
        envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
    if release_samples > 0:
        envelope[-release_samples:] = np.linspace(1, 0, release_samples)
        
    return wave * envelope

def play_chord():
    print("Inizializzazione Ear Training Audio Test...")
    
    try:
        # Define Cmaj7 chord using music21
        cmaj7 = chord.Chord(["C4", "E4", "G4", "B4"])
        print(f"Generazione accordo: {cmaj7.pitchedCommonName}")
        
        sample_rate = 44100
        duration = 2.5  # seconds
        
        # Generate waveform for the chord
        chord_wave = np.zeros(int(sample_rate * duration))
        
        for pitch in cmaj7.pitches:
            freq = pitch.frequency
            print(f"Aggiunta nota {pitch.nameWithOctave} a {freq:.2f} Hz")
            wave = generate_sine_wave(freq, duration, sample_rate)
            chord_wave += wave
            
        # Normalize the audio to prevent clipping
        max_amplitude = np.max(np.abs(chord_wave))
        if max_amplitude > 0:
            chord_wave = chord_wave / max_amplitude
            
        # Reduce overall volume (e.g. to 40%) for a clean timbre
        chord_wave = chord_wave * 0.4
        
        print("Riproduzione audio in corso... (Assicurati che il volume del Mac sia attivo!)")
        sd.play(chord_wave, sample_rate)
        sd.wait()
        print("Riproduzione completata con successo! I driver audio CoreAudio funzionano perfettamente.")
        
    except Exception as e:
        print(f"\n[ERRORE] Si è verificato un problema con l'audio o il driver:")
        print(e)
        print("\nRisoluzione Proposta:")
        print("1. Potresti dover concedere al terminale i permessi per usare l'audio (System Settings -> Privacy & Security -> Microphone).")
        print("2. Assicurati che altre app come DAW esclusive non stiano dominando l'hardware CoreAudio.")
        # Raise for clarity in logs if execution fails
        raise

if __name__ == "__main__":
    play_chord()
