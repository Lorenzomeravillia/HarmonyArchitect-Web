"""
Controller principale per HarmonyArchitect con integrazione completa
del sistema pedagogico avanzato e dashboard statistiche.
"""

import random
import re
import traceback
import threading
from music21 import pitch
from datetime import datetime
import uuid

from harmony_engine import HarmonyEngine
from audio_engine import AudioEngine
from core.database.db_manager import DBManager, PracticeRecord
from core.models.exercise_model import ErrorCategory
from core.pedagogy.error_classifier import ErrorClassifier
from core.pedagogy.theory_advisor import TheoryAdvisor
from core.pedagogy.spaced_repetition import SpacedRepetitionEngine
from core.analytics.stats_dashboard import StatsDashboard

class AppController:
    def __init__(self, view):
        self.view = view
        self.harmony_engine = HarmonyEngine()
        self.audio_engine = AudioEngine()
        self.db_manager = DBManager()
        
        # Sistema pedagogico avanzato
        self.error_classifier = ErrorClassifier()
        self.theory_advisor = TheoryAdvisor()
        self.spaced_repetition_engine = SpacedRepetitionEngine()
        self.stats_dashboard = StatsDashboard(self.db_manager)
        
        self.current_target = None
        self.current_pitches = None
        self.correct_answer = None
        self._is_playing = False
        
        self.score_correct = 0
        self.score_total = 0
        self.current_combo = 0
        self.first_attempt = True
        self.last_target = None
        
        # Cronologia errori per analisi pattern
        self.error_history = []
        
        self.level_pools_single = {
            "1: Triadi Base": ["C", "Cm", "Cdim", "Caug", "F", "Fm", "G", "Gm", "Bb", "D", "Am"],
            "2: Settime (Drop 2)": ["Cmaj7", "Cm7", "C7", "Cm7b5", "Fmaj7", "G7", "Bbmaj7", "Ddim7"],
            "3: Jazz Extensions": ["Cmaj9", "C9", "C13", "G7alt", "G7b9", "Bb7#11", "D-9", "Fm9"],
            "4: Advanced (Subs/Alt)": ["A7alt", "Db7", "E7#9", "B13b9", "F#7b9"]
        }
        
        self.level_pools_prog = {
            "1: Triadi Base": [
                {"name": "I - IV - V - I\n(C - F - G - C)", "chords": "C|F|G|C"},
                {"name": "I - vi - IV - V\n(C - Am - F - G)", "chords": "C|Am|F|G"},
                {"name": "i - iv - V - i\n(Cm - Fm - G - Cm)", "chords": "Cm|Fm|G|Cm"},
                {"name": "i - VI - VII - i\n(Cm - Ab - Bb - Cm)", "chords": "Cm|Ab|Bb|Cm"},
                {"name": "I - ii - V - I\n(C - Dm - G - C)", "chords": "C|Dm|G|C"}
            ],
            "2: Settime (Drop 2)": [
                {"name": "ii7 - V7 - Imaj7\n(Dm7 - G7 - Cmaj7)", "chords": "Dm7|G7|Cmaj7"},
                {"name": "iiø7 - V7 - im7\n(Dm7b5 - G7 - Cm7)", "chords": "Dm7b5|G7|Cm7"},
                {"name": "Imaj7 - vi7 - ii7 - V7\n(Cmaj7 - Am7 - Dm7 - G7)", "chords": "Cmaj7|Am7|Dm7|G7"},
                {"name": "iim7 - v7 - Imaj7\n(Fm7 - Bb7 - Ebmaj7)", "chords": "Fm7|Bb7|Ebmaj7"}
            ],
            "3: Jazz Extensions": [
                {"name": "ii9 - V13 - Imaj9\n(Dm9 - G13 - Cmaj9)", "chords": "Dm9|G13|Cmaj9"},
                {"name": "iiø7 - V7alt - im9\n(Dm7b5 - G7alt - Cm9)", "chords": "Dm7b5|G7alt|Cm9"},
                {"name": "Imaj9 - VI7alt - ii9 - V13\n(Cmaj9 - A7alt - Dm9 - G13)", "chords": "Cmaj9|A7alt|Dm9|G13"}
            ],
            "4: Advanced (Subs/Alt)": [
                {"name": "ii7 - subV7 - Imaj7\n(Dm7 - Db7 - Cmaj7)", "chords": "Dm7|Db7|Cmaj7"},
                {"name": "V7/ii - ii7 - V7 - Imaj7\n(A7 - Dm7 - G7 - Cmaj7)", "chords": "A7|Dm7|G7|Cmaj7"},
                {"name": "iim7 - subV7 - Imaj7\n(Fm7 - E7 - Ebmaj7)", "chords": "Fm7|E7|Ebmaj7"}
            ]
        }
        
    def start(self):
        try:
            self.view.set_controller(self)
            self._bind_shortcuts()
            
            # Posticipa l'update_score per dare tempo alla GUI di inizializzarsi
            # Usa after() per chiamata differita quando tutti i widget sono pronti
            def delayed_initialization():
                # Initial load for global stats
                _, _, global_rate = self.db_manager.get_global_win_rate()
                self.view.update_score(self.score_correct, self.score_total, global_rate, self.current_combo)
                self.on_new_challenge()
            
            # Chiama dopo 100ms per garantire che la GUI sia completamente inizializzata
            self.view.after(100, delayed_initialization)
            
        except Exception as e:
            self.view.show_error("Errore di Inizializzazione", str(e), traceback.format_exc())

    def _bind_shortcuts(self):
        self.view.bind("<space>", lambda e: self.on_play())
        self.view.bind("s", lambda e: self.on_arpeggio())
        self.view.bind("S", lambda e: self.on_arpeggio())
        self.view.bind("1", lambda e: self.on_check_answer(0))
        self.view.bind("2", lambda e: self.on_check_answer(1))
        self.view.bind("3", lambda e: self.on_check_answer(2))
        self.view.bind("4", lambda e: self.on_check_answer(3))
        self.view.bind("<Return>", lambda e: self.on_new_challenge())
        self.view.bind("n", lambda e: self.on_new_challenge())
        self.view.bind("N", lambda e: self.on_new_challenge())
        # Shortcut per dashboard statistiche
        self.view.bind("d", lambda e: self.on_stats_dashboard())
        self.view.bind("D", lambda e: self.on_stats_dashboard())

    def safe_audio_call(self, func, *args, **kwargs):
        """Wrapper for robust audio engine calls."""
        try:
            func(*args, **kwargs)
        except Exception as e:
            self._is_playing = False
            self.view.show_error("Audio Engine Error", "Si è verificato un problema nella riproduzione audio.", traceback.format_exc())

    def safe_harmony_call(self, func, *args, **kwargs):
        """Wrapper for robust harmony engine calls."""
        try:
            return func(*args, **kwargs)
        except Exception as e:
            self._is_playing = False
            self.view.show_error("Harmony Engine Error", "Si è verificato un errore nel calcolo armonico.", traceback.format_exc())
            return None

    def on_settings_change(self):
        oct_map = {"C3": 3, "C4": 4}
        self.harmony_engine.set_base_octave(oct_map.get(self.view.octave_var.get(), 4))
        if self.current_target is not None:
            self.on_new_challenge()
            
    def on_instrument_change(self, voice_idx):
        """Gestisce il cambio di strumento per una voce specifica"""
        if hasattr(self.view, 'voice_instrument_vars') and voice_idx < len(self.view.voice_instrument_vars):
            instrument_name = self.view.voice_instrument_vars[voice_idx].get()
            # Mappa nome strumento a programma MIDI
            instrument_map = {
                "Contrabbasso": 43,
                "Violoncello": 42,
                "Fagotto": 70,
                "Corno": 60,
                "Viola": 41,
                "Clarinetto": 71,
                "Flauto": 73,
                "Piano": 0,
                "Chitarra": 24,
                "Violino": 40,
                "Tromba": 56,
                "Sassofono": 66,
                "Organo": 16,
                "Arpa": 46
            }
            program = instrument_map.get(instrument_name, 0)
            
            # Aggiorna il programma MIDI per il canale corrispondente
            try:
                self.audio_engine.set_instrument_program(voice_idx, program)
                print(f"[Controller] Voce {voice_idx} impostata su {instrument_name} (program {program})")
            except Exception as e:
                print(f"[Controller] Errore impostazione strumento per voce {voice_idx}: {e}")

    def on_level_change(self, choice):
        self.on_new_challenge()

    def _update_pitches(self):
        target = self.current_target
        if not target: return
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        vl_mode = self.view.voice_leading_var.get()
        
        def _compute():
            if is_progression:
                chords = target["chords"].split("|")
                if vl_mode == "Optimized":
                    raw_chords = [self.harmony_engine.get_pitches_from_symbol(c) for c in chords]
                    self.current_pitches = self.harmony_engine.apply_progression_voicing(raw_chords)
                else:
                    self.current_pitches = []
                    for c in chords:
                        raw_p = self.harmony_engine.get_pitches_from_symbol(c)
                        v_p = self.harmony_engine.apply_voicing(raw_p, strategy="drop2")
                        self.current_pitches.append(v_p)
            else:
                raw_p = self.harmony_engine.get_pitches_from_symbol(target)
                if self.view.level_var.get().startswith("1"):
                    self.current_pitches = raw_p 
                else:
                    self.current_pitches = self.harmony_engine.apply_voicing(raw_p, strategy="drop2")
                    
        self.safe_harmony_call(_compute)

    def on_new_challenge(self):
        self.first_attempt = True
        
        if not hasattr(self, '_esc_shown'):
            self.view.update_insight("🎵 Premi [Esc] per uscire dalla modalità a Schermo Intero 🎵")
            self._esc_shown = True
        else:
            self.view.update_insight("")
            
        self.view.draw_empty_staff()
        self.view.reset_solo_buttons()
        
        level = self.view.level_var.get()
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        is_adaptive = (self.view.training_var.get() == "Adaptive")
        pool = self.level_pools_prog[level] if is_progression else self.level_pools_single[level]
        
        target = None
        
        if is_adaptive:
            stats = self.db_manager.get_level_stats(level)
            total_history_records = sum(s[1] for s in stats.values())
            
            # Soglia ridotta a 5 record (miglioramento pedagogico)
            if total_history_records < 5:
                print(f"\n--- ADAPTIVE ENGINE: Not enough data for level '{level}' ({total_history_records}/5). Fallback to Random ---")
            else:
                print(f"\n===== ADAPTIVE ENGINE DEBUG =====")
                print(f"Level: {level} | Storico: {total_history_records} records")
                print(f"{'CANDIDATE':<25} | {'WIN RATE':<10} | {'WEIGHT':<10}")
                print("-" * 55)
                
                weights = []
                for item in pool:
                    name = item["name"] if is_progression else item
                    name_clean = name.replace("\n", " ")
                    is_last = (item == self.last_target)
                    
                    if is_last:
                        w = 0.0
                        print(f"{name_clean:<30} | {'--':>9} | {w:>8.1f} (Anti-Ripetizione)")
                    elif name_clean in stats:
                        _, _, wr = stats[name_clean]
                        # Peso temporale: errori recenti pesano più
                        w = max(0.2, (100 - wr) / 20.0)
                        
                        # Considera spaced repetition se disponibile
                        sr_priority = self.spaced_repetition_engine.get_exercise_priority(name_clean)
                        if sr_priority > 5.0:
                            w *= 1.5  # Incrementa peso per esercizi con alta priorità spaced repetition
                        
                        print(f"{name_clean:<30} | {wr:>8.1f}% | {w:>8.1f}")
                    else:
                        w = 2.0
                        print(f"{name_clean:<30} | {'N/A':>9} | {w:>8.1f}")
                    weights.append(w)
                    
                total_w = sum(weights)
                print("-" * 55)
                
                r = random.uniform(0, total_w)
                upto = 0
                chosen_idx = 0
                for i, w in enumerate(weights):
                    if upto + w >= r:
                        chosen_idx = i
                        break
                    upto += w
                    
                target = pool[chosen_idx]
                chosen_name = target["name"].replace("\n", " ") if is_progression else target
                chosen_weight = weights[chosen_idx]
                
                print(f"🎯 SCELTO: {chosen_name} (perché aveva il peso {chosen_weight:.1f})")
                print(f"=================================\n")
                
                if chosen_weight > 1.0:
                    self.view.show_ai_focus()
                    
        if target is None:
            safe_pool = [x for x in pool if x != self.last_target]
            target = random.choice(safe_pool if safe_pool else pool)
            
        self.last_target = target
        self.current_target = target
        self.correct_answer = target
        self._update_pitches()
        
        # SMART DISTRACTORS (Root Lock)
        target_root = "C"
        if is_progression:
            name_p = target["name"]
            rn_part, chords_part = name_p.split('\n')
            chs = [c.strip() for c in chords_part.replace('(', '').replace(')', '').split('-')]
            rns = [r.strip() for r in rn_part.split('-')]
            for i, rn in enumerate(rns):
                if rn in ['I', 'i', 'Imaj7', 'Imaj9', 'im7', 'im9', 'i7']:
                    m = re.match(r"^([A-G][b#]?)", chs[i])
                    if m: target_root = m.group(1); break
            else:
                m = re.match(r"^([A-G][b#]?)", chs[-1])
                if m: target_root = m.group(1)
        else:
            m = re.match(r"^([A-G][b#]?)",  target)
            if m: target_root = m.group(1)
            
        wrong_options = []
        pool_copy = [x for x in pool if x != target]
        random.shuffle(pool_copy)
        
        for item in pool_copy:
            if len(wrong_options) >= 3:
                break
            if is_progression:
                distractor = self._transpose_progression(item, target_root)
                if distractor["chords"] != target["chords"] and distractor["chords"] not in [w["chords"] for w in wrong_options]:
                    wrong_options.append(distractor)
            else:
                distractor = self._transpose_single(item, target_root)
                if distractor != target and distractor not in wrong_options:
                    wrong_options.append(distractor)
                    
        # Fallback padding just in case
        if len(wrong_options) < 3:
            for item in pool_copy:
                if len(wrong_options) >= 3: break
                if item not in wrong_options and item != target:
                    wrong_options.append(item)
                    
        font_size = 13 if is_progression else 20
        all_options = [target] + wrong_options
        random.shuffle(all_options)
        
        self.view.setup_answer_buttons(all_options, is_progression, font_size)

    def _transpose_single(self, chord_str, target_root):
        m = re.match(r"^([A-G][b#]?)(.*)", chord_str)
        qual = m.group(2) if m else ""
        return target_root + qual

    def _transpose_progression(self, prog_dict, target_key):
        chromatic = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
        flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
        name = prog_dict["name"]
        rn_part, chords_part = name.split('\n')
        chords = [c.strip() for c in chords_part.replace('(', '').replace(')', '').split('-')]
        rns = [r.strip() for r in rn_part.split('-')]
        
        orig_key = "C"
        for i, rn in enumerate(rns):
            if rn in ['I', 'i', 'Imaj7', 'Imaj9', 'im7', 'im9', 'i7']:
                m = re.match(r"^([A-G][b#]?)", chords[i])
                if m: orig_key = m.group(1); break
        else:
            m = re.match(r"^([A-G][b#]?)", chords[-1])
            if m: orig_key = m.group(1)
            
        orig_idx = chromatic.get(orig_key, 0)
        target_idx = chromatic.get(target_key, 0)
        diff = target_idx - orig_idx
        
        new_chords = []
        for c in chords:
            m = re.match(r"^([A-G][b#]?)(.*)", c)
            if m:
                idx = (chromatic.get(m.group(1), 0) + diff) % 12
                new_chords.append(flats[idx] + m.group(2))
            else:
                new_chords.append(c)
        
        new_str = " - ".join(new_chords)
        return {"name": f"{rn_part}\n({new_str})", "chords": "|".join(new_chords)}

    def on_check_answer(self, btn_index):
        if btn_index >= len(self.view.answer_buttons): return
        btn = self.view.answer_buttons[btn_index]
        if hasattr(btn, "option_value"):
            val = btn.option_value
        else:
            return
            
        if not val: return
        
        correct = (val == self.correct_answer)
        error_category = None

        if self.first_attempt:
            self.score_total += 1
            if correct:
                self.score_correct += 1
                self.current_combo += 1
            else:
                self.current_combo = 0
                
            level_name = self.view.level_var.get()
            is_progression = (self.view.play_mode_var.get() == "Progressione")
            req_name = self.correct_answer["name"].replace("\n", " ") if is_progression else self.correct_answer
            
            # Classifica errore se presente
            if not correct:
                exercise_type = "progression" if is_progression else "single_chord"
                correct_chord = self.correct_answer["chords"] if is_progression else self.correct_answer
                user_answer = val["chords"] if is_progression else val
                
                error_category = self.error_classifier.classify_error(
                    correct_chord, user_answer, exercise_type
                )
                
                # Aggiungi alla cronologia errori
                if error_category:
                    self.error_history.append(error_category)
                    # Mantieni solo ultimi 10 errori
                    if len(self.error_history) > 10:
                        self.error_history = self.error_history[-10:]
            
            # Registra pratica con metadati avanzati
            # I modelli sono ora importati in cima al file
            
            record = PracticeRecord(
                record_id=str(uuid.uuid4()),
                timestamp=datetime.now().isoformat(),
                level=level_name,
                exercise_id=req_name,
                is_correct=correct,
                error_category=error_category
            )
            
            self.db_manager.record_practice_async(record)
            
            # Aggiorna spaced repetition
            if error_category:
                self.spaced_repetition_engine.update_exercise(
                    req_name, correct, confidence=3
                )
            
            # Fetch global stats
            _, _, global_rate = self.db_manager.get_global_win_rate()
            
            self.view.update_score(self.score_correct, self.score_total, global_rate, self.current_combo)
            self.first_attempt = False
            
        btn_text = btn.cget('text').replace("✅ ", "").replace("❌ ", "")
        
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        if is_progression:
            name_str = self.correct_answer["name"].replace("\n", " ")
            msg = f"{'Corretto.' if correct else 'Errato.'} {name_str}.\n"
        else:
            msg = f"{'Corretto.' if correct else 'Errato.'} Accordo: {self.correct_answer}.\n"
            
        # Aggiungi suggerimento pedagogico
        if correct:
            # Suggerimento per progresso
            suggestion = self.theory_advisor.get_suggestion(
                None,  # Nessun errore
                self.view.level_var.get(),
                self.error_history
            )
            msg += f"\n{suggestion}"
        else:
            # Suggerimento per errore specifico
            if error_category:
                suggestion = self.theory_advisor.get_suggestion(
                    error_category,
                    self.view.level_var.get(),
                    self.error_history
                )
                msg += f"\n{suggestion}"
            
        if correct:
            self.view.mark_answer_correct(btn, btn_text)
            self.view.update_insight(msg)
            
            # Use safe call to get root pcs and render pitch drawing
            def _draw():
                symbols = self.current_target["chords"].split("|") if is_progression else [self.current_target]
                self.view.draw_pitches_on_staff(self.current_pitches, symbols, is_progression)
                
                chords = self.current_pitches if isinstance(self.current_pitches[0], list) else [self.current_pitches]
                max_notes = max(len(c) for c in chords)
                self.view.enable_solo_buttons(max_notes)
                
            self.safe_harmony_call(_draw)
        else:
            self.view.mark_answer_wrong(btn, btn_text)
            self.view.update_insight(msg)

    def on_play(self):
        if not self.current_pitches or self._is_playing: return
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        dur = 1.2 if is_progression else 2.0
        self._is_playing = True
        
        self.view.pulse_play_btn(6)
        
        def ui_sync(idx):
            self.view.after(0, lambda: self.view.dynamically_glow_solo(
                idx, dur, 0.1, False, self.current_pitches, self.current_target, is_progression))
            self.view.after(0, lambda: self.view.pulse_notes(idx, dur * 900))
        
        def on_done():
            self.view.after(0, lambda: setattr(self, '_is_playing', False))
            
        if is_progression:
            self.safe_audio_call(self.audio_engine.play_progression, self.current_pitches, duration=dur, delay_between=0.1, ui_callback=ui_sync, done_callback=on_done)
        else:
            self.safe_audio_call(self.audio_engine.play_pitches, self.current_pitches, duration=dur, ui_callback=ui_sync, done_callback=on_done)

    def on_arpeggio(self):
        if not self.current_pitches or self._is_playing: return
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        dur = 1.5
        arp_delay_ms = 350
        self._is_playing = True
        
        self.view.pulse_play_btn(6)
        
        def ui_sync(idx):
            self.view.after(0, lambda: self.view.dynamically_glow_solo(
                idx, dur, 0.8 if is_progression else 0, True, self.current_pitches, self.current_target, is_progression))
            self.view.after(0, lambda: self.view.pulse_notes_arpeggio(idx, arp_delay_ms, dur * 900))
        
        def on_done():
            self.view.after(0, lambda: setattr(self, '_is_playing', False))
            
        if is_progression:
            self.safe_audio_call(self.audio_engine.play_progression, self.current_pitches, duration=dur, delay_between=0.8, arpeggio=True, arpeggio_delay=arp_delay_ms/1000, ui_callback=ui_sync, done_callback=on_done)
        else:
            self.safe_audio_call(self.audio_engine.play_pitches, self.current_pitches, duration=dur, arpeggio=True, arpeggio_delay=arp_delay_ms/1000, ui_callback=ui_sync, done_callback=on_done)

    def on_play_layer(self, layer_idx):
        if not self.current_pitches: return
        is_progression = (self.view.play_mode_var.get() == "Progressione")
        dur = 1.2 if is_progression else 2.0
        
        def ui_sync(idx):
            self.view.after(0, lambda: self.view.dynamically_glow_solo(
                idx, dur, 0.1, False, self.current_pitches, self.current_target, is_progression))
            self.view.after(0, lambda: self.view.pulse_note_single(idx, layer_idx, dur * 900))
            
        self.view.pulse_play_btn(6)
        self.safe_audio_call(self.audio_engine.play_voice_layer, self.current_pitches, layer_idx, is_progression, duration=dur, delay_between=0.6, ui_callback=ui_sync)

    def play_frequency(self, freq, voice_idx=0):
        """Called by the View when clicking a note oval."""
        def _play():
            try:
                self.audio_engine.play_freq_as_midi(freq, 1.0, voice_idx=voice_idx)
            except Exception as e:
                print(f"[play_frequency] Errore: {e}")
        threading.Thread(target=_play, daemon=True).start()

    def on_stats_dashboard(self):
        """Mostra la dashboard delle statistiche"""
        try:
            summary = self.stats_dashboard.get_summary_stats(30)
            insights = self.stats_dashboard.get_progress_insights(30)
            
            # Formatta dashboard
            dashboard_text = f"""
📊 DASHBOARD STATISTICHE 📊

🎯 Progresso Globale:
• Sessioni: {summary.total_sessions}
• Esercizi: {summary.total_exercises}
• Win Rate: {summary.overall_win_rate:.1f}%
• Streak corrente: {summary.current_streak}
• Streak massimo: {summary.best_streak}
• Tempo medio risposta: {summary.avg_response_time_ms:.0f}ms

📈 Performance:
• Livello preferito: {summary.favorite_level}
• Categoria più debole: {summary.weakest_category}
• Categoria più forte: {summary.strongest_category}

💡 Insights Pedagogici:
"""
            
            for insight in insights:
                dashboard_text += f"• {insight}\n"
            
            dashboard_text += "\n🎵 Premi [d] per vedere grafici avanzati"
            
            self.view.update_insight(dashboard_text)
            
            # Mostra anche un grafico semplice
            win_rate_chart = self.stats_dashboard.get_win_rate_chart(14)
            self.view.show_info(
                "Dashboard Statistiche",
                dashboard_text,
                "Le statistiche complete sono disponibili nella dashboard avanzata."
            )
            
        except Exception as e:
            self.view.show_error("Errore Dashboard", f"Impossibile generare dashboard: {str(e)}", traceback.format_exc())

    def on_reset_history(self):
        def _on_cleared():
            self.score_correct = 0
            self.score_total = 0
            self.current_combo = 0
            self.error_history = []
            self.view.after(0, lambda: self.view.update_score(0, 0, 0.0, 0))
            
        def _confirm():
            self.db_manager.clear_history_async(callback=_on_cleared)
            
        self.view.ask_confirmation(
            "Azzeramento Progressi", 
            "Vuoi davvero azzerare i tuoi progressi?\nQuesta azione eliminerà il Win Rate Globale e non può essere annullata.",
            _confirm
        )