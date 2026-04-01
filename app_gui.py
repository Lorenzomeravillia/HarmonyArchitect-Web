import customtkinter as ctk
import re

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
        
        # Riflesso Gloss sottile
        gl = 0.18
        gloss_c = f"#{int(r1+(255-r1)*gl):02x}{int(g1+(255-g1)*gl):02x}{int(b1+(255-b1)*gl):02x}"
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
        
        # Calcola dimensioni adattive basate sullo schermo
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        
        # Usa finestra dimensionata per garantire visibilità completa
        window_width = min(780, screen_width - 100)
        window_height = min(900, screen_height - 150)  # Ridotto per evitare tagli
        
        # Posiziona al centro dello schermo
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        self.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.minsize(680, 750)
        self.after(100, self._maximize)
        
        self.bind("<F11>", self.toggle_fullscreen)
        self.bind("<Escape>", self.exit_fullscreen)
        
        self.configure(fg_color="#0A1128") # Deep Navy Master BG

        self.controller = None
        self.note_items_by_chord = {}
        self.fullscreen_enabled = False

        self.level_keys = ["1: Triadi Base", "2: Settime (Drop 2)", "3: Jazz Extensions", "4: Advanced (Subs/Alt)"]

        self.setup_ui()

    def _maximize(self):
        try:
            self.state("zoomed")
        except Exception:
            sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
            self.geometry(f"{sw}x{sh}+0+0")

    def toggle_fullscreen(self, event=None):
        """Attiva/disattiva modalità fullscreen"""
        self.fullscreen_enabled = not self.fullscreen_enabled
        self.attributes("-fullscreen", self.fullscreen_enabled)
        if not self.fullscreen_enabled:
            # Ripristina dimensioni normali
            screen_width = self.winfo_screenwidth()
            screen_height = self.winfo_screenheight()
            window_width = min(780, screen_width - 100)
            window_height = min(900, screen_height - 150)
            x = (screen_width - window_width) // 2
            y = (screen_height - window_height) // 2
            self.geometry(f"{window_width}x{window_height}+{x}+{y}")
        
    def exit_fullscreen(self, event=None):
        """Esci dalla modalità fullscreen"""
        self.fullscreen_enabled = False
        self.attributes("-fullscreen", False)
        
    def set_controller(self, controller):
        self.controller = controller

    def create_panel(self, parent):
        return ctk.CTkFrame(parent, fg_color="#1C2541", corner_radius=15, border_width=1, border_color="#2A375E")
        
    def setup_ui(self):
        # Main Scrollable Wrapper
        self.main_scrollview = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.main_scrollview.pack(fill="both", expand=True)

        # 1. Header & Level Selection
        self.top_frame = self.create_panel(self.main_scrollview)
        self.top_frame.pack(pady=(8,4), padx=20, fill="x")
        
        lvl_label = ctk.CTkLabel(self.top_frame, text="Livello:", font=("Arial", 16, "bold"), text_color="#E2E8F0")
        lvl_label.pack(side="left", padx=10, pady=12)
        
        self.level_var = ctk.StringVar(value=self.level_keys[0])
        self.level_menu = ctk.CTkOptionMenu(
            self.top_frame, values=self.level_keys, variable=self.level_var, 
            command=lambda c: self.controller.on_level_change(c) if self.controller else None, 
            width=200, fg_color="#273359", button_color="#36497d"
        )
        self.level_menu.pack(side="left", padx=10, pady=12)
        
        score_container = ctk.CTkFrame(self.top_frame, fg_color="transparent")
        score_container.pack(side="right", padx=10, pady=5)
        
        self.reset_btn = ctk.CTkButton(score_container, text="🗑️", width=30, height=20, fg_color="#1C2541", hover_color="#C0392B", text_color="white", command=lambda: self.controller.on_reset_history() if self.controller else None)
        self.reset_btn.pack(side="right", padx=(10, 0))
        
        self.score_label = ctk.CTkLabel(score_container, text="Score Sessione: 0 / 0 | Win Rate Globale: 0%", font=("Courier", 14, "bold"), text_color="#55EFC4")
        self.score_label.pack(side="right")
        
        self.ai_focus_label = ctk.CTkLabel(score_container, text="", font=("Courier", 13, "bold"), text_color="#E74C3C")
        self.ai_focus_label.pack(side="top", anchor="e")
        
        self.next_btn = ctk.CTkButton(self.top_frame, text="↻ Nuova Sfida", fg_color="#0984E3", hover_color="#74B9FF", font=("Arial", 14, "bold"), 
                                      command=lambda: self.controller.on_new_challenge() if self.controller else None)
        self.next_btn.pack(side="right", padx=10, pady=12)
        
        # 1.5 Settings Panel ROW 1
        self.settings_frame = self.create_panel(self.main_scrollview)
        self.settings_frame.pack(pady=5, padx=20, fill="x")
        
        mode_label = ctk.CTkLabel(self.settings_frame, text="Modalità:", font=("Arial", 14, "bold"), text_color="#E2E8F0")
        mode_label.pack(side="left", padx=10, pady=8)
        self.play_mode_var = ctk.StringVar(value="Accordo Singolo")
        self.play_mode_menu = ctk.CTkOptionMenu(
            self.settings_frame, values=["Accordo Singolo", "Progressione"], variable=self.play_mode_var, 
            command=lambda _: self.controller.on_settings_change() if self.controller else None, width=160, fg_color="#6C5CE7", button_color="#A29BFE", button_hover_color="#6C5CE7"
        )
        self.play_mode_menu.pack(side="left", padx=5)
        
        # Lista di strumenti disponibili (basati su ORCHESTRA in audio_engine.py)
        self.available_instruments = [
            "Contrabbasso", "Violoncello", "Fagotto", "Corno", 
            "Viola", "Clarinetto", "Flauto", "Piano", "Chitarra", 
            "Violino", "Tromba", "Sassofono", "Organo", "Arpa"
        ]
        
        self.voice_instrument_vars = []
        self.voice_menus = []
        
        # Riga dedicata per gli strumenti
        self.instruments_row = self.create_panel(self.main_scrollview)
        self.instruments_row.pack(pady=5, padx=20, fill="x")
        
        voice_label = ctk.CTkLabel(self.instruments_row, text="Orchestra (Ensemble):", font=("Arial", 14, "bold"), text_color="#55EFC4")
        voice_label.pack(side="left", padx=10, pady=8)
        
        # Frame per i dropdown
        self.voice_instruments_frame = ctk.CTkFrame(self.instruments_row, fg_color="transparent")
        self.voice_instruments_frame.pack(side="left", padx=5, expand=True, fill="x")
        
        voice_names = ["Basso", "V2", "V3", "V4", "V5", "V6", "Alto"]
        default_instruments = ["Contrabbasso", "Violoncello", "Fagotto", "Corno", "Viola", "Clarinetto", "Flauto"]
        
        for i in range(7):
            voice_frame = ctk.CTkFrame(self.voice_instruments_frame, fg_color="transparent")
            voice_frame.pack(side="left", padx=4, expand=True)
            
            # Etichetta voce (più leggibile)
            voice_name_label = ctk.CTkLabel(voice_frame, text=voice_names[i], font=("Arial", 11, "bold"), text_color="#A0AEC0")
            voice_name_label.pack(side="top", pady=(0, 2))
            
            var = ctk.StringVar(value=default_instruments[i])
            self.voice_instrument_vars.append(var)
            
            menu = ctk.CTkOptionMenu(
                voice_frame, values=self.available_instruments, variable=var,
                command=lambda _, idx=i: self.controller.on_instrument_change(idx) if self.controller else None, 
                width=95, height=28, fg_color="#273359", button_color="#36497d", font=("Arial", 10)
            )
            menu.pack(side="top")
            self.voice_menus.append(menu)
        
        oct_label = ctk.CTkLabel(self.settings_frame, text="Base:", font=("Arial", 14), text_color="#E2E8F0")
        oct_label.pack(side="left", padx=15, pady=8)
        self.octave_var = ctk.StringVar(value="C4")
        self.octave_menu = ctk.CTkOptionMenu(
            self.settings_frame, font=("Courier", 14, "bold"), values=["C3", "C4"], variable=self.octave_var, 
            command=lambda _: self.controller.on_settings_change() if self.controller else None, width=60, fg_color="#273359", button_color="#36497d"
        )
        self.octave_menu.pack(side="left", padx=5)

        vl_label = ctk.CTkLabel(self.settings_frame, text="Voice Leading:", font=("Arial", 14, "bold"), text_color="#E2E8F0")
        vl_label.pack(side="left", padx=10, pady=8)
        self.voice_leading_var = ctk.StringVar(value="Optimized")
        self.voice_leading_menu = ctk.CTkOptionMenu(
            self.settings_frame, values=["Standard (Drop 2)", "Optimized"], variable=self.voice_leading_var, 
            command=lambda _: self.controller.on_settings_change() if self.controller else None, width=130, fg_color="#273359", button_color="#36497d"
        )
        self.voice_leading_menu.pack(side="left", padx=5)
        
        train_label = ctk.CTkLabel(self.settings_frame, text="Training:", font=("Arial", 14, "bold"), text_color="#E2E8F0")
        train_label.pack(side="left", padx=10, pady=8)
        self.training_var = ctk.StringVar(value="Standard")
        self.training_menu = ctk.CTkOptionMenu(
            self.settings_frame, values=["Standard", "Adaptive"], variable=self.training_var, 
            command=lambda _: self.controller.on_settings_change() if self.controller else None, width=110, fg_color="#C26A23", button_color="#A04000", button_hover_color="#C26A23"
        )
        self.training_menu.pack(side="left", padx=5)
        
        # 2. Main Playback Area
        self.play_frame = self.create_panel(self.main_scrollview)
        self.play_frame.pack(pady=5, padx=20, fill="x")
        
        self.play_btn = HardwareButton(self.play_frame, width=330, height=60, text="▶ PLAY", c_top="#3A6B9C", c_bot="#182A4A",
                                       command=lambda: self.controller.on_play() if self.controller else None)
        self.play_btn.pack(side="left", padx=15, pady=5)

        self.slow_btn = HardwareButton(self.play_frame, width=330, height=60, text="〰 ARPEGGIATOR", c_top="#C26A23", c_bot="#66340B",
                                       command=lambda: self.controller.on_arpeggio() if self.controller else None)
        self.slow_btn.pack(side="right", padx=15, pady=5)

        # Combo label centrata tra i due bottoni
        self.combo_label = ctk.CTkLabel(self.play_frame, text="", font=("Courier", 32, "bold"), text_color="#F39C12")
        self.combo_label.pack(expand=True)
        
        # 2.5 Visual Staff (Canvas) and Answers Side-by-Side
        self.middle_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")
        self.middle_frame.pack(pady=8, padx=20, fill="x")

        self.staff_frame = ctk.CTkFrame(self.middle_frame, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")
        self.staff_frame.pack(side="left", fill="both", expand=True)
        self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=440, bg="#050814", highlightthickness=0)
        self.staff_canvas.pack(fill="both", expand=True, padx=5, pady=5)
        self.staff_canvas.bind("<Button-1>", self._on_staff_click)
        
        # 3. Dynamic Answers Grid (Vertical on right)
        self.answers_frame = ctk.CTkFrame(self.middle_frame, fg_color="transparent")
        self.answers_frame.pack(side="right", fill="y", padx=(15, 0))
        
        self.answer_buttons = []
        for i in range(4):
            btn = ctk.CTkButton(self.answers_frame, text=f"Opzione {i+1}", font=("Arial", 15, "bold"), height=90, width=190,
                                fg_color="#1C2541", border_width=2, border_color="#2A375E", hover_color="#2A375E",
                                command=lambda idx=i: self.controller.on_check_answer(idx) if self.controller else None)
            btn.grid(row=i, column=0, pady=10, sticky="nsew")
            self.answer_buttons.append(btn)
            
        self.answers_frame.grid_columnconfigure(0, weight=1)
        for i in range(4): self.answers_frame.grid_rowconfigure(i, weight=1)

        # 2.6 Voice Isolation (Solo)
        self.solo_frame = self.create_panel(self.main_scrollview)
        self.solo_frame.pack(pady=5, padx=20, fill="x")
        
        ctk.CTkLabel(self.solo_frame, text="ISOLATE:", font=("Arial", 13, "bold"), text_color="#A0AEC0").pack(side="left", padx=10, pady=10)
        
        SOLO_LABELS = ["BASS", "V2", "V3", "V4", "V5", "V6", "TOP"]
        btn_kwargs = dict(width=72, height=35, fg_color="#1C2541", border_width=1, border_color="#3A4B75", text_color="#A0AEC0", font=("Arial", 11, "bold"))
        self.solo_btns = []
        for k, lbl in enumerate(SOLO_LABELS):
            b = ctk.CTkButton(self.solo_frame, text=lbl, command=lambda idx=k: self.controller.on_play_layer(idx) if self.controller else None, state="disabled", **btn_kwargs)
            b.pack(side="left", padx=4)
            self.solo_btns.append(b)
            
        # 4. Theory Insight Panel
        insight_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")
        insight_frame.pack(pady=(4, 8), padx=20, fill="x")
        self.insight_label = ctk.CTkLabel(insight_frame, text="", font=("Courier", 13, "bold"), text_color="#A0AEC0", wraplength=700)
        self.insight_label.pack(pady=6, fill="x")

    def show_error(self, title, message, details=""):
        # Elegant modal popup
        err_win = ctk.CTkToplevel(self)
        err_win.title(title)
        err_win.geometry("500x350")
        err_win.configure(fg_color="#0A1128")
        err_win.transient(self)
        err_win.grab_set()

        lbl1 = ctk.CTkLabel(err_win, text="⚠ " + title, font=("Arial", 18, "bold"), text_color="#FF7675")
        lbl1.pack(pady=(20, 10))

        lbl2 = ctk.CTkLabel(err_win, text=message, font=("Arial", 14), text_color="#E2E8F0", wraplength=450)
        lbl2.pack(pady=10)

        # Truncate details if too long
        scfg = ctk.CTkScrollableFrame(err_win, fg_color="#1C2541", width=420, height=120)
        scfg.pack(pady=10)
        det_lbl = ctk.CTkLabel(scfg, text=details, font=("Courier", 11), text_color="#A0AEC0", justify="left")
        det_lbl.pack(padx=5, pady=5)

        ok_btn = ctk.CTkButton(err_win, text="OK", command=err_win.destroy, fg_color="#3A6B9C", width=100)
        ok_btn.pack(pady=15)

    def ask_confirmation(self, title, message, on_confirm):
        win = ctk.CTkToplevel(self)
        win.title(title)
        win.geometry("400x200")
        win.configure(fg_color="#0A1128")
        win.transient(self)
        win.grab_set()

        lbl1 = ctk.CTkLabel(win, text="⚠ " + title, font=("Arial", 16, "bold"), text_color="#F39C12")
        lbl1.pack(pady=(20, 10))

        lbl2 = ctk.CTkLabel(win, text=message, font=("Arial", 13), text_color="#E2E8F0", wraplength=350)
        lbl2.pack(pady=5)

        btn_frame = ctk.CTkFrame(win, fg_color="transparent")
        btn_frame.pack(pady=15)
        
        def _yes():
            on_confirm()
            win.destroy()

        ctk.CTkButton(btn_frame, text="Annulla", command=win.destroy, fg_color="#3A6B9C", width=100).pack(side="left", padx=10)
        ctk.CTkButton(btn_frame, text="Azzera", command=_yes, fg_color="#C0392B", hover_color="#A93226", width=100).pack(side="right", padx=10)

    def show_ai_focus(self):
        self.ai_focus_label.configure(text="🎯 AI Target Focus...")
        self.after(3500, lambda: self.ai_focus_label.configure(text=""))

    def pulse_play_btn(self, count):
        if count <= 0:
            self.play_btn.draw(pressed=False)
            return
            
        if count % 2 == 0:
            self.play_btn.draw(pressed=False, glow_override="#7dbDF0")
        else:
            self.play_btn.draw(pressed=False)
            
        self.after(250, lambda: self.pulse_play_btn(count - 1))

    def _on_staff_click(self, event):
        """Fallback canvas-level click: cerca il hitbox più vicino al cursore."""
        items = self.staff_canvas.find_overlapping(event.x - 1, event.y - 1, event.x + 1, event.y + 1)
        for item in reversed(items):  # topmost first
            cb = getattr(self, "_note_callbacks", {}).get(item)
            if cb:
                cb(event)
                return

    def draw_empty_staff(self):
        self._note_callbacks = {}
        self.staff_canvas.delete("all")
        
        # Inner Shadow Recessed perimetro
        for i in range(10):
            val = int((i/9)*28)
            hex_c = f"#{val:02x}{val:02x}{val:02x}"
            if i == 9: hex_c = "#050814"
            self.staff_canvas.create_rectangle(i, i, 740-i, 460-i, outline=hex_c, width=1)
            
        # Treble Staff
        for y in [80, 100, 120, 140, 160]:
            self.staff_canvas.create_line(30, y, 710, y, fill="#2E406A", width=1)
        self.staff_canvas.create_text(45, 120, text="𝄞", fill="#4A65A5", font=("Arial", 115))
        
        # Bass Staff
        for y in [260, 280, 300, 320, 340]:
            self.staff_canvas.create_line(30, y, 710, y, fill="#2E406A", width=1)
        self.staff_canvas.create_text(45, 300, text="𝄢", fill="#4A65A5", font=("Arial", 95))
        
        # Grand Staff Bracket
        self.staff_canvas.create_line(30, 80, 30, 340, fill="#4A65A5", width=2)
        
    def draw_pitches_on_staff(self, current_pitches, symbols, is_progression):
        self.draw_empty_staff()
        if not current_pitches: return

        self._note_callbacks = {}  # hitbox_id -> callback

        chords_to_draw = current_pitches if is_progression else [current_pitches]
        spacing = 520 / (len(chords_to_draw) + 1)
        step_map = {'C':0, 'D':1, 'E':2, 'F':3, 'G':4, 'A':5, 'B':6}
        
        self.note_items_by_chord = {}
        draw_queue = []
        present_colors = set()
        
        def get_root_pc(symbol):
            match = re.match(r"^([A-G][b#]?)", symbol)
            if match:
                root_name = match.group(1)
                # music21 cannot be imported here if this is pure view, ma va bene
                from music21 import pitch
                return pitch.Pitch(f"{root_name}4").pitchClass
            return 0
            
        for i, chord in enumerate(chords_to_draw):
            x_base = 100 + spacing * i
            symbol = symbols[i]
            root_pc = get_root_pc(symbol)
            self.note_items_by_chord[i] = []
            
            y_positions = []
            for j, p in enumerate(chord):
                step = p.octave * 7 + step_map.get(p.name[0], 0)
                y = (260 - (step - 26) * 10) if j == 0 else (160 - (step - 30) * 10)
                y_positions.append(y)
            
            for j, p in enumerate(chord):
                ival = (p.pitchClass - root_pc) % 12
                
                if ival == 0: color = "#3498db" 
                elif ival in [3, 4]: color = "#2ecc71"
                elif ival == 7: color = "#f1c40f" 
                elif ival in [10, 11]: color = "#e67e22" 
                else: color = "#e74c3c" 
                
                present_colors.add(color) 
                
                accidental = p.accidental.modifier if p.accidental else ""
                y = y_positions[j]
                
                x = x_base
                for prev_j in range(j):
                    if abs(y_positions[prev_j] - y) <= 8:
                        x = x_base + 16
                        break
                    
                time_offset = i * 200 + j * 90 
                draw_queue.append({"chord_idx": i, "note_idx": j, "y": y, "x": x,
                                   "color": color, "acc": accidental, "j": j,
                                   "delay": time_offset, "freq": getattr(p, "frequency", 440)})
                
        def render_note(item):
            y, x_draw, color, acc, j, ci, ni = item["y"], item["x"], item["color"], item["acc"], item["j"], item["chord_idx"], item["note_idx"]
            freq = item["freq"]
            
            # Ledgers
            if j == 0:
                if y >= 360:
                    for l_y in range(360, int(y)+5, 20):
                        self.staff_canvas.create_line(x_draw-6, l_y, x_draw+26, l_y, fill="#4A65A5", width=2)
                elif y <= 240:
                    for l_y in range(240, int(y)-5, -20):
                        self.staff_canvas.create_line(x_draw-6, l_y, x_draw+26, l_y, fill="#4A65A5", width=2)
            else:      
                if y >= 180:
                    for l_y in range(180, int(y)+5, 20):
                        self.staff_canvas.create_line(x_draw-6, l_y, x_draw+26, l_y, fill="#4A65A5", width=2)
                elif y <= 60:
                    for l_y in range(60, int(y)-5, -20):
                        self.staff_canvas.create_line(x_draw-6, l_y, x_draw+26, l_y, fill="#4A65A5", width=2)
            
            # Glass sphere base
            oval_id = self.staff_canvas.create_oval(x_draw, y-8, x_draw+20, y+8, fill=color, outline="#010205")
            if ci in self.note_items_by_chord:
                self.note_items_by_chord[ci].append((oval_id, color, ni))
            # Gloss highlight
            self.staff_canvas.create_oval(x_draw+3, y-5, x_draw+10, y+3, fill="#FFFFFF", outline="")
            
            if acc:
                acc_char = "♯" if acc == "#" else "♭" if acc == "-" else acc
                self.staff_canvas.create_text(x_draw - 14, y, text=acc_char, fill="white", font=("Arial", 14, "bold"))
            
            def on_note_click(event, f=freq, oid=oval_id, c=color, vi=j):
                self.staff_canvas.itemconfig(oid, fill="#FFFFFF", outline="#FFFFFF")
                self.after(180, lambda: self.staff_canvas.itemconfig(oid, fill=c, outline="#010205"))
                if self.controller:
                    self.controller.play_frequency(f, voice_idx=vi)

            # Area di click trasparente più grande
            hit = self.staff_canvas.create_rectangle(
                x_draw - 5, y - 15, x_draw + 25, y + 15,
                fill="", outline="", tags="hitbox"
            )
            # Registra entrambi nel dict: _on_staff_click è l'unico handler Button-1
            self._note_callbacks[oval_id] = on_note_click
            self._note_callbacks[hit] = on_note_click
            for item_id in (oval_id, hit):
                self.staff_canvas.tag_bind(item_id, "<Enter>", lambda e: self.staff_canvas.config(cursor="hand2"))
                self.staff_canvas.tag_bind(item_id, "<Leave>", lambda e: self.staff_canvas.config(cursor=""))
                
        for item in draw_queue:
            self.after(item["delay"], lambda i=item: render_note(i))
            
        # Draw dynamic chord legend
        legend_order = ["#3498db", "#2ecc71", "#f1c40f", "#e67e22", "#e74c3c"]
        legend_labels = {
            "#3498db": "1 (Fond.)", 
            "#2ecc71": "3 (Terza)", 
            "#f1c40f": "5 (Quinta)", 
            "#e67e22": "7 (Settima)", 
            "#e74c3c": "Estens."
        }
        
        legend_items = [c for c in legend_order if c in present_colors]
        
        if legend_items:
            lx = 480
            ly_start = 15
            
            # Draw legend background for readability
            box_height = len(legend_items) * 18 + 10
            self.staff_canvas.create_rectangle(
                lx - 6, ly_start - 6, 730, ly_start - 6 + box_height,
                fill="#0A1128", outline="#101A35", width=1, tags="legend"
            )
            
            for idx, c in enumerate(legend_items):
                ly = ly_start + idx * 18
                self.staff_canvas.create_oval(lx, ly, lx+10, ly+10, fill=c, outline="#010205", tags="legend")
                self.staff_canvas.create_text(
                    lx+16, ly+5, text=legend_labels[c], 
                    fill="#A0AEC0", font=("Arial", 10, "bold"), anchor="w", tags="legend"
                )

    def enable_solo_buttons(self, max_notes):
        for k, btn in enumerate(self.solo_btns):
            if k < max_notes:
                btn.configure(state="normal")
                btn.pack(side="left", padx=4)
            else:
                btn.configure(state="disabled", fg_color="#1C2541", border_color="#3A4B75", text_color="#A0AEC0")
                btn.pack_forget()

    def reset_solo_buttons(self):
        for btn in self.solo_btns:
            btn.configure(state="disabled", fg_color="#1C2541", border_color="#3A4B75")
            btn.pack(side="left", padx=4)

    def update_score(self, correct, total, global_rate=0.0, combo=0):
        self.score_label.configure(text=f"Score Sessione: {correct} / {total} | Win Rate Globale: {int(global_rate)}%")
        if combo == 0:
            self.combo_label.configure(text="")
        else:
            self.combo_label.configure(text=f"🔥 COMBO: {combo}")

        if combo > 0 and combo % 5 == 0:
            self.pulse_combo(60)

    def pulse_combo(self, steps=60):
        if steps <= 0:
            self.combo_label.configure(text_color="#F39C12", font=("Courier", 45, "bold"))
            return
            
        import math
        progress = (60 - steps) / 60.0
        # 4 beats heartbeat over 2 seconds
        factor = (math.sin(progress * math.pi * 8) + 1) / 2
        
        # Gold #F1C40F to Red #E74C3C
        r = int(241 + (231 - 241) * factor)
        g = int(196 + (76 - 196) * factor)
        b = int(15 + (60 - 15) * factor)
        hex_c = f"#{r:02x}{g:02x}{b:02x}"
        
        size = 45 + int(12 * factor)
        
        self.combo_label.configure(text_color=hex_c, font=("Courier", size, "bold"))
        self.after(33, lambda: self.pulse_combo(steps - 1))

    def update_insight(self, text):
        self.insight_label.configure(text=text)

    def mark_answer_correct(self, btn, btn_text):
        btn.configure(fg_color="#1E3F30", border_color="#55EFC4", border_width=3, text=f"✅ {btn_text}")
        for b in self.answer_buttons:
            b.configure(state="disabled")

    def mark_answer_wrong(self, btn, btn_text):
        btn.configure(fg_color="#3B181E", border_color="#FF7675", border_width=3, text=f"❌ {btn_text}")

    def setup_answer_buttons(self, all_options, is_progression, font_size):
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

    def pulse_notes(self, chord_idx, dur_ms):
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
            self.after(onset, lambda o=oid, c=col: self.staff_canvas.itemconfig(o, fill=brighten(c), outline="#FFFFFF", width=1))
            self.after(onset + int(note_dur_ms), lambda o=oid, c=col: self.staff_canvas.itemconfig(o, fill=c, outline="#010205", width=1))

    def dynamically_glow_solo(self, chord_index, dur, delay_between, is_arpeggio, current_pitches, current_target, is_progression):
        chords = current_pitches if is_progression else [current_pitches]
        target = current_target
        symbols = target["chords"].split("|") if is_progression else [target]
        
        if chord_index >= len(chords): return
        chord = chords[chord_index]
        symbol = symbols[chord_index]
        
        import re
        match = re.match(r"^([A-G][b#\-]?)", symbol)
        from music21 import pitch
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
                btns[j].configure(fg_color=c, border_color="#ffffff", border_width=2, text_color="#101A35")
                
        def reset_solo_glow():
            for b in btns:
                b.configure(fg_color="#1C2541", border_color="#3A4B75", border_width=1, text_color="#A0AEC0")

        step_time = dur * 1000
        if is_arpeggio: step_time += (len(chord)-1)*350 
        
        self.after(int(step_time - 20), reset_solo_glow)
