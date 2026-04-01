import time
import threading
import fluidsynth
import os
import math

# ---------------------------------------------------------------------------
# Ensemble Orchestrale -- 7 canali MIDI
# ch 0 = voce più grave (Contrabbasso), ch 6 = voce più acuta (Flauto)
# ---------------------------------------------------------------------------
ORCHESTRA = [
    ("Contrabbasso", 43, 85),
    ("Violoncello",  42, 82),
    ("Fagotto",      70, 80),
    ("Corno",        60, 78),
    ("Viola",        41, 75),
    ("Clarinetto",   71, 70),
    ("Flauto",       73, 65),
]
NUM_CHANNELS = len(ORCHESTRA)   # 7

# Canale dedicato per preview nota singola (click sul pentagramma)
# Usa canale 8 — fuori dall'orchestra, nessuna interferenza
PREVIEW_CH = 8


class AudioEngine:
    def __init__(self):
        self.fs = fluidsynth.Synth()
        self.fs.start(driver="coreaudio")

        assets_dir = os.path.join(os.path.dirname(__file__), "assets")
        self.sfid = None
        for sf_path in [
            os.path.join(assets_dir, "orchestra.sf2"),
            os.path.join(assets_dir, "piano.sf2"),
        ]:
            if self.sfid is None and os.path.exists(sf_path):
                try:
                    self.sfid = self.fs.sfload(sf_path)
                    print(f"[AudioEngine] SoundFont caricato: {sf_path}")
                except Exception as e:
                    print(f"[AudioEngine] Errore caricamento {sf_path}: {e}")

        if self.sfid is None:
            print("[AudioEngine] WARNING: nessun SoundFont caricato.")

        if self.sfid is not None:
            for ch, (name, program, _) in enumerate(ORCHESTRA):
                try:
                    self.fs.program_select(ch, self.sfid, 0, program)
                    print(f"[AudioEngine] ch{ch} -> {name} (GM {program})")
                except Exception as e:
                    print(f"[AudioEngine] Errore program_select ch{ch}: {e}")
            # Preview channel: Violoncello
            try:
                self.fs.program_select(PREVIEW_CH, self.sfid, 0, 42)
            except Exception:
                pass

        # Generazione playback principale (play_pitches / play_progression).
        # I thread controllano self._gen == loro gen; se diverso, escono.
        self._gen = 0
        self._gen_lock = threading.Lock()

        # Generazione separata per layer/preview, una per canale.
        # Così note su canali diversi non si annullano a vicenda.
        self._layer_gens = [0] * 16  # 16 canali MIDI
        self._layer_lock = threading.Lock()

        self.custom_instruments = list(ORCHESTRA)

    # -----------------------------------------------------------------------
    # Utility interne
    # -----------------------------------------------------------------------

    def _midi(self, pitch_obj):
        """Pitch music21 → MIDI int, clamped 0-127."""
        return max(0, min(127, pitch_obj.midi))

    def _vel(self, ch):
        src = self.custom_instruments if ch < len(self.custom_instruments) else ORCHESTRA
        _, _, v = src[ch]
        return min(127, max(1, int(round(80 * v / 80.0))))

    def _velocity_for_channel(self, ch, base_velocity=80):
        """Alias per compatibilità."""
        return self._vel(ch)

    def _pitch_to_midi(self, pitch_obj):
        """Alias per compatibilità."""
        return self._midi(pitch_obj)

    def _new_session(self):
        """Nuova sessione playback principale: invalida thread attivi e silenzia tutto."""
        with self._gen_lock:
            self._gen += 1
            gen = self._gen
        for ch in range(NUM_CHANNELS):
            try:
                self.fs.all_notes_off(ch)
            except Exception:
                pass
        return gen

    def _new_layer_session(self, ch):
        """Nuova sessione layer per il canale ch: invalida solo il thread precedente su quel canale."""
        with self._layer_lock:
            self._layer_gens[ch] += 1
            gen = self._layer_gens[ch]
        try:
            self.fs.all_notes_off(ch)
        except Exception:
            pass
        return gen

    def _ok_layer(self, gen, ch):
        return gen == self._layer_gens[ch]

    def _ok(self, gen):
        """True se questa sessione è ancora quella corrente (non è stata interrotta)."""
        return gen == self._gen

    def _sleep(self, seconds, gen, step=0.02):
        """Sleep interrompibile per sessione principale."""
        end = time.time() + seconds
        while time.time() < end:
            if not self._ok(gen):
                return False
            time.sleep(min(step, end - time.time()))
        return True

    def _sleep_layer(self, seconds, gen, ch, step=0.02):
        """Sleep interrompibile per sessione layer su canale ch."""
        end = time.time() + seconds
        while time.time() < end:
            if not self._ok_layer(gen, ch):
                return False
            time.sleep(min(step, end - time.time()))
        return True

    def _assign(self, midi_notes):
        """
        Ordina le note (bassa→alta) e assegna i canali orchestra in ordine.
        """
        return [(note, min(i, NUM_CHANNELS - 1))
                for i, note in enumerate(sorted(midi_notes))]

    # -----------------------------------------------------------------------
    # API Pubblica
    # -----------------------------------------------------------------------

    def play_pitches(self, pitches, duration=2.0, arpeggio=False,
                     arpeggio_delay=0.35, ui_callback=None, done_callback=None):
        """Suona un singolo accordo (o arpeggio) in modo asincrono."""
        gen = self._new_session()
        assignments = self._assign([self._midi(p) for p in pitches])

        def _play():
            if ui_callback:
                ui_callback(0)
            if not self._ok(gen):
                return

            if arpeggio:
                for note, ch in assignments:
                    if not self._ok(gen):
                        break
                    self.fs.noteon(ch, note, self._vel(ch))
                    if not self._sleep(arpeggio_delay, gen):
                        break

                stay = duration - len(assignments) * arpeggio_delay
                if stay > 0:
                    self._sleep(stay, gen)
            else:
                for note, ch in assignments:
                    if not self._ok(gen):
                        return
                    self.fs.noteon(ch, note, self._vel(ch))
                self._sleep(duration, gen)

            if self._ok(gen):
                for note, ch in assignments:
                    self.fs.noteoff(ch, note)
            # done_callback sempre chiamata: garantisce _is_playing = False
            if done_callback:
                done_callback()

        threading.Thread(target=_play, daemon=True).start()

    def play_progression(self, chords, duration=1.2, delay_between=0.1,
                         arpeggio=False, arpeggio_delay=0.35,
                         ui_callback=None, done_callback=None):
        """Suona una progressione di accordi in modo asincrono."""
        gen = self._new_session()

        def _play():
            for i, chord in enumerate(chords):
                if not self._ok(gen):
                    return
                if ui_callback:
                    ui_callback(i)

                assignments = self._assign([self._midi(p) for p in chord])

                if arpeggio:
                    for note, ch in assignments:
                        if not self._ok(gen):
                            break
                        self.fs.noteon(ch, note, self._vel(ch))
                        if not self._sleep(arpeggio_delay, gen):
                            break
                    stay = duration - len(assignments) * arpeggio_delay
                    if stay > 0:
                        self._sleep(stay, gen)
                else:
                    for note, ch in assignments:
                        if not self._ok(gen):
                            return
                        self.fs.noteon(ch, note, self._vel(ch))
                    self._sleep(duration, gen)

                if not self._ok(gen):
                    return
                for note, ch in assignments:
                    self.fs.noteoff(ch, note)

                if delay_between > 0:
                    if not self._sleep(delay_between, gen):
                        return

            # done_callback sempre chiamata
            if done_callback:
                done_callback()

        threading.Thread(target=_play, daemon=True).start()

    def play_voice_layer(self, chords, voice_idx, is_progression,
                         duration=1.2, delay_between=0.6, ui_callback=None):
        """Suona solo la voce voice_idx. Usa _layer_gen separato: non invalida il playback principale."""
        ch = min(voice_idx, NUM_CHANNELS - 1)
        gen = self._new_layer_session(ch)

        def _play():
            chord_list = chords if is_progression else [chords[0] if isinstance(chords[0], list) else chords]

            for i, chord in enumerate(chord_list):
                if not self._ok_layer(gen, ch):
                    return
                if ui_callback:
                    ui_callback(i)

                sorted_notes = sorted([self._midi(p) for p in chord])

                if voice_idx < len(sorted_notes):
                    note = sorted_notes[voice_idx]
                    self.fs.noteon(ch, note, self._vel(ch))
                    if not self._sleep_layer(duration, gen, ch):
                        self.fs.noteoff(ch, note)
                        return
                    self.fs.noteoff(ch, note)
                else:
                    self._sleep_layer(duration, gen, ch)

                if is_progression and i < len(chord_list) - 1 and delay_between > 0:
                    if not self._sleep_layer(delay_between, gen, ch):
                        return

        threading.Thread(target=_play, daemon=True).start()

    def play_freq_as_midi(self, freq, duration=1.0, voice_idx=0):
        """
        Preview nota singola cliccata sul pentagramma.
        Usa il canale corretto per la voce (voice_idx) — NON interrompe il playback principale.
        """
        midi_note = max(0, min(127, int(round(69 + 12 * math.log2(freq / 440.0)))))
        ch = min(voice_idx, NUM_CHANNELS - 1)
        gen = self._new_layer_session(ch)

        def _preview():
            if not self._ok_layer(gen, ch):
                return
            try:
                self.fs.noteon(ch, midi_note, self._vel(ch))
                self._sleep_layer(duration, gen, ch)
                self.fs.noteoff(ch, midi_note)
            except Exception as e:
                print(f"[AudioEngine] play_freq_as_midi error: {e}")

        threading.Thread(target=_preview, daemon=True).start()

    def set_instrument_program(self, channel, program):
        """Imposta il programma MIDI per un canale specifico."""
        if self.sfid is not None and 0 <= channel < NUM_CHANNELS:
            try:
                self.fs.program_select(channel, self.sfid, 0, program)
                if channel < len(self.custom_instruments):
                    old = self.custom_instruments[channel]
                    self.custom_instruments[channel] = (old[0], program, old[2])
                print(f"[AudioEngine] Canale {channel} impostato su programma MIDI {program}")
            except Exception as e:
                print(f"[AudioEngine] Errore programma {program} ch{channel}: {e}")

    def set_wave_type(self, wtype):
        """Deprecato — FluidSynth usa i profili SF2."""
        pass
