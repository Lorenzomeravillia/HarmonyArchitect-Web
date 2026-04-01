import time
import threading
import fluidsynth
import os
import math

# ---------------------------------------------------------------------------
# Ensemble Orchestrale -- 7 canali MIDI
#
# Le note vengono ordinate per altezza (MIDI crescente) e assegnate al
# canale corrispondente al loro indice (0 = voce piu' bassa).
# Se un accordo ha N < 7 note, si usano solo i canali 0..N-1.
# ---------------------------------------------------------------------------

# Mapping: indice voce (0=basso) -> (nome, GM program, velocity_base)
ORCHESTRA = [
    ("Contrabbasso", 43, 85),   # ch 0 -- voce piu' grave
    ("Violoncello",  42, 82),   # ch 1
    ("Fagotto",      70, 80),   # ch 2
    ("Corno",        60, 78),   # ch 3
    ("Viola",        41, 75),   # ch 4
    ("Clarinetto",   71, 70),   # ch 5
    ("Flauto",       73, 65),   # ch 6 -- voce piu' acuta
]

NUM_CHANNELS = len(ORCHESTRA)   # 7


class AudioEngine:
    def __init__(self):
        self.fs = fluidsynth.Synth()
        self.fs.start(driver="coreaudio")

        # --- Caricamento SoundFont con fallback ---
        assets_dir = os.path.join(os.path.dirname(__file__), "assets")
        orchestra_sf = os.path.join(assets_dir, "orchestra.sf2")
        piano_sf     = os.path.join(assets_dir, "piano.sf2")

        self.sfid = None
        if os.path.exists(orchestra_sf):
            try:
                self.sfid = self.fs.sfload(orchestra_sf)
                print(f"[AudioEngine] SoundFont caricato: {orchestra_sf}")
            except Exception as e:
                print(f"[AudioEngine] Errore caricamento orchestra.sf2: {e}")

        if self.sfid is None and os.path.exists(piano_sf):
            try:
                self.sfid = self.fs.sfload(piano_sf)
                print(f"[AudioEngine] Fallback SoundFont: {piano_sf}")
            except Exception as e:
                print(f"[AudioEngine] Errore caricamento piano.sf2: {e}")

        if self.sfid is None:
            print("[AudioEngine] WARNING: nessun SoundFont caricato.")

        # --- Configurazione canali MIDI ---
        if self.sfid is not None:
            for ch, (name, program, _vel) in enumerate(ORCHESTRA):
                try:
                    self.fs.program_select(ch, self.sfid, 0, program)
                    print("[AudioEngine] ch" + str(ch) + " -> " + name + " (GM " + str(program) + ")")
                except Exception as e:
                    print(f"[AudioEngine] Errore program_select ch{ch}: {e}")

        # --- Thread safety ---
        self._play_lock   = threading.Lock()   # evita interleaving noteon/noteoff
        self._stop_event  = threading.Event()  # segnale di stop ai thread attivi
        
        # --- Mappa strumenti personalizzati ---
        self.custom_instruments = list(ORCHESTRA)  # Copia della configurazione originale

    # -----------------------------------------------------------------------
    # Metodi interni
    # -----------------------------------------------------------------------

    def _pitch_to_midi(self, pitch_obj):
        """Converte un oggetto pitch music21 in numero MIDI."""
        return pitch_obj.midi

    def _velocity_for_channel(self, ch: int, base_velocity: int = 80) -> int:
        """
        Scala la velocity base per il canale dato, mantenendo le proporzioni
        relative tra gli strumenti.
        Ratio = vel_strumento / 80 (velocity di riferimento).
        """
        if ch < len(self.custom_instruments):
            _, _, vel_ref = self.custom_instruments[ch]
        else:
            _, _, vel_ref = ORCHESTRA[ch]
        ratio = vel_ref / 80.0
        return min(127, max(1, int(round(base_velocity * ratio))))

    def _stop_playback(self):
        """
        Segnala ai thread attivi di fermarsi e manda all_notes_off
        su tutti i canali per evitare note appese.
        """
        self._stop_event.set()
        for ch in range(NUM_CHANNELS):
            try:
                self.fs.all_notes_off(ch)
            except Exception:
                pass

    def _assign_channels(self, midi_notes: list) -> list:
        """
        Ordina le note per altezza MIDI (bassa → alta) e restituisce
        una lista di (midi_note, channel) per la riproduzione.
        La voce più bassa va al ch 0 (Contrabbasso), la più alta al max ch.
        """
        sorted_notes = sorted(midi_notes)
        # Se più note di canali disponibili, comprimi tutto in NUM_CHANNELS
        n = len(sorted_notes)
        assignments = []
        for i, note in enumerate(sorted_notes):
            ch = min(i, NUM_CHANNELS - 1)
            assignments.append((note, ch))
        return assignments

    # -----------------------------------------------------------------------
    # API Pubblica
    # -----------------------------------------------------------------------

    def play_pitches(self, pitches, duration=2.0, arpeggio=False,
                     arpeggio_delay=0.35, ui_callback=None, done_callback=None):
        """Suona un singolo accordo (o arpeggio) in modo asincrono."""

        def _play():
            # Ferma eventuali riproduzioni precedenti
            self._stop_playback()
            self._stop_event.clear()

            if ui_callback:
                ui_callback(0)

            midi_notes   = [self._pitch_to_midi(p) for p in pitches]
            assignments  = self._assign_channels(midi_notes)

            with self._play_lock:
                if arpeggio:
                    for note, ch in assignments:
                        if self._stop_event.is_set():
                            break
                        vel = self._velocity_for_channel(ch)
                        self.fs.noteon(ch, note, vel)
                        time.sleep(arpeggio_delay)

                    stay_time = duration - len(assignments) * arpeggio_delay
                    if stay_time > 0 and not self._stop_event.is_set():
                        time.sleep(stay_time)

                    for note, ch in assignments:
                        self.fs.noteoff(ch, note)
                else:
                    for note, ch in assignments:
                        if self._stop_event.is_set():
                            break
                        vel = self._velocity_for_channel(ch)
                        self.fs.noteon(ch, note, vel)

                    if not self._stop_event.is_set():
                        time.sleep(duration)

                    for note, ch in assignments:
                        self.fs.noteoff(ch, note)

            if done_callback and not self._stop_event.is_set():
                done_callback()

        threading.Thread(target=_play, daemon=True).start()

    def play_progression(self, chords, duration=1.2, delay_between=0.1,
                         arpeggio=False, arpeggio_delay=0.35,
                         ui_callback=None, done_callback=None):
        """Suona una progressione di accordi in modo asincrono."""

        def _play():
            self._stop_playback()
            self._stop_event.clear()

            for i, chord in enumerate(chords):
                if self._stop_event.is_set():
                    break

                if ui_callback:
                    ui_callback(i)

                midi_notes  = [self._pitch_to_midi(p) for p in chord]
                assignments = self._assign_channels(midi_notes)

                with self._play_lock:
                    if arpeggio:
                        for note, ch in assignments:
                            if self._stop_event.is_set():
                                break
                            vel = self._velocity_for_channel(ch)
                            self.fs.noteon(ch, note, vel)
                            time.sleep(arpeggio_delay)

                        stay_time = duration - len(assignments) * arpeggio_delay
                        if stay_time > 0 and not self._stop_event.is_set():
                            time.sleep(stay_time)

                        for note, ch in assignments:
                            self.fs.noteoff(ch, note)
                    else:
                        for note, ch in assignments:
                            if self._stop_event.is_set():
                                break
                            vel = self._velocity_for_channel(ch)
                            self.fs.noteon(ch, note, vel)

                        if not self._stop_event.is_set():
                            time.sleep(duration)

                        for note, ch in assignments:
                            self.fs.noteoff(ch, note)

                if not self._stop_event.is_set():
                    time.sleep(delay_between)

            if done_callback and not self._stop_event.is_set():
                done_callback()

        threading.Thread(target=_play, daemon=True).start()

    def play_voice_layer(self, chords, voice_idx, is_progression,
                         duration=1.2, delay_between=0.6, ui_callback=None):
        """
        Suona solo la voce all'indice voice_idx sull'accordo/progressione.
        Il canale MIDI usato corrisponde all'indice della voce nell'ensemble.
        """
        # Il canale corrisponde alla voce (0=bassa, 6=alta), clamped
        ch = min(voice_idx, NUM_CHANNELS - 1)
        vel = self._velocity_for_channel(ch)

        def _play():
            if is_progression:
                for i, chord in enumerate(chords):
                    if ui_callback:
                        ui_callback(i)
                    if voice_idx < len(chord):
                        # Ordina le note per assegnare correttamente l'indice
                        sorted_notes = sorted(
                            [self._pitch_to_midi(p) for p in chord]
                        )
                        if voice_idx < len(sorted_notes):
                            note = sorted_notes[voice_idx]
                            self.fs.noteon(ch, note, vel)
                            time.sleep(duration)
                            self.fs.noteoff(ch, note)
                        else:
                            time.sleep(duration)
                    else:
                        time.sleep(duration)
                    time.sleep(delay_between)
            else:
                if ui_callback:
                    ui_callback(0)
                chord = chords[0] if isinstance(chords[0], list) else chords
                if voice_idx < len(chord):
                    sorted_notes = sorted(
                        [self._pitch_to_midi(p) for p in chord]
                    )
                    if voice_idx < len(sorted_notes):
                        note = sorted_notes[voice_idx]
                        self.fs.noteon(ch, note, vel)
                        time.sleep(duration)
                        self.fs.noteoff(ch, note)

        threading.Thread(target=_play, daemon=True).start()

    def play_freq_as_midi(self, freq, duration=1.5):
        """Usato per le singole note cliccabili sul pentagramma UI."""
        midi_note = int(round(69 + 12 * math.log2(freq / 440.0)))
        # Usa ch 0 (Contrabbasso) come default per singola nota
        vel = self._velocity_for_channel(0)
        self.fs.noteon(0, midi_note, vel)
        time.sleep(duration)
        self.fs.noteoff(0, midi_note)

    def set_instrument_program(self, channel, program):
        """Imposta il programma MIDI per un canale specifico."""
        if self.sfid is not None and 0 <= channel < NUM_CHANNELS:
            try:
                self.fs.program_select(channel, self.sfid, 0, program)
                # Aggiorna la mappa degli strumenti personalizzati
                if channel < len(self.custom_instruments):
                    old_name, old_prog, old_vel = self.custom_instruments[channel]
                    # Manteniamo il nome originale per ora, potremmo aggiornarlo se avessimo una mappa inversa
                    self.custom_instruments[channel] = (old_name, program, old_vel)
                print(f"[AudioEngine] Canale {channel} impostato su programma MIDI {program}")
            except Exception as e:
                print(f"[AudioEngine] Errore impostazione programma {program} su canale {channel}: {e}")

    def set_wave_type(self, wtype):
        """Deprecato — FluidSynth usa i profili SF2 automaticamente."""
        pass
