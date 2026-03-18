import customtkinter as ctk
import random
import re
from music21 import pitch
from harmony_engine import HarmonyEngine
from audio_engine import AudioEngine

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class HardwareButton(ctk.CTkCanvas):
    def __init__(self, master, width=320, height=60, text="", c_top="#3A6B9C", c_bot="#182A4A", command=None, font=("Arial", 16, "bold")):
        super().__init__(master, width=width, height=height, bg="#1C2541", highlightthickness=0)
        self.w = width
        self.h = height
        self.text = text
        self.c_top = c_top
        self.c_bot = c_bot
        self.command = command
        self.font = font
        
        self.bind("<Button-1>", self.on_press)
        self.bind("<ButtonRelease-1>", self.on_release)
        self.draw(pressed=False)
        
    def draw(self, pressed=False, glow_override=None):
        self.delete("all")
        
        def hex2rgb(h): return tuple(int(h.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        
        c_t = glow_override if glow_override else self.c_top
        c_b = self.c_bot
            
        r1, g1, b1 = hex2rgb(c_t)
        r2, g2, b2 = hex2rgb(c_b)
        
        if pressed:
            r1, r2, g1, g2, b1, b2 = r2, r1, g2, g1, b2, b1
            
        # Sfondo Bombato Gradiente Lineare
        for y in range(self.h):
            r = int(r1 + (r2 - r1) * y / self.h)
            g = int(g1 + (g2 - g1) * y / self.h)
            b = int(b1 + (b2 - b1) * y / self.h)
            self.create_line(0, y, self.w, y, fill=f"#{r:02x}{g:02x}{b:02x}")
            
        # Cornice
        self.create_rectangle(1, 1, self.w-1, self.h-1, outline="#050814", width=2)
        
        # Riflesso Gloss sottile — fascia di luce stretta nella parte alta,
        # leggermente asimmetrica (più marcata a sx) per sembrare più naturale
        gl = 0.18  # intensità del riflesso
        gloss_c = f"#{int(r1+(255-r1)*gl):02x}{int(g1+(255-g1)*gl):02x}{int(b1+(255-b1)*gl):02x}"
        # Fascia sottile (solo 22% dell'altezza) e asimmetrica orizzontalmente
        self.create_oval(self.w*0.06, self.h*0.06, self.w*0.82, self.h*0.28, fill=gloss_c, outline="")
        
        self.create_text(self.w/2, self.h/2, text=self.text, fill="white", font=self.font)
        
    def on_press(self, event):
        self.draw(pressed=True)
        
    def on_release(self, event):
        self.draw(pressed=False)
        if self.command:
            self.after(50, self.command)

class HarmonyArchitectApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("The Harmony Architect - Advanced Ear Training")
        self.geometry("780x1030")
        self.configure(fg_color="#0A1128") # Deep Navy Master BG
        
        self.harmony_engine = HarmonyEngine()
        self.audio_engine = AudioEngine()
        
        self.current_target = None
        self.current_pitches = None
        self.correct_answer = None
        self.note_items_by_chord = {}  # pre-init to avoid AttributeError before first reveal
        self._is_playing = False
        
        self.score_correct = 0
        self.score_total = 0
        self.first_attempt = True
        
        self.level_keys = ["1: Triadi Base", "2: Settime (Drop 2)", "3: Jazz Extensions", "4: Advanced (Subs/Alt)"]
        
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
        
        self.setup_ui()
        self.generate_new_challenge()
        
    def create_panel(self, parent):
        return ctk.CTkFrame(parent, fg_color="#1C2541", corner_radius=15, border_width=1, border_color="#2A375E")
        
    def setup_ui(self):
        # 1. Header & Level Selection
        self.top_frame = self.create_panel(self)
        self.top_frame.pack(pady=10, padx=20, fill="x")
        
        lvl_label = ctk.CTkLabel(self.top_frame, text="Livello:", font=("Arial", 16, "bold"), text_color="#E2E8F0")
        lvl_label.pack(side="left", padx=10, pady=12)
        
        self.level_var = ctk.StringVar(value=self.level_keys[0])
        self.level_menu = ctk.CTkOptionMenu(
            self.top_frame, values=self.level_keys, variable=self.level_var, command=self.on_level_change, 
            width=200, fg_color="#273359", button_color="#36497d"
        )
        self.level_menu.pack(side="left", padx=10, pady=12)
        
        self.score_label = ctk.CTkLabel(self.top_frame, text="Score: 0 / 0", font=("Courier", 18, "bold"), text_color="#55EFC4")
        self.score_label.pack(side="right", padx=15, pady=12)
        
        self.next_btn = ctk.CTkButton(self.top_frame, text="↻ Nuova Sfida", fg_color="#0984E3", hover_color="#74B9FF", font=("Arial", 14, "bold"), command=self.generate_new_challenge)
        self.next_btn.pack(side="right", padx=10, pady=12)
        
        # 1.5 Settings Panel ROW 1
        self.settings_frame = self.create_panel(self)
        self.settings_frame.pack(pady=5, padx=20, fill="x")
        
        mode_label = ctk.CTkLabel(self.settings_frame, text="Modalità:", font=("Arial", 14, "bold"), text_color="#E2E8F0")
        mode_label.pack(side="left", padx=10, pady=8)
        self.play_mode_var = ctk.StringVar(value="Accordo Singolo")
        self.play_mode_menu = ctk.CTkOptionMenu(
            self.settings_frame, values=["Accordo Singolo", "Progressione"], variable=self.play_mode_var, 
            command=self.on_settings_change, width=160, fg_color="#6C5CE7", button_color="#A29BFE", button_hover_color="#6C5CE7"
        )
        self.play_mode_menu.pack(side="left", padx=5)
        
        wf_label = ctk.CTkLabel(self.settings_frame, text="Timbro:", font=("Arial", 14), text_color="#E2E8F0")
        wf_label.pack(side="left", padx=15, pady=8)
        self.wave_var = ctk.StringVar(value="EPiano")
        self.wave_menu = ctk.CTkOptionMenu(self.settings_frame, values=["EPiano", "Sine", "Triangle"], variable=self.wave_var, command=self.on_settings_change, width=100, fg_color="#273359", button_color="#36497d")
        self.wave_menu.pack(side="left", padx=5)
        
        oct_label = ctk.CTkLabel(self.settings_frame, text="Base:", font=("Arial", 14), text_color="#E2E8F0")
        oct_label.pack(side="left", padx=15, pady=8)
        self.octave_var = ctk.StringVar(value="C4")
        self.octave_menu = ctk.CTkOptionMenu(self.settings_frame, font=("Courier", 14, "bold"), values=["C3", "C4"], variable=self.octave_var, command=self.on_settings_change, width=60, fg_color="#273359", button_color="#36497d")
        self.octave_menu.pack(side="left", padx=5)

        # 1.6 Settings Panel ROW 2
        self.settings_frame_2 = self.create_panel(self)
        self.settings_frame_2.pack(pady=5, padx=20, fill="x")
        
        vl_label = ctk.CTkLabel(self.settings_frame_2, text="Voice Leading:", font=("Arial", 14, "bold"), text_color="#E2E8F0")
        vl_label.pack(side="left", padx=10, pady=8)
        self.voice_leading_var = ctk.StringVar(value="Optimized")
        self.voice_leading_menu = ctk.CTkOptionMenu(
            self.settings_frame_2, values=["Standard (Drop 2)", "Optimized"], variable=self.voice_leading_var, 
            command=self.on_settings_change, width=180, fg_color="#273359", button_color="#36497d"
        )
        self.voice_leading_menu.pack(side="left", padx=5)
        
        # 2. Main Playback Area (Glossy Custom Canvas Buttons)
        self.play_frame = self.create_panel(self)
        self.play_frame.pack(pady=5, padx=20, fill="x")
        
        self.play_btn = HardwareButton(self.play_frame, width=330, height=60, text="▶ PLAY", c_top="#3A6B9C", c_bot="#182A4A", command=self.play_chord)
        self.play_btn.pack(side="left", padx=15, pady=15)
        
        self.slow_btn = HardwareButton(self.play_frame, width=330, height=60, text="〰 ARPEGGIATOR", c_top="#C26A23", c_bot="#66340B", command=self.play_arpeggio)
        self.slow_btn.pack(side="right", padx=15, pady=15)
        
        # 2.5 Visual Staff (Canvas) - Recessed Display
        self.staff_frame = ctk.CTkFrame(self, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")
        self.staff_frame.pack(pady=8, padx=20, fill="x")
        self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=215, bg="#050814", highlightthickness=0)
        self.staff_canvas.pack(fill="x", padx=5, pady=5)
        
        # 2.6 Voice Isolation (Solo)
        self.solo_frame = self.create_panel(self)
        self.solo_frame.pack(pady=5, padx=20, fill="x")
        
        ctk.CTkLabel(self.solo_frame, text="ISOLATE:", font=("Arial", 13, "bold"), text_color="#A0AEC0").pack(side="left", padx=10, pady=10)
        
        SOLO_LABELS = ["BASS", "V2", "V3", "V4", "V5", "V6", "TOP"]
        btn_kwargs = dict(width=72, height=35, fg_color="#1C2541", border_width=1, border_color="#3A4B75", text_color="#A0AEC0", font=("Arial", 11, "bold"))
        self.solo_btns = []
        for k, lbl in enumerate(SOLO_LABELS):
            b = ctk.CTkButton(self.solo_frame, text=lbl, command=lambda idx=k: self.play_layer(idx), state="disabled", **btn_kwargs)
            b.pack(side="left", padx=4)
            self.solo_btns.append(b)
        
        # 3. Dynamic Answers Grid (MPC Style)
        self.answers_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.answers_frame.pack(pady=5, padx=20, fill="x")
        
        self.answer_buttons = []
        for i in range(4):
            btn = ctk.CTkButton(self.answers_frame, text=f"Opzione {i+1}", font=("Arial", 15, "bold"), height=52,
                                fg_color="#1C2541", border_width=2, border_color="#2A375E", hover_color="#2A375E",
                                command=lambda idx=i: self.check_answer(idx))
            btn.grid(row=i//2, column=i%2, padx=12, pady=8, sticky="nsew")
            self.answer_buttons.append(btn)
            
        self.answers_frame.grid_columnconfigure(0, weight=1)
        self.answers_frame.grid_columnconfigure(1, weight=1)
            
        # 4. Theory Insight Panel
        self.insight_label = ctk.CTkLabel(self, text="", font=("Courier", 13, "bold"), text_color="#A0AEC0", wraplength=700)
        self.insight_label.pack(pady=(12, 5), padx=20, fill="x")

    def pulse_play_btn(self, count):
        if count <= 0:
            self.play_btn.draw(pressed=False)
            return
            
        if count % 2 == 0:
            self.play_btn.draw(pressed=False, glow_override="#7dbDF0")
        else:
            self.play_btn.draw(pressed=False)
            
        self.after(250, lambda: self.pulse_play_btn(count - 1))

    def draw_empty_staff(self):
        self.staff_canvas.delete("all")
        
        # Inner Shadow Recessed perimetro
        for i in range(10):
            val = int((i/9)*28) # 0 to #1C
            hex_c = f"#{val:02x}{val:02x}{val:02x}"
            if i == 9: hex_c = "#050814"
            self.staff_canvas.create_rectangle(i, i, 740-i, 220-i, outline=hex_c, width=1)
            
        # Treble Staff
        for y in [40, 50, 60, 70, 80]:
            self.staff_canvas.create_line(30, y, 710, y, fill="#2E406A", width=1)
        self.staff_canvas.create_text(45, 60, text="𝄞", fill="#4A65A5", font=("Arial", 68))
        
        # Bass Staff
        for y in [140, 150, 160, 170, 180]:
            self.staff_canvas.create_line(30, y, 710, y, fill="#2E406A", width=1)
        self.staff_canvas.create_text(45, 160, text="𝄢", fill="#4A65A5", font=("Arial", 50))
        
        # Grand Staff Bracket
        self.staff_canvas.create_line(30, 40, 30, 180, fill="#4A65A5", width=2)
        
    def draw_pitches_on_staff(self):
        self.draw_empty_staff()
        if not self.current_pitches: return
        
        def get_root_pc(symbol):
            match = re.match(r"^([A-G][b#\-]?)", symbol)
            if match:
                root_name = match.group(1).replace("-", "b")
                return pitch.Pitch(f"{root_name}4").pitchClass
            return 0
            
        is_progression = (self.play_mode_var.get() == "Progressione")
        target = self.current_target
        symbols = target["chords"].split("|") if is_progression else [target]
        chords_to_draw = self.current_pitches if is_progression else [self.current_pitches]
        spacing = 700 / (len(chords_to_draw) + 1)
        step_map = {'C':0, 'D':1, 'E':2, 'F':3, 'G':4, 'A':5, 'B':6}
        
        self.note_items_by_chord = {}
        draw_queue = []
        
        for i, chord in enumerate(chords_to_draw):
            x_base = 100 + spacing * i
            symbol = symbols[i]
            root_pc = get_root_pc(symbol)
            self.note_items_by_chord[i] = []
            
            # Pre-compute Y positions to detect close intervals
            y_positions = []
            for j, p in enumerate(chord):
                step = p.octave * 7 + step_map.get(p.name[0], 0)
                y = (140 - (step - 26) * 5) if j == 0 else (80 - (step - 30) * 5)
                y_positions.append(y)
            
            for j, p in enumerate(chord):
                ival = (p.pitchClass - root_pc) % 12
                
                if ival == 0: color = "#3498db" 
                elif ival in [3, 4]: color = "#2ecc71"
                elif ival == 7: color = "#f1c40f" 
                elif ival in [10, 11]: color = "#e67e22" 
                else: color = "#e74c3c" 
                
                accidental = p.accidental.modifier if p.accidental else ""
                y = y_positions[j]
                
                # Stagger x if within 8px of any earlier note in this chord (second interval)
                x = x_base
                for prev_j in range(j):
                    if abs(y_positions[prev_j] - y) <= 8:
                        x = x_base + 16
                        break
                    
                time_offset = i * 200 + j * 90 
                draw_queue.append({"chord_idx": i, "note_idx": j, "y": y, "x": x,
                                   "color": color, "acc": accidental, "j": j,
                                   "delay": time_offset, "freq": p.frequency, "pitch_obj": p})
                
        def render_note(item):
            y, x_draw, color, acc, j, ci, ni = item["y"], item["x"], item["color"], item["acc"], item["j"], item["chord_idx"], item["note_idx"]
            freq = item["freq"]
            
            # Ledgers
            if j == 0:
                if y >= 190:
                    for l_y in range(190, int(y)+5, 10):
                        self.staff_canvas.create_line(x_draw-10, l_y, x_draw+22, l_y, fill="#4A65A5", width=1.5)
                elif y <= 130:
                    for l_y in range(130, int(y)-5, -10):
                        self.staff_canvas.create_line(x_draw-10, l_y, x_draw+22, l_y, fill="#4A65A5", width=1.5)
            else:      
                if y >= 90:
                    for l_y in range(90, int(y)+5, 10):
                        self.staff_canvas.create_line(x_draw-10, l_y, x_draw+22, l_y, fill="#4A65A5", width=1.5)
                elif y <= 30:
                    for l_y in range(30, int(y)-5, -10):
                        self.staff_canvas.create_line(x_draw-10, l_y, x_draw+22, l_y, fill="#4A65A5", width=1.5)
            
            # Drop shadow
            self.staff_canvas.create_oval(x_draw+3, y-1, x_draw+15, y+7, fill="#000000", outline="")
            # Glass sphere base - store (oval_id, color, note_idx)
            oval_id = self.staff_canvas.create_oval(x_draw, y-4, x_draw+12, y+4, fill=color, outline="#010205")
            if ci in self.note_items_by_chord:
                self.note_items_by_chord[ci].append((oval_id, color, ni))
            # Gloss highlight
            self.staff_canvas.create_oval(x_draw+2, y-2, x_draw+6, y+1, fill="#FFFFFF", outline="")
            
            if acc:
                acc_char = "♯" if acc == "#" else "♭" if acc == "-" else acc
                self.staff_canvas.create_text(x_draw - 14, y, text=acc_char, fill="white", font=("Arial", 14, "bold"))
            
            # --- Click-to-play binding ---
            def on_note_click(event, f=freq, oid=oval_id, c=color):
                # Flash white for tactile feedback
                self.staff_canvas.itemconfig(oid, fill="#FFFFFF", outline="#FFFFFF")
                self.after(180, lambda: self.staff_canvas.itemconfig(oid, fill=c, outline="#010205"))
                # Play note non-blocking (bypass _is_playing guard — single note is instant)
                import numpy as np, sounddevice as sd, threading
                def _play():
                    try:
                        wave = self.audio_engine.generate_wave(f, 1.5)
                        mx = max(float(np.max(np.abs(wave))), 1e-6)
                        sd.play(np.ascontiguousarray(wave / mx * 0.45, dtype=np.float32), self.audio_engine.sample_rate)
                    except Exception: pass
                threading.Thread(target=_play, daemon=True).start()
            
            self.staff_canvas.tag_bind(oval_id, "<Button-1>", on_note_click)
            self.staff_canvas.tag_bind(oval_id, "<Enter>", lambda e: self.staff_canvas.config(cursor="hand2"))
            self.staff_canvas.tag_bind(oval_id, "<Leave>", lambda e: self.staff_canvas.config(cursor=""))
                
        for item in draw_queue:
            self.after(item["delay"], lambda i=item: render_note(i))

    def enable_solo_buttons(self):
        """Enable only as many solo buttons as there are notes in the deepest chord."""
        chords = self.current_pitches if isinstance(self.current_pitches[0], list) else [self.current_pitches]
        max_notes = max(len(c) for c in chords)
        for k, btn in enumerate(self.solo_btns):
            if k < max_notes:
                btn.configure(state="normal")
                btn.pack(side="left", padx=4)  # ensure visible
            else:
                btn.configure(state="disabled", fg_color="#1C2541", border_color="#3A4B75", text_color="#A0AEC0")
                btn.pack_forget()              # hide unused

    def pulse_notes(self, chord_idx, dur_ms):
        """Illuminate all ovals of chord_idx simultaneously for dur_ms."""
        items = self.note_items_by_chord.get(chord_idx, [])
        if not items: return
        
        def brighten(hex_c):
            r, g, b = int(hex_c[1:3],16), int(hex_c[3:5],16), int(hex_c[5:7],16)
            r = min(255, int(r + (255-r)*0.55))
            g = min(255, int(g + (255-g)*0.55))
            b = min(255, int(b + (255-b)*0.55))
            return f"#{r:02x}{g:02x}{b:02x}"
            
        for oid, col, _ in items:
            try: self.staff_canvas.itemconfig(oid, fill=brighten(col), outline="#FFFFFF", width=1)
            except Exception: pass
                
        def restore():
            for oid, col, _ in items:
                try: self.staff_canvas.itemconfig(oid, fill=col, outline="#010205", width=1)
                except Exception: pass
        self.after(int(dur_ms), restore)

    def pulse_note_single(self, chord_idx, note_idx, dur_ms):
        """Illuminate only the note at note_idx in chord_idx."""
        items = self.note_items_by_chord.get(chord_idx, [])
        target = [(oid, col) for oid, col, ni in items if ni == note_idx]
        if not target: return
        
        def brighten(hex_c):
            r, g, b = int(hex_c[1:3],16), int(hex_c[3:5],16), int(hex_c[5:7],16)
            r = min(255, int(r + (255-r)*0.55))
            g = min(255, int(g + (255-g)*0.55))
            b = min(255, int(b + (255-b)*0.55))
            return f"#{r:02x}{g:02x}{b:02x}"
        
        for oid, col in target:
            try: self.staff_canvas.itemconfig(oid, fill=brighten(col), outline="#FFFFFF", width=1)
            except Exception: pass
            
        def restore():
            for oid, col in target:
                try: self.staff_canvas.itemconfig(oid, fill=col, outline="#010205", width=1)
                except Exception: pass
        self.after(int(dur_ms), restore)

    def pulse_notes_arpeggio(self, chord_idx, arpeggio_delay_ms, note_dur_ms):
        """Illuminate notes of chord_idx one at a time, staggered by arpeggio_delay_ms."""
        items = self.note_items_by_chord.get(chord_idx, [])
        if not items: return
        
        def brighten(hex_c):
            r, g, b = int(hex_c[1:3],16), int(hex_c[3:5],16), int(hex_c[5:7],16)
            r = min(255, int(r + (255-r)*0.55))
            g = min(255, int(g + (255-g)*0.55))
            b = min(255, int(b + (255-b)*0.55))
            return f"#{r:02x}{g:02x}{b:02x}"
        
        for k, (oid, col, _) in enumerate(items):
            onset = int(k * arpeggio_delay_ms)
            # Lighten at onset
            self.after(onset, lambda o=oid, c=col: self.staff_canvas.itemconfig(o, fill=brighten(c), outline="#FFFFFF", width=1))
            # Restore after note_dur_ms
            self.after(onset + int(note_dur_ms), lambda o=oid, c=col: self.staff_canvas.itemconfig(o, fill=c, outline="#010205", width=1))

    def dynamically_glow_solo(self, chord_index, dur, delay_between, is_arpeggio):
        chords = self.current_pitches if (self.play_mode_var.get() == "Progressione") else [self.current_pitches]
        target = self.current_target
        symbols = target["chords"].split("|") if isinstance(target, dict) else [target]
        
        if chord_index >= len(chords): return
        chord = chords[chord_index]
        symbol = symbols[chord_index]
        
        import re
        match = re.match(r"^([A-G][b#\-]?)", symbol)
        root_pc = pitch.Pitch(f"{match.group(1).replace('-', 'b')}4").pitchClass if match else 0
        
        btns = self.solo_btns
        
        for j, p in enumerate(chord):
            if j < len(btns):
                ival = (p.pitchClass - root_pc) % 12
                c = "#e74c3c"
                if ival == 0: c = "#3498db"
                elif ival in [3, 4]: c = "#2ecc71"
                elif ival == 7: c = "#f1c40f"
                elif ival in [10, 11]: c = "#e67e22"
                # Illumina
                btns[j].configure(fg_color=c, border_color="#ffffff", border_width=2, text_color="#101A35")
                
        def reset_solo_glow():
            for b in btns:
                b.configure(fg_color="#1C2541", border_color="#3A4B75", border_width=1, text_color="#A0AEC0")

        step_time = dur * 1000
        if is_arpeggio: step_time += (len(chord)-1)*350 
        
        self.after(int(step_time - 20), reset_solo_glow)

    def play_layer(self, layer_idx):
        if not self.current_pitches: return
        is_progression = (self.play_mode_var.get() == "Progressione")
        dur = 1.2 if is_progression else 2.0
        
        def ui_sync(idx):
            self.after(0, lambda: self.dynamically_glow_solo(idx, dur, 0.1, False))
            # Pulse only the single note corresponding to layer_idx
            self.after(0, lambda: self.pulse_note_single(idx, layer_idx, dur * 900))
            
        self.pulse_play_btn(6)
        self.audio_engine.play_voice_layer(self.current_pitches, layer_idx, is_progression, duration=dur, delay_between=0.6, ui_callback=ui_sync)
        
    def on_settings_change(self, _):
        wf_map = {"EPiano": "epiano", "Sine": "sine", "Triangle": "triangle"}
        self.audio_engine.set_wave_type(wf_map.get(self.wave_var.get(), "epiano"))
        oct_map = {"C3": 3, "C4": 4}
        self.harmony_engine.set_base_octave(oct_map.get(self.octave_var.get(), 4))
        if self.current_target is not None:
            self.generate_new_challenge()
        
    def on_level_change(self, choice):
        self.generate_new_challenge()
        
    def update_pitches(self):
        target = self.current_target
        if not target: return
        is_progression = (self.play_mode_var.get() == "Progressione")
        vl_mode = self.voice_leading_var.get()
        
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
            if self.level_var.get().startswith("1"):
                self.current_pitches = raw_p 
            else:
                self.current_pitches = self.harmony_engine.apply_voicing(raw_p, strategy="drop2")

    def generate_new_challenge(self):
        self.first_attempt = True
        self.insight_label.configure(text="")
        
        self.draw_empty_staff()
        for btn in self.solo_btns:
            btn.configure(state="disabled", fg_color="#1C2541", border_color="#3A4B75")
            btn.pack(side="left", padx=4)  # reset all to visible before enable selects
        
        level = self.level_var.get()
        is_progression = (self.play_mode_var.get() == "Progressione")
        pool = self.level_pools_prog[level] if is_progression else self.level_pools_single[level]
        
        target = random.choice(pool)
        self.current_target = target
        self.correct_answer = target
        
        self.update_pitches()
        
        font_size = 13 if is_progression else 20
        wrong_options = random.sample([c for c in pool if c != target], min(3, len(pool)-1))
        all_options = [target] + wrong_options
        random.shuffle(all_options)
        
        for i, btn in enumerate(self.answer_buttons):
            text_val = btn.cget('text').replace("✅ ", "").replace("❌ ", "")
            btn.configure(fg_color="#1C2541", border_color="#2A375E", border_width=2, state="normal", font=("Arial", font_size, "bold")) 
            if i < len(all_options):
                opt = all_options[i]
                btn_text = opt["name"] if is_progression else opt
                btn.configure(text=btn_text)
                btn.option_value = opt
            else:
                btn.configure(text="-")
                btn.option_value = None
                btn.configure(state="disabled")
                
    def _set_playing(self, state: bool):
        """Enable/disable transport buttons and update the playing guard flag."""
        self._is_playing = state
        # All hardware-canvas buttons store a reference; CTkButton transport buttons:
        transport = self.solo_btns
        # We only lock the SOLO buttons when playing; PLAY/ARPEG are canvas buttons guarded by flag
        for b in transport:
            if not state:
                # Don't force-enable solo — that's controlled by check_answer
                pass
            # nothing here; solo buttons are already managed by enable_solo_buttons

    def play_chord(self):
        if not self.current_pitches or self._is_playing: return
        is_progression = (self.play_mode_var.get() == "Progressione")
        dur = 1.2 if is_progression else 2.0
        self._is_playing = True
        
        self.pulse_play_btn(6)
        
        def ui_sync(idx):
            self.after(0, lambda: self.dynamically_glow_solo(idx, dur, 0.1, False))
            self.after(0, lambda: self.pulse_notes(idx, dur * 900))
        
        def on_done():
            self.after(0, lambda: setattr(self, '_is_playing', False))
            
        if is_progression:
            self.audio_engine.play_progression(self.current_pitches, duration=dur, delay_between=0.1, ui_callback=ui_sync, done_callback=on_done)
        else:
            self.audio_engine.play_pitches(self.current_pitches, duration=dur, ui_callback=ui_sync, done_callback=on_done)
            
    def play_arpeggio(self):
        if not self.current_pitches or self._is_playing: return
        is_progression = (self.play_mode_var.get() == "Progressione")
        dur = 1.5
        arp_delay_ms = 350
        self._is_playing = True
        
        self.pulse_play_btn(6)
        
        def ui_sync(idx):
            self.after(0, lambda: self.dynamically_glow_solo(idx, dur, 0.8 if is_progression else 0, True))
            self.after(0, lambda: self.pulse_notes_arpeggio(idx, arp_delay_ms, dur * 900))
        
        def on_done():
            self.after(0, lambda: setattr(self, '_is_playing', False))
            
        if is_progression:
            self.audio_engine.play_progression(self.current_pitches, duration=dur, delay_between=0.8, arpeggio=True, arpeggio_delay=arp_delay_ms/1000, ui_callback=ui_sync, done_callback=on_done)
        else:
            self.audio_engine.play_pitches(self.current_pitches, duration=dur, arpeggio=True, arpeggio_delay=arp_delay_ms/1000, ui_callback=ui_sync, done_callback=on_done)
            
    def check_answer(self, btn_index):
        btn = self.answer_buttons[btn_index]
        val = btn.option_value
        if not val: return
        
        correct = (val == self.correct_answer)
        
        if self.first_attempt:
            self.score_total += 1
            if correct:
                self.score_correct += 1
            self.score_label.configure(text=f"Score: {self.score_correct} / {self.score_total}")
            self.first_attempt = False
            
        btn_text = btn.cget('text').replace("✅ ", "").replace("❌ ", "")
        
        if correct:
            btn.configure(fg_color="#1E3F30", border_color="#55EFC4", border_width=3, text=f"✅ {btn_text}") 
            self.show_insight(True)
            self.draw_pitches_on_staff()  
            self.enable_solo_buttons()    
            
            for b in self.answer_buttons:
                b.configure(state="disabled")
        else:
            btn.configure(fg_color="#3B181E", border_color="#FF7675", border_width=3, text=f"❌ {btn_text}")
            self.show_insight(False)
            
    def show_insight(self, correct):
        is_progression = (self.play_mode_var.get() == "Progressione")
        
        if is_progression:
            name_str = self.correct_answer["name"].replace("\n", " ")
            msg = f"{'Corretto.' if correct else 'Errato.'} {name_str}.\n"
        else:
            msg = f"{'Corretto.' if correct else 'Errato.'} Accordo: {self.correct_answer}.\n"
            
        self.insight_label.configure(text=msg)

if __name__ == "__main__":
    app = HarmonyArchitectApp()
    app.mainloop()
